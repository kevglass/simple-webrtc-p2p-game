import { serverLog } from "./NetLog";
import { RelayServer } from "./RelayServer";
import { RTC_CONFIG } from "./RtcConfiguration";

/**
 * Represents a client connected to the server. Each time a client connects to the 
 * server we create one of these to manage the communication and state associated
 * with it.
 */
export class WebChannelClient {
    /** The WebRTC Peer Connection to the remote peer */
    private localConnection: RTCPeerConnection;
    /** The WebRTC Data Channel that we're using for unordered unreliable communications */
    private unorderedChannel?: RTCDataChannel;
    /** The WebRTC Data Channel that we're using for order reliable communications */
    private orderedChannel?: RTCDataChannel;
    /** True if the unordered channel is currently in connected state, that is ready to use */
    private unorderedChannelConnected: boolean = false;
    /** True if the ordered channel is currently in connected state, that is ready to use */
    private orderedChannelConnected: boolean = false;
    /** A simple ID given to this client by the server */
    readonly id: number;
    /** The username that this client identified with */
    readonly username: string;
    /** The server this client is connected to */
    readonly server: WebChannelServer;

    constructor(id: number, server: WebChannelServer, username: string) {
        this.id = id;
        this.username = username;
        this.server = server;

        // this is the core piece of WebRTC going on for the server. We create a
        // peer connection - thats WebRTCs point to point connection. We then ask
        // that peer connection to describe it self. This description is provided 
        // in two phases - the main description which set outs the codecs etc to
        // use and the candidates which describe the different network paths
        // (direct, punchthrough/stun, turn) on which the server can be contacted 
        // (these are called candidates)
        this.localConnection = new RTCPeerConnection(RTC_CONFIG);
        this.localConnection.onicecandidate = (e) => {
            // Whenever the local side determines an candidate tell the remote
            // side about it via the relay server so it can make use of it
            // to connect
            this.server.relayServer.sendMessage(username, {
                type: "candidate",
                candidate: e.candidate
            })
        }

        // create the two data channels we're going to use to communicate with this
        // client, one for ordered reliable traffic and one for unordered unreliable
        // traffic
        this.orderedChannel = this.localConnection.createDataChannel("ordered", {
            ordered: true
        });
        this.orderedChannel.binaryType = "arraybuffer";
        this.orderedChannel.onmessage = (event) => {
            this.handleOrderedReceiveMessage(event);
        }
        this.orderedChannel.onopen = (event) => {
            this.handleOrderedStatusChange(event);
        };
        this.orderedChannel.onclose= (event) => {
            this.handleOrderedStatusChange(event);
        };

        this.unorderedChannel = this.localConnection.createDataChannel("unordered", {
            ordered: false,
            maxPacketLifeTime: server.maxPacketLifeTime
        });
        this.unorderedChannel.onmessage = (event) => {
            this.handleUnorderedReceiveMessage(event);
        }
        this.unorderedChannel.onopen = (event) => {
            this.handleUnorderedStatusChange(event);
        };
        this.unorderedChannel.onclose= (event) => {
            this.handleUnorderedStatusChange(event);
        };
        this.unorderedChannel.binaryType = "arraybuffer";

        this.localConnection.createOffer().then((offer) => {
            // once the local side has made up its description, tell the 
            // remote side via the relay server so it can use it to 
            // connect
            this.localConnection.setLocalDescription(offer);
            this.server.relayServer.sendMessage(username, {
                type: "offer",
                offer: offer
            });
        });
    }

    public get connected(): boolean {
        return this.unorderedChannelConnected && this.orderedChannelConnected;
    }

    private handleOrderedReceiveMessage(event: MessageEvent): void 
        // we can send text or binary on the channel and we only
        // know which one we're receiving based on the type 
        // of the data presented
        {if (this.server.onOrderedText && typeof event.data === "string") {
            this.server.onOrderedText(this, event.data);
        } else if (this.server.onOrderedBinary) {
            this.server.onOrderedBinary(this, event.data);
        } else {
            serverLog("Data received from: " + this.username + " with no handler set");
        }
    }

    private handleUnorderedReceiveMessage(event: MessageEvent): void 
        // we can send text or binary on the channel and we only
        // know which one we're receiving based on the type 
        // of the data presented
        {if (this.server.onUnorderedText && typeof event.data === "string") {
            this.server.onUnorderedText(this, event.data);
        } else if (this.server.onUnorderedBinary) {
            this.server.onUnorderedBinary(this, event.data);
        } else {
            serverLog("Data received from: " + this.username + " with no handler set");
        }
    }

    onRelayMessage(from: string, message: any) {
        // callback for the relay server - we're going to process two types of 
        // message from the server - one that describes its capabilities in SDP called
        // the "answer" and one that gives us detail of one potential way of connecting
        // to it called the "candidate" 
        if (message.type) {
            if (message.type === "answer") {
                serverLog("Remote answer from: " + from);
                this.localConnection.setRemoteDescription(message.answer);
            } else if (message.type === "candidate") {
                if (message.candidate) {
                    serverLog("Candidate for connection: " + JSON.stringify(message.candidate))
                }
                this.localConnection?.addIceCandidate(message.candidate);
            } else {
                serverLog("Unknown message type: " + message.type)
            }
        } else {
            serverLog(message);
        }
    }
    
    private handleOrderedStatusChange(event: Event) {
        if (this.orderedChannel) {
          const state = this.orderedChannel.readyState;
      
          if (state === "open") {
            this.orderedChannelConnected = true;
            if (this.connected) {
                serverLog("Client connected (ready to send): " + this.username);
                if (this.server.onConnect) {
                    this.server.onConnect(this);
                }
            }
          } else {
            if (this.connected) {
                serverLog("Client Disconnected: " + this.username);
                this.server.removeClient(this);
                if (this.server.onDisconnect) {
                    this.server.onDisconnect(this);
                }
            }
            this.unorderedChannelConnected = false;
            this.orderedChannel = undefined;
          }
        }
    }

    private handleUnorderedStatusChange(event: Event) {
        if (this.unorderedChannel) {
          const state = this.unorderedChannel.readyState;
      
          if (state === "open") {
            this.unorderedChannelConnected = true;

            if (this.connected) {
                serverLog("Client connected (ready to send): " + this.username);
                if (this.server.onConnect) {
                    this.server.onConnect(this);
                }
            }
          } else {
            if (this.connected) {
                serverLog("Client Disconnected: " + this.username);

                this.server.removeClient(this);
                if (this.server.onDisconnect) {
                    this.server.onDisconnect(this);
                }
            }
            this.unorderedChannelConnected = false;
            this.unorderedChannel = undefined;
          }
        }
    }

    /**
     * Send a text based message to the client on the ordered reliable channel
     * 
     * @param data The text to send
     */
    sendOrderedText(data: string) {
        if (this.orderedChannel) {
            this.orderedChannel.send(data);
        }
    }

    /**
     * Send a binary based message to the client on the ordered reliable channel
     * 
     * @param data The binary data to send
     */
    sendOrderedBinary(data: ArrayBuffer) {
        if (this.orderedChannel) {
            this.orderedChannel.send(data);
        }
    }

    /**
     * Send a text based message to the client on the unordered unreliable channel
     * 
     * @param data The text to send
     */
    sendUnorderedText(data: string) {
        if (this.unorderedChannel) {
            this.unorderedChannel.send(data);
        }
    }

    /**
     * Send a binary based message to the client on the unordered unreliable channel
     * 
     * @param data The binary data to send
     */
    sendUnorderedBinary(data: ArrayBuffer) {
        if (this.unorderedChannel) {
            this.unorderedChannel.send(data);
        }
    }
}

/**
 * The core server for the WebRTC peer to peer connect. This server listens for "connect"
 * messages from clients via the relay server. When it receives one it kicks off an 
 * offer/answer/candidate exchange (inside the client instance it creates) 
 * to identify how it can connect to the client. Once WebRTC is given enough information to 
 * connect the data channels created will become connected and the rest of the 
 * communication is done peer to peer.
 */
export class WebChannelServer {
    /** The clients that are currently connecting or connected to the server */
    readonly clients: WebChannelClient[] = [];
    /** The relay server we're using to communicate between the clients before the peer the connection is set up */
    readonly relayServer: RelayServer;
    /** The maximum time a packet will continue to be reset before we give up on the unreliable unordered channel (in ms) */
    maxPacketLifeTime: number = 250;

    /** Callback for the a client connecting to the server */
    onConnect?: (client: WebChannelClient) => void;
    /** Callback for the a client disconnected to the server */
    onDisconnect?: (client: WebChannelClient) => void;
    /** Callback for a text message received from a client on the ordered reliable channel */
    onOrderedText?: (client: WebChannelClient, text: string) => void;
    /** Callback for a binary message received from a client on the ordered reliable channel */
    onOrderedBinary?: (client: WebChannelClient, buffer: ArrayBuffer) => void;
    /** Callback for a text message received from a client on the unordered unreliable channel */
    onUnorderedText?: (client: WebChannelClient, text: string) => void;
    /** Callback for a binary message received from a client on the unordered unreliable channel */
    onUnorderedBinary?: (client: WebChannelClient, buffer: ArrayBuffer) => void;
    /** Callback for the server connecting to the relay server and being ready to accept connect requests */
    onStarted?: () => void;

    /** The next ID we'll assign to clients connecting */
    nextId: number = 1;

    constructor(serverId: string, relayServer: RelayServer) {
        this.relayServer = relayServer;

        // once we're connected to the relay server let listeners know so they
        // can tell the user we're ready to serve
        this.relayServer.onConnected = () => {
            serverLog("[NET-LIB] Server is connected to the Relay Server: " + serverId);
            if (this.onStarted) {
                this.onStarted();
            }
        };

        // The server instance only needs to process a single a message, "connect", this 
        // tells us that a client wants to connect. Once a connect is received
        // all further relay message process takes place in WebChannelClient so 
        // we simply pass any further messages to the right instance
        this.relayServer.onMessage = (from: string, message: any) => {
            if (message.type) {
                // The "connect" message tells us that a client is requesting to 
                // connect so spawn a client instance and begin the offer/answer 
                // process
                if (message.type === "connect") {
                    this.connectionRequest(from);
                } else {
                    const targetClient = this.clients.find(client => client.username === from);
                    if (targetClient) {
                        targetClient.onRelayMessage(from, message);
                    } else {
                        serverLog("Message received for unknown client: " + from + " " + message.type);
                    }
                }
            } else {
                serverLog(message);
            }
        };

        this.relayServer.start();
    }

    private connectionRequest(username: string): void {
        // A client has requested to connect so setup a client instance and
        // start the offer/answer process
        serverLog("Got connection request from: " + username);
        const remoteClient = new WebChannelClient(this.nextId++, this, username);
        this.clients.push(remoteClient);
    }

    /**
     * Remove a client from the server. This is called by the client instance
     * when it's channels have been closed
     * 
     * @param client The client to remove 
     */
    removeClient(client: WebChannelClient) {
        if (this.clients.includes(client)) {
            this.clients.splice(this.clients.indexOf(client), 1);
        }
    }
}