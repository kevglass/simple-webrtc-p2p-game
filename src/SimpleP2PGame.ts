import { SimpleGameMap } from "./SimpleGameMap";
import { ClientWorld } from "./model/ClientWorld";
import { Entity } from "./model/Entity";
import { ServerWorld } from "./model/ServerWorld";
import { WebChannel } from "./transport/WebChannel";
import { WebChannelServer } from "./transport/WebChannelServer";
import { WSRelayServer } from "./transport/WSRelayServer";
import { Util } from "./Util";

// Quick check for firefox since rendering there needs to have different
// css option to make pixelated scaling of sprites
declare let InstallTrigger: any;
var isFirefox = typeof InstallTrigger !== 'undefined';

// The scale up on the pixels - fixed at x2 scaling for now 
const SCALE = Util.isMobile() ? 1 : 2;

/**
 * A very simple demo "game" to try out networking with WebRTC. This has been deliberately done without
 * using my (or any other) rendering library to keep from getting distracted with engine issues. 
 */
export class SimpleP2PGame {
    /** The transport that we use if we're a server, it manages the connections and state */
    serverTransport?: WebChannelServer;
    /** The transport we use if we're a client, it manages the single connection (which is a pair of channels) to the server */
    clientTransport?: WebChannel;
    /** The image of the tiles we're using for the game - https://0x72.itch.io/dungeontileset-ii */
    tileset!: HTMLImageElement;
    /** The rendering context from the canvas we have on the screen */
    ctx!: CanvasRenderingContext2D;
    /** The HTML canvas we're rendering the sprites to */
    canvas!: HTMLCanvasElement;
    /** True once all resources are loaded - this just waits for the tileset to load at the moment */
    resourcesLoaded: boolean = false;


    /** True if we're actually in game - i.e. we're connected to a server */
    inGame: boolean = false;
    /** The username the player has. This is stored in localStorage and can be set by the player */
    username: string = "";
    /** The ID we're going to give to a server when we start it on the local machine */
    serverId: string | null;

    /** Frames of animation for the idle animation offset from the base of the character sprite */
    idle: number[] = [0, 1, 2, 3];
    /** Frames of animation for the run animation offset from the base of the character sprite */
    run: number[] = [4, 5, 6, 7];
    /** The animation counter used to index into the frames above and constantly incremented */
    anim: number = 0;

    /** The game world used client side */
    clientWorld?: ClientWorld;
    /** The game world used server side - note that when we run a server we're both a server and a client */
    serverWorld?: ServerWorld;

    /** A rubbish implementation of a game map - just used for tiles to render and collision checks with the edges */
    map: SimpleGameMap = new SimpleGameMap();

    /** The size we'll draw the mobile controller at */
    controllerSize: number = 50;

    /** The link to use to join the game */
    link: string = "";

    constructor() {
        // If the "join" URL parameter is set we're trying to join an existing server 
        const urlParams = new URLSearchParams(location.search);
        const join = urlParams.get("join");
        this.serverId = urlParams.get("server");

        // check if the username has been previous stored, if so use it, otherwise generate a random one
        // and use that instead
        const stored = localStorage.getItem("username");
        if (stored) {
            this.username = stored
        } else {
            this.username = Util.makeId(10);
            localStorage.setItem("username", this.username);
        }

        // setup the link area to copy to click board for the game link
        document.getElementById("serverLink")!.addEventListener("click", (event) => {
            this.copyLink();
            event.stopPropagation();
            event.preventDefault();
        });

        // set up the username field on the screen with the ability for the player to click it and change their
        // username
        document.getElementById("username")!.innerHTML = "Username: " + this.username;
        document.getElementById("username")!.addEventListener("click", (event) => {
            this.promptUsername();
            event.stopPropagation();
            event.preventDefault();
        });

        // if we're joining a server (the join parameter was set) then setup the server link and start the 
        // client connection procedure
        if (join) {
            this.serverId = join;
            document.getElementById("serverLink")!.innerHTML = location.href;
            this.joinServer();
        }

        // Grab the HTML canvas thats defined on the page and initialize the context for rendering
        // if either don't work then we might as well give up
        const canvas = document.getElementById("gamecanvas");
        if (canvas) {
            this.canvas = canvas as HTMLCanvasElement;
            const ctx = this.canvas.getContext('2d');
            if (ctx) {
                this.ctx = ctx;
            }
        }

        if (!this.ctx || !this.canvas) {
            alert("Failure to locate canvas");
            return;
        }

        // Add listeners for key controls, no mobile support yet
        window.addEventListener("keydown", (event) => { this.keyDown(event.key) });
        window.addEventListener("keyup", (event) => { this.keyUp(event.key) });

        // if we're on mobile add the listeners for touch
        if (Util.isMobile()) {
            this.canvas.addEventListener("touchstart", (event) => { this.touchDown(event) }, { passive: false });
            this.canvas.addEventListener("touchmove", (event) => { this.touchDown(event) }, { passive: false });
            this.canvas.addEventListener("touchend", (event) => { this.touchUp(event) }, { passive: false });
        }

        // Setup the canvas rendering context to do pixelated scaling of images so we keep
        // our pixel art look
        (<any>this.ctx).webkitImageSmoothingEnabled = false;
        this.ctx.imageSmoothingEnabled = false;
        (<any>this.canvas).style.fontSmooth = "never";
        (<any>this.canvas).style.webkitFontSmoothing = "none";

        if (isFirefox) {
            this.canvas.style.imageRendering = "crisp-edges";
        } else {
            this.canvas.style.imageRendering = "pixelated";
        }

        // finally load the tileset image and mark the loaded once we've got it
        this.tileset = new Image();
        this.tileset.onload = () => {
            this.resourcesLoaded = true;
        };
        this.tileset.src = "src/tileset.png";
    }

    /**
     * Copy the current server link if there is any
     */
    copyLink(): void {
        if (this.link && this.link.length > 0) { 
            navigator.clipboard.writeText(this.link);
            document.getElementById("serverLink")!.innerHTML = "Copied Link!";
            setTimeout(() => {
                document.getElementById("serverLink")!.innerHTML = this.link;
            }, 2000);
        }
    }

    /**
     * Prompt the user for a new username. If they provide one store it away for next time.
     */
    promptUsername(): void {
        const result = prompt("Enter a username");
        if (!result) {
            return;
        }
        this.username = result;
        localStorage.setItem("username", this.username);
        document.getElementById("username")!.innerHTML = "Username: " + this.username;

        window.location.reload();
    }

    /**
     * Join the game as a client. At this point we should have the name of the server
     * we're trying to connect to.
     */
    joinServer(): void {
        this.inGame = true;
        document.getElementById("serverLink")!.innerHTML = "Connecting to Server";

        // Create our transport from client to server. This uses the library code include in this project. We're
        // connecting to a server named this.serverId using our username. The Relay server is how the clients communicate
        // before they've made their peer to peer connect. The Relay server used here is a basic websocket server 
        // but could be anything that you can host to pass messages between server and clients.
        this.clientTransport = new WebChannel(this.username, this.serverId!, new WSRelayServer(this.username));

        // The client connection will eventually connect, at that point we want start the client world - the game
        // that the client is using to keep track of state.
        this.clientTransport.onConnect = (client) => {
            console.log("Connect to server: " + client.target);

            if (this.serverWorld) {
                let base = location.href;
                if (base.includes("?")) {
                    base = base.substring(0, base.lastIndexOf("?"));
                }

                this.link = base + "?join=" + this.serverId;
                document.getElementById("serverLink")!.innerHTML = this.link;
            } else {
                this.link = location.href;
                document.getElementById("serverLink")!.innerHTML = this.link;
            }

            this.clientWorld = new ClientWorld(this.clientTransport!, this.map);
        }

        this.clientTransport.onDisconnect = (client) => {
            alert("Server Disconnected");
            window.location.reload();
        };
    }

    /**
     * Start the game server locally. 
     */
    startServer(): void {
        // create a random ID for the server
        this.inGame = true;
        if (!this.serverId) {
            this.serverId = Util.makeId(10);
        }

        document.getElementById("serverLink")!.innerHTML = "Starting Local Server";

        // Start the network layer for the server. This won't do much other than connect to the relay server provided.
        // It's not until a client tries to connect (via the relay server) that the peer to peer communication setup
        // is performed. The Relay server used here is a basic websocket server 
        // but could be anything that you can host to pass messages between server and clients.
        this.serverTransport = new WebChannelServer(this.serverId, new WSRelayServer(this.serverId));
        this.serverTransport.onStarted = () => {
            document.getElementById("serverLink")!.innerHTML = "Local Server Started, joining";

            // once the server is started we can create a game world that represents game state on the server
            this.serverWorld = new ServerWorld(this.serverTransport!, this.map, location.hostname === "localhost");

            // At this point we can connect the local client to the local server. Even local clients are treated the same
            // as remote clients and send communications across the network. However, since WebRTC does a good job of finding
            // the best path a local to local connection is zero packet loss.
            setTimeout(() => {
                this.joinServer();
            }, 1000);
        };
    }

    private getTouchInCanvasCoordinates(event: TouchEvent): { x: number, y: number } | undefined{
        if (event.target) {
            const rect = (<any>event.target).getBoundingClientRect();
            let x = event.targetTouches[0].pageX - rect.left;
            let y = event.targetTouches[0].pageY - rect.top;
            const width: number = this.canvas.clientWidth;
            const height: number = this.canvas.clientHeight;

            x = Math.floor((x / width) * this.canvas.width);
            y = Math.floor((y / height) * this.canvas.height);

            return { x, y };
        }

        return undefined;
    }

    private applyControl(x: number, y: number): void {
        if (this.clientWorld) {
            const localEntity = this.clientWorld.getLocalEntity();
            if (localEntity) {
                const zoneSize = ((this.controllerSize * 2) / 3);
                localEntity.up = false;
                localEntity.down = false;
                localEntity.left = false;
                localEntity.right = false;

                if (y <= zoneSize) { // top row so pressing up 
                    localEntity.up = true;
                }
                if (y >= zoneSize * 2) { // bottom row so pressing down 
                    localEntity.down = true;
                }
                if (x <= zoneSize) { // left column so pressing left
                    localEntity.left = true;
                }
                if (x >= zoneSize * 2) { // right column so pressing right
                    localEntity.right = true;
                }
            }
        }

    }
    private touchDown(event: TouchEvent): void {
        const pt = this.getTouchInCanvasCoordinates(event);

        if (pt) {
            if (!this.inGame) {
                console.log(pt);
                console.log(this.canvas.height);
                if (pt.y < this.canvas.height) {
                    this.startServer();
                    event.stopPropagation();
                    event.preventDefault();
                    return;
                }
            }

            if (pt.y > this.canvas.height - 20 - (this.controllerSize * 2) && pt.y < this.canvas.height - 20) {
                // left controller
                if (pt.x > 20 && pt.x < 20 + (this.controllerSize * 2)) {
                    pt.x -= 20;
                    pt.y -= this.canvas.height - 20 - (this.controllerSize * 2);

                    this.applyControl(pt.x, pt.y);
                    event.stopPropagation();
                    event.preventDefault();
                }
                // left controller
                else if (pt.x > this.canvas.width - 20 - (this.controllerSize * 2) && pt.y < this.canvas.width - 20) {
                    pt.x -= this.canvas.width - 20 - (this.controllerSize * 2);
                    pt.y -= this.canvas.height - 20 - (this.controllerSize * 2);

                    this.applyControl(pt.x, pt.y);
                    event.stopPropagation();
                    event.preventDefault();
                }
            }
        }
    }

    private touchUp(event: TouchEvent): void {
        if (this.clientWorld) {
            const localEntity = this.clientWorld.getLocalEntity();
            if (localEntity) {
                localEntity.up = false;
                localEntity.down = false;
                localEntity.left = false;
                localEntity.right = false;
            }
        }
    }

    /**
     * Notification that a key was pressed down
     * 
     * @param key The key code that was pressed down
     */
    private keyDown(key: string): void {
        if (!this.inGame) {
            // if we're not in game then we can start a server by pressing S
            if (key === "s") {
                this.startServer();
            }
        }

        if (this.clientWorld) {
            const localEntity = this.clientWorld.getLocalEntity();
            if (localEntity) {
                if (key === "ArrowUp" || key === "w") {
                    localEntity.up = true;
                }
                if (key === "ArrowDown" || key === "s") {
                    localEntity.down = true;
                }
                if (key === "ArrowLeft" || key === "a") {
                    localEntity.left = true;
                }
                if (key === "ArrowRight" || key === "d") {
                    localEntity.right = true;
                }
            }
        }
    }

    /**
     * Notification that a key was released
     * 
     * @param key The key code that was released
     */
    private keyUp(key: string): void {
        if (this.clientWorld) {
            const localEntity = this.clientWorld.getLocalEntity();
            if (localEntity) {
                if (key === "ArrowUp" || key === "w") {
                    localEntity.up = false;
                }
                if (key === "ArrowDown" || key === "s") {
                    localEntity.down = false;
                }
                if (key === "ArrowLeft" || key === "a") {
                    localEntity.left = false;
                }
                if (key === "ArrowRight" || key === "d") {
                    localEntity.right = false;
                }
            }
        }
    }

    /**
     * Start the animation loop. I always put start() as a separate method to the constructor more out of 
     * habit than anything else.
     */
    start(): void {
        // we're going to render/update at whatever rate the screen works. This currently
        // means players could move at different speeds. it's not something I'm trying to fix here
        requestAnimationFrame(() => { this.render() });
    }

    /**
     * Draw a tile from our tileset to the canvas rendering context
     * 
     * @param x The x position to draw the tile at
     * @param y The y position to draw the tile at 
     * @param tile The index of the tile into the tileset to draw
     * @param width The width of the tile (default 16)
     * @param height The height of the tile (default 16)
     */
    drawTile(x: number, y: number, tile: number, width: number = 16, height: number = 16): void {
        const scanline = Math.floor(this.tileset.width / 16)
        this.ctx.drawImage(this.tileset, (tile % scanline) * 16, Math.floor(tile / scanline) * 16, width, height, x, y, width, height);
    }

    /**
     * The main render loop where everything happens. This should really be controlled to only run
     * at a fixed rate.
     */
    render(): void {
        // Update the animation progress to keep things moving
        this.anim += 0.1;

        if (this.resourcesLoaded) {
            // scale the canvas to fit the screen but keep our pixel scaling intact
            this.canvas.width = Math.floor(window.innerWidth / SCALE);
            this.canvas.height = Math.floor(window.innerHeight / SCALE);

            this.ctx.save();

            // center the map on the screen as best we can
            this.ctx.translate(Math.floor((this.canvas.width - (this.map.width * 16)) / 2), Math.floor((this.canvas.height - (this.map.height * 16)) / 2))

            // draw all the tiles from the map
            for (let y = 0; y < this.map.height; y++) {
                for (let x = 0; x < this.map.width; x++) {
                    if (y !== 0) {
                        this.drawTile(x * 16, y * 16, this.map.getFloor(x, y));
                    }
                    const t = this.map.getTile(x, y);
                    if (t !== 0) {
                        this.drawTile(x * 16, y * 16, t);
                    }
                }
            }

            // if we're not in game yet display a message telling people they can 
            // start a server
            if (!this.inGame) {
                this.ctx.fillStyle = "white";
                this.ctx.font = "20px Arial";

                if (Util.isMobile()) {
                    this.ctx.fillText("Tap to Start Server", 150, 180);
                } else {
                    this.ctx.fillText("Press S to Start Server", 130, 180);
                }
            }

            // If we've connected as a client then we want to render all the entities
            // at the positions we know about
            if (this.clientWorld) {
                const sorted = [...this.clientWorld.entities].sort((a: Entity, b: Entity) => {
                    return a.y - b.y;
                });

                for (const entity of sorted) {
                    // check if the entity was moving in the last frame - if it was
                    // then use the running animation instead of the idle one
                    let action: number[] = this.idle;
                    let frame = Math.floor(this.anim);
                    if (entity.moving) {
                        action = this.run;
                        frame = Math.floor(this.anim * 2);
                    }

                    // render the entities - flipping if required - and a name tag.
                    this.ctx.save();
                    this.ctx.translate(Math.floor(entity.x), Math.floor(entity.y));
                    if (entity.faceLeft) {
                        this.ctx.scale(-1, 1);
                        this.drawTile(-16, 0, ((entity.type - 1) * 64) + 8 + (action[frame % action.length]), 16, 32);
                        this.ctx.scale(-1, 1);
                    } else {
                        this.drawTile(0, 0, ((entity.type - 1) * 64) + 8 + (action[frame % action.length]), 16, 32);
                    }

                    this.ctx.restore();
                }
                for (const entity of this.clientWorld.entities) {
                    this.ctx.save();
                    this.ctx.translate(Math.floor(entity.x), Math.floor(entity.y));
                    if (this.clientWorld.nameById[entity.id]) {
                        this.ctx.fillStyle = "white";
                        this.ctx.font = "10px Arial";

                        const metrics = this.ctx.measureText(this.clientWorld.nameById[entity.id]);
                        this.ctx.fillText(this.clientWorld.nameById[entity.id], 8 - Math.floor(metrics.width / 2), 0);
                    }
                    this.ctx.restore();
                }
            }
            this.ctx.restore();

            if (Util.isMobile()) {
                this.ctx.strokeStyle = "rgba(255,255,255,0.5)";
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.arc(this.canvas.width - (this.controllerSize + 20), this.canvas.height - (this.controllerSize + 20), this.controllerSize, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.beginPath();
                this.ctx.arc((this.controllerSize + 20), this.canvas.height - (this.controllerSize + 20), this.controllerSize, 0, Math.PI * 2);
                this.ctx.stroke();

                this.ctx.beginPath();
                this.ctx.fillStyle = "rgba(255,255,255,0.5)";
                this.ctx.arc(this.canvas.width - (this.controllerSize + 20), this.canvas.height - (this.controllerSize + 20), this.controllerSize / 3, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.beginPath();
                this.ctx.fillStyle = "rgba(255,255,255,0.5)";
                this.ctx.arc((this.controllerSize + 20), this.canvas.height - (this.controllerSize + 20), this.controllerSize / 3, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        // request the next frame
        requestAnimationFrame(() => { this.render() });
    }
}