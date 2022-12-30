# simple-webrtc-p2p-game
Simple sample of using WebRTC for P2P gaming in the browser

![game](https://user-images.githubusercontent.com/3787210/210056775-502275de-c875-4458-92c1-041d1c39f581.png)

# Introduction

This project was created in a 8 hours to test the potentional for using WebRTC peer to peer connections for real time browser based game. It seems like its pretty possible. The code is intended as a very naive example of whats possible and only uses standard browser APIs to render the game as to remove any game engine or graphics library bias. 

The game consists of players in a world moving around. Thats really it :) 

At time of writing there is no client side interpolation implemented nor any snapshotting or dead reckoning. This means that most of the time its fine but when a player changes direction quickly there can be a bit of warping. I'll try and find time to fix that up.


