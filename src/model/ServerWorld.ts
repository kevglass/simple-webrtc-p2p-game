import { WebChannelServer, WebChannelClient } from "src/transport/WebChannelServer";
import { AbstractWorld, DOWN, LEFT, RIGHT, UP, SERVER_UPDATES_PER_SECOND } from "./AbstractWorld";
import { Entity } from "./Entity";
import { WorldMap } from "./WorldMap";

/**
 * The game world as viewed from the server. It maintains the entities based on the updates
 * from the connected clients. 
 */
export class ServerWorld extends AbstractWorld {
    /** The server transport we're using to have clients connect */
    server: WebChannelServer;
    /** The ID we'll use next when we create an entity */
    nextEntityId: number = 1;
    /** Mapping from the client ID to the entity it controls */
    clientToEntity: Record<number, Entity> = {};
    /** The next sequence number we'll use when sending an update */
    sequenceNumber: number = 0;

    /** Indicates whether we're going to simulate network issues - on the localhost we simulate 500ms max delay and 5% packet loss to keep us honest */
    private simulateNetworkDelayAndLoss: boolean = true;
    /** The amount of packet loss to simulate */
    private simulatedPacketLoss: number = 0.05;

    constructor(server: WebChannelServer, map: WorldMap, simulateNetworkDelayAndLoss: boolean = false) {
        super(map, 1);

        this.server = server;
        this.simulateNetworkDelayAndLoss = simulateNetworkDelayAndLoss;
        
        if (simulateNetworkDelayAndLoss) {
            console.log("Simulating Network Delay and Loss");
            console.log("  Max Delay: " + this.server.maxPacketLifeTime + "ms");
            console.log("  Packet Loss: " + (this.simulatedPacketLoss * 100)+"%");
        }
        this.server.onConnect = (client: WebChannelClient) => {
            this.clientConnected(client);
        }
        this.server.onDisconnect = (client: WebChannelClient) => {
            this.clientDisconnected(client);
        }

        this.server.onUnorderedBinary = (client: WebChannelClient, data: ArrayBuffer) => {
            this.clientStateReceived(client, data);
        }

        // Loop to send out state updates to the clients at a rate
        // of UPDATES_PER_SECOND
        setInterval(() => {
            // increase out sequence number for this update and manually
            // overflow it since we're sticking it in a 16 unsigned int
            this.sequenceNumber++;
            if (this.sequenceNumber > 50000) {
                this.sequenceNumber = 0;
            }

            // If we're simulating network issues when we either drop the packet (packet loss)
            // or we randomize the delay the packet has. This is similar to what will happen on 
            // a poor network
            if (this.simulateNetworkDelayAndLoss) {
                if (Math.random() > this.simulatedPacketLoss) {
                    const delay = Math.floor(Math.random() * (this.server.maxPacketLifeTime / 2));

                    // we have to record the sequence number here or when the timeout 
                    // fires we'll send whatever the current sequence number is
                    const buffer = this.createState(this.sequenceNumber);
                    setTimeout(() => {
                        this.sendToAll(buffer);
                    }, delay);
                }
            } else {
                this.sendToAll(this.createState(this.sequenceNumber));
            }

            // finally move the entities based on the current state
            this.moveEntities();
        }, 1000 / SERVER_UPDATES_PER_SECOND);
    }

    sendToAll(buffer: Uint16Array): void {
        for (const client of this.server.clients) {
            if (!client.connected) {
                continue;
            }

            client.sendUnorderedBinary(buffer);
        }
    }

    /**
     * Create the current game state to send the clients
     * 
     * @param sequence The sequence number to use
     * @return The array buffer of binary state information
     */
    createState(sequence: number): Uint16Array {
        const data: number[] = [];
        data.push(sequence);
        for (const entity of this.entities) {
            // encode the entity 
            data.push(entity.id);
            data.push(entity.x);
            data.push(entity.y);
            data.push(entity.type);

            let controls = 0;
            controls += entity.left ? LEFT : 0;
            controls += entity.right ? RIGHT : 0;
            controls += entity.up ? UP : 0;
            controls += entity.down ? DOWN : 0;
            data.push(controls);
        }

        const buffer = new Uint16Array(data);
        return buffer;
    }

    clientStateReceived(client: WebChannelClient, buffer: ArrayBuffer) {
        // client state from a given client for their entity. Apply it to the
        // entity we hold so it'll be sent to clients as part of the state updates
        const array = new Uint16Array(buffer);
        const entity = this.clientToEntity[client.id];
        if (entity) {
            // don't allow the entity to move to a blocked area - first bit of server
            // side checking
            if (!this.map.blockedAt(array[0], array[1])) {
                const left: boolean = (array[2] & LEFT) !== 0;
                const right: boolean = (array[2] & RIGHT) !== 0;
                const up: boolean = (array[2] & UP) !== 0;
                const down: boolean = (array[2] & DOWN) !== 0;

                entity.updateState(array[0], array[1], entity.type, left, right, up, down);
            } 
        }
    }

    clientDisconnected(client: WebChannelClient) {
        // clean up the entity if a client disconnects, removing it from the
        // model means that the clients will clean it up too
        const entity = this.clientToEntity[client.id];
        if (entity) {
            this.entities.splice(this.entities.indexOf(entity), 1);
            delete this.clientToEntity[client.id];
        }
    }

    clientConnected(client: WebChannelClient) {
        // a new client has connected so create a new entity to represent 
        // them
        const entity = new Entity(this.nextEntityId++, 100 + Math.floor(Math.random() * 100), 100 + Math.floor(Math.random() * 100), 1 + Math.floor(Math.random() * 8));
        
        // tell the client which ID relates to their entity
        this.sendReliable(client, {
            type: "time",
            seq: this.sequenceNumber
        });
        
        // tell the client which ID relates to their entity
        this.sendReliable(client, {
            type: "identify",
            entityId: entity.id
        });

        // send everyone the new name and this new one all the existing names
        this.sendAllReliable({
            type: "name",
            entityId: entity.id,
            name: client.username
        });

        // send the new client the names associated with all entities so they have a full list
        for (const other of this.server.clients) {
            if (client !== other) {
                const entity = this.clientToEntity[other.id];
                if (entity) {
                    this.sendReliable(client, {
                        type: "name",
                        entityId: entity.id,
                        name: other.username
                    });
                }
            }
        }

        // store the entity in the model
        this.clientToEntity[client.id] = entity;
        this.entities.push(entity);
    }

    /**
     * Send a message on the reliable/ordered channel 
     * 
     * @param client The client to send the message to
     * @param data The content to send 
     */
    sendReliable(client: WebChannelClient, data: any) {
        // just going to serialize the data into JSON
        client.sendOrderedText(JSON.stringify(data));
    }
    
    /**
     * Send a message to all clients on the reliable/ordered channel
     * 
     * @param data The content to send to all clients
     */
    sendAllReliable(data: any) {
        for (const client of this.server.clients) {
            if (client.connected) {
                // just going to serialize the data into JSON
                client.sendOrderedText(JSON.stringify(data));
            }
        }
    }
}