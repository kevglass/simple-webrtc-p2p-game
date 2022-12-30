# simple-webrtc-p2p-game
Simple sample of using WebRTC for P2P gaming in the browser

![game](https://user-images.githubusercontent.com/3787210/210056775-502275de-c875-4458-92c1-041d1c39f581.png)

## Introduction

This project was created in a 8 hours to test the potentional for using WebRTC peer to peer connections for real time browser based game. It seems like its pretty possible. The code is intended as a very naive example of whats possible and only uses standard browser APIs to render the game as to remove any game engine or graphics library bias. 

The game consists of players in a world moving around. Thats really it :) 

At time of writing there is no client side interpolation implemented nor any snapshotting or dead reckoning. This means that most of the time its fine but when a player changes direction quickly there can be a bit of warping. I'll try and find time to fix that up.

The code is split out as to make the WebRTC components reusable, but you're best to simply take a copy and work out the finer details as you build your game. 

Hope this helps someone as it did me.

## How it Works

The following shows the setup procedure between server and client via the relay server. The following definitions apply:

- Peer = One of the browsers running the game
- Relay Server = A server that all the peer's can access and can pass messages for them before peer to peer connections are setup
- Server = WebRTC server running on one of the peers.
- Client = WebRTC client running on each peer.

Note that a player who is running the server is running both a Server and a Client. They are in fact connecting to their own server.

Here's a sequence diagram of the setup. If you haven't seen one before read from top to bottom (time axis):

![image](https://user-images.githubusercontent.com/3787210/210059047-4b2005bd-6af0-4704-8a49-74bd888136cb.png)

## Exercises for the reader

- Add server validation of client inputs - This is dependent on your game, how do you know if an action the player took is valid?
- Add client side interpolation - should be pretty easy, I might even do this.
- Add projectiles - that'll get interesting!
- Add authentication and registration - probably on the relay server?
- Add server side correction of positions - right now the client has free reign. If something happens server side that changes the clients position we want to send that client an update (probably reliable?) that corrects the position.
- Test if the WebRTC server components can run on nodejs - should be able to, but I never tried it.

