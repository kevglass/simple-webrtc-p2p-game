import { io, Socket } from "socket.io-client";
import { relayLog } from "./NetLog";
import { RelayServer } from "./RelayServer";

/**
 * A simple websocket implementation of a relay server client. I'm running a very simple
 * server (for which the code is provided https://github.com/kevglass/simple-webrtc-p2p-game-relay) 
 * on AWS for free at the moment. It essentially accepts websocket connections and forwards packets 
 * between them.
 */
export class WSRelayServer implements RelayServer {
    /** The web socket we're using to talk to the relay server */
    private socket?: Socket;
    /** The address of the relay server - this is using my free AWS one */
    host: string = "https://node4.cokeandcode.com";
    /** The username we're presenting to the relay server */
    username: string;
    /** True if we're connected */
    connected: boolean = false;
    /** Callback for when a message is received */
    onMessage?: (from: string, message: any) => void;
    /** Callback for when the relay server has been connected to */
    onConnected?: () => void;
    /** Callback for when the relay server has disconnected */
    onDisconnected?: () => void;

    constructor(username: string) {
        this.username = username;
    }

    sendMessage(target: string, message: any): void {
        this.socket?.emit("message", {
            to: target,
            message
        });
    }

    start(): void {
        this.socket = io(this.host, {
            reconnection: false,
            auth: {
                version: "_VERSION_",
                relay: true,
                name: this.username
            }
        });

        this.socket.on("connect", () => {
            relayLog("Connected to relay server as " + this.username);
            this.connected = true;
            
            if (this.onConnected) {
                this.onConnected();
            }
        });

        this.socket.on("message", (data) => {
            if (this.onMessage) {
                this.onMessage(data.from, data.message);
            } else {
                relayLog("Got message from: " + data.from + " without a handler");
            }
        })

        this.socket.on("disconnect", () => {
            relayLog("Disconnected from relay server");
            this.connected = false;

            if (this.onDisconnected) {
                this.onDisconnected();
            }
        });
    }
}