/**
 * The WebRTC Configuration for Peer Connection. What you see below if the default free configuration
 * I have from metered. Yes you can abuse it. Yes I will change the credentials at some point.
 * 
 * WebRTC works by trying to establish connections between peers. The peers hit the STUN server to determine
 * the possible ways they can be reached. This has 3 basic outcomes.
 * 
 * 1) The peers start sending packets at each other and they just immediately get through. This is unlikely 
 *    with games since players are rarely on the same network.
 * 
 * 2) The peers start sending packets to external address and one or both of the clients has a firewall that 
 *    supports UDP punch through. This means your router will accept UDP packets on a specific port from 
 *    a source that you've just sent packets to. So the client sends out packets from both sides and both
 *    routers accept the punch through and then can connect. This is pretty common on personal home networks, not
 *    so much for those running behind enterprise/corporate firewalls.
 * 
 * 3) The peers can't in any way connect to each other directly. This is where the TURN server comes in. If the clients
 *    can't talk to each other directly they can then agree a path through the TURN server which acts as a packet relay/proxy. All
 *    communications are then passed transparently through the TURN server.
 * 
 * Number 2 is why I think WebRTC data channels are a good fit for gaming. Most of the time peer to peer is going to work! :)
 */
export const RTC_CONFIG: RTCConfiguration = {
    iceServers: [
        {
            urls: "stun:relay.metered.ca:80",
        },
        {
            urls: "turn:relay.metered.ca:80",
            username: "bded59281eff9f4dbbcce696",
            credential: "yEOvO7UQK43EhF0B",
        },
        {
            urls: "turn:relay.metered.ca:443",
            username: "bded59281eff9f4dbbcce696",
            credential: "yEOvO7UQK43EhF0B",
        },
        {
            urls: "turn:relay.metered.ca:443?transport=tcp",
            username: "bded59281eff9f4dbbcce696",
            credential: "yEOvO7UQK43EhF0B",
        },
    ],
};