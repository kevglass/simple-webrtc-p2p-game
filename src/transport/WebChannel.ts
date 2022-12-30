import { clientLog } from "./NetLog";
import { RelayServer } from "./RelayServer";
import { RTC_CONFIG } from "./RtcConfiguration";

/**
 * The client side of the WebRTC peer to peer network. The channel sets up communication 
 * with a server running on a peered browser. The channel actually consists of two
 * WebRTC data channels, one for ordered reliable communications and one for unordered 
 * unreliable communication - the later being ideal for real time game updates.
 * 
 * The channel relies on a Relay Server to send and receive handshake/signalling information
 * with its peer. 
 */
export class WebChannel {
    /** The username that this web channel is identifying as on the relay server */
    readonly username: string;
    /** The relay server that is being used for signalling */
    readonly relayServer: RelayServer;
    /** The name of the server we're connecting to (the name registered with the relay server) */
    readonly target: string;
    /** The WebRTC Peer Connection to the remote peer */
    private remoteConnection?: RTCPeerConnection;
    /** The WebRTC Data Channel that we're using for unordered unreliable communications */
    private unorderedChannel?: RTCDataChannel;
    /** The WebRTC Data Channel that we're using for order reliable communications */
    private orderedChannel?: RTCDataChannel;

    /** Callback for the connection to the server being established */
    onConnect?: (client: WebChannel) => void;
    /** Callback for the connection to the server being disconnected */
    onDisconnect?: (client: WebChannel) => void;
    /** Callback for reception of a text based message on the unordered unreliable channel */
    onUnorderedText?: (client: WebChannel, text: string) => void;
    /** Callback for reception of a binary message on the unordered unreliable channel */
    onUnorderedBinary?: (client: WebChannel, buffer: ArrayBuffer) => void;
    /** Callback for reception of a text based message on the ordered reliable channel */
    onOrderedText?: (client: WebChannel, text: string) => void;
    /** Callback for reception of a binary message on the ordered reliable channel */
    onOrderedBinary?: (client: WebChannel, buffer: ArrayBuffer) => void;

    constructor(username: string, target: string, relayServer: RelayServer) {
        this.username = username;
        this.target = target;

        this.relayServer = relayServer;

        // once the relay server has connected we can request the server start
        // the connection process by sending the "connect" message
        this.relayServer.onConnected = () => {
            clientLog("Client is connected to the Relay Server: " + username);

            clientLog("Connecting to server: " + target);
            this.relayServer.sendMessage(target, {
                type: "connect"
            });
        };

        this.relayServer.onDisconnected = () => {
            clientLog("Client Disconnected");
            alert("Relay Server Disconnected, name may be in use");
        }

        // callback for the relay server - we're going to process two types of 
        // message from the server - one that describes its capabilities in SDP called
        // the "offer" and one that gives us detail of one potential way of connecting
        // to it called the "candidate" 
        this.relayServer.onMessage = (from: string, message: any) => {
            if (from === target) {
                if (message.type) {
                    if (message.type === "offer") {
                        this.startConnection(message.offer);
                    } else if (message.type === "candidate") {
                        clientLog("Candidate for connection: " + JSON.stringify(message.candidate))
                        this.remoteConnection?.addIceCandidate(message.candidate);
                    } else {
                        clientLog("Unknown message type: " + message.type)
                    }
                } else {
                    clientLog(message);
                }
            } else {
                // ignore messages that aren't intended for us
                clientLog("Received message for unsubscribed client: " + from);
            }
        };

        this.relayServer.start();
    }

    public get connected(): boolean {
        return !!this.orderedChannel && !!this.unorderedChannel;
    }

    private startConnection(offer: any): void {
        // this is the core piece of WebRTC going on for the client. We create a
        // peer connection - thats WebRTCs point to point connection. We then ask
        // that peer connection to describe it self. This description is provided 
        // in two phases - the main description which set outs the codecs etc to
        // use and the candidates which describe the different network paths
        // (direct, punchthrough/stun, turn) on which the client can be contacted 
        // (these are called candidates)
        this.remoteConnection = new RTCPeerConnection(RTC_CONFIG);
        this.remoteConnection.onicecandidate = (e) => {
            // Whenever the local side determines an candidate tell the remote
            // side about it via the relay server so it can make use of it
            // to connect
            this.relayServer.sendMessage(this.target, {
                type: "candidate",
                candidate: e.candidate
            })
        }

        this.remoteConnection.setRemoteDescription(offer)
            .then(() => this.remoteConnection!.createAnswer())
            .then((answer) => this.remoteConnection!.setLocalDescription(answer))
            .then(() =>
                // once the local side has made up its description, tell the 
                // remote side via the relay server so it can use it to 
                // connect
                this.relayServer.sendMessage(this.target, {
                    type: "answer",
                    answer: this.remoteConnection?.localDescription
                }));

        // the server is responsible for creating the WebRTC data channels
        // that we'll use to communicate. So here on the client we'll
        // get notifications of the creation and need to hold on to the
        // channels to communicate peer to peer
        this.remoteConnection.ondatachannel = (event) => {
            if (event.channel.label === "unordered") {
                this.receiveUnorderedChannel(event);
            }
            if (event.channel.label === "ordered") {
                this.receiveOrderedChannel(event);
            }
        }
    }

    private receiveOrderedChannel(event: RTCDataChannelEvent) {
        // we've got the channel from the server to be used
        // for ordered reliable traffic. Setup the callbacks
        // so we can be notified of open/close and messages
        // received
        this.orderedChannel = event.channel;
        clientLog("Received data channel setup from (ordered) : " + this.target);

        this.orderedChannel.onmessage = (event) => {
            this.handleOrderedReceiveMessage(event);
        };
        this.orderedChannel.onopen = (event) => {
            this.handleOrderedReceiveChannelStatusChange(event);
        };
        this.orderedChannel.onclose = (event) => {
            this.handleOrderedReceiveChannelStatusChange(event);
        };
    }

    private receiveUnorderedChannel(event: RTCDataChannelEvent) {
        // we've got the channel from the server to be used
        // for unordered unreliable traffic. Setup the callbacks
        // so we can be notified of open/close and messages
        // received
        this.unorderedChannel = event.channel;
        clientLog("Received data channel setup from (unordered) : " + this.target);

        this.unorderedChannel.onmessage = (event) => {
            this.handleUnorderedReceiveMessage(event);
        };
        this.unorderedChannel.onopen = (event) => {
            this.handleUnorderedReceiveChannelStatusChange(event);
        };
        this.unorderedChannel.onclose = (event) => {
            this.handleUnorderedReceiveChannelStatusChange(event);
        };
    }

    private handleUnorderedReceiveMessage(event: MessageEvent): void {
        // we can send text or binary on the channel and we only
        // know which one we're receiving based on the type 
        // of the data presented
        if (this.onUnorderedText && typeof event.data === "string") {
            this.onUnorderedText(this, event.data);
        } else if (this.onUnorderedBinary) {
            this.onUnorderedBinary(this, event.data);
        } else {
            clientLog("Data received from: " + this.target + " with no handler set");
        }
    }

    private handleOrderedReceiveMessage(event: MessageEvent): void {
        // we can send text or binary on the channel and we only
        // know which one we're receiving based on the type 
        // of the data presented
        if (this.onOrderedText && typeof event.data === "string") {
            this.onOrderedText(this, event.data);
        } else if (this.onOrderedBinary) {
            this.onOrderedBinary(this, event.data);
        } else {
            clientLog("Data received from: " + this.target + " with no handler set");
        }
    }

    private handleUnorderedReceiveChannelStatusChange(event: Event) {
        if (this.unorderedChannel) {
            const state = this.unorderedChannel.readyState;

            if (state === "open") {
                clientLog("Connection to Server Open (ready to send - unordered): " + this.target);

                if (this.onConnect && this.connected) {
                    this.onConnect(this);
                }
            } else {
                if (this.connected) {
                    clientLog("Connection to Server Closed (ordered): " + this.target);

                    if (this.onDisconnect) {
                        this.onDisconnect(this);
                    }
                }
                this.unorderedChannel = undefined;
            }
        }
    }

    private handleOrderedReceiveChannelStatusChange(event: Event) {
        if (this.orderedChannel) {
            const state = this.orderedChannel.readyState;

            if (state === "open") {
                clientLog("Connection to Server Open (ready to send - ordered): " + this.target);

                if (this.onConnect && this.connected) {
                    this.onConnect(this);
                }
            } else {
                if (this.connected) {
                    clientLog("Connection to Server Closed (ordered): " + this.target);
                    if (this.onDisconnect) {
                        this.onDisconnect(this);
                    }
                }

                this.orderedChannel = undefined;
            }
        }
    }

    /**
     * Send a text based message to the server on the ordered reliable channel
     * 
     * @param data The text to send
     */
    sendOrderedText(data: string) {
        if (this.orderedChannel) {
            this.orderedChannel.send(data);
        }
    }

    /**
     * Send a binary based message to the server on the ordered reliable channel
     * 
     * @param data The binary data to send
     */
    sendOrderedBinary(data: ArrayBuffer) {
        if (this.orderedChannel) {
            this.orderedChannel.send(data);
        }
    }

    /**
     * Send a text based message to the server on the unordered unreliable channel
     * 
     * @param data The text to send
     */
    sendUnorderedText(data: string) {
        if (this.unorderedChannel) {
            this.unorderedChannel.send(data);
        }
    }

    /**
     * Send a binary based message to the server on the unordered unreliable channel
     * 
     * @param data The binary data to send
     */
    sendUnorderedBinary(data: ArrayBuffer) {
        if (this.unorderedChannel) {
            this.unorderedChannel.send(data);
        }
    }
}