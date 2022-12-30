/**
 * Description of a relay server implementation. Theres on packaged with this demo that uses
 * websockets but how your relay server works is really up to the game and server technologies
 * in use.
 * 
 * The relay server is responsible for passing signalling between clients and servers before
 * the peer to peer connection has been established. Before the clients can talk to each other 
 * they must first exchange enough information (ports/ips etc) to be able to send packets
 * to each other.
 * 
 * The relay server simply passes text content between named clients. The version in this demo
 * is totally unauthenticated so doesn't stop anyone using anyone elses name etc.
 */
export interface RelayServer {
    /** The username this client of the relay server has used */
    username: string;
    /** True if we're connected to the relay server */
    connected: boolean;
    /** Callback for when a message is received */
    onMessage?: (from: string, message: any) => void;
    /** Callback for when the relay server has been connected to */
    onConnected?: () => void;
    /** Callback for when the relay server has disconnected */
    onDisconnected?: () => void;

    /**
     * Send a message to a specific target user
     * 
     * @param target The username of the target user (or server)
     * @param message The message to send.
     */
    sendMessage(target: string, message: any): void;

    /**
     * Start the server. This is just a hook for server implementation
     * to put the connection code in.
     */
    start(): void;
}