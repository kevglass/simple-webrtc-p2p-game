import { WebChannel } from "src/transport/WebChannel";
import { AbstractWorld, DOWN, LEFT, RIGHT, UP, SERVER_UPDATES_PER_SECOND, CLIENT_UPDATES_PER_SECOND } from "./AbstractWorld";
import { Entity } from "./Entity";
import { WorldMap } from "./WorldMap";

/**
 * Represents the game world from the client point of view. Responsible for updating the entities 
 * in the game based on the state from the server and sending the state of the local entity up to the
 * server. 
 */
export class ClientWorld extends AbstractWorld {
    /** The channel we're using to communicate with the server */
    client: WebChannel;
    /** The ID of our local entity, the one we'll be controlling */
    myId: number = 0;
    /** The last sequence number we've received - anything that arrives before that is not much use to us */
    lastSequenceNumber: number = 0;
    /** The text label / name given to any given entity by the server */
    nameById: Record<number, string> = {};
    /** The sequence number we think we're at with client side prediction */
    localSequenceNumber: number = 0;

    constructor(client: WebChannel, map: WorldMap) {
        super(map, SERVER_UPDATES_PER_SECOND / CLIENT_UPDATES_PER_SECOND);

        this.client = client;

        client.onUnorderedBinary = (client: WebChannel, buffer: ArrayBuffer) => {
            this.handleState(buffer);
        };
        client.onOrderedText = (client: WebChannel, text: string) => {
            this.handleReliable(text);
        }

        // We're going to send our state to the server at the same rate 
        // as the server is sending out updates. We'll first move our entities
        // then send the current state of any entity we own (currently only myId) 
        // to the server
        setInterval(() => {
            this.sendState();
        }, 1000 / SERVER_UPDATES_PER_SECOND);

        setInterval(() => {
            this.moveEntities();
            // if we've identified our point in time then move it forward since
            // we're predicting client movement
            if (this.localSequenceNumber !== 0) {
                this.localSequenceNumber += SERVER_UPDATES_PER_SECOND / CLIENT_UPDATES_PER_SECOND;
            }
        }, 1000 / CLIENT_UPDATES_PER_SECOND);
    }

    /**
     * Get the entity that we control if we know of one. Most of the time
     * the server can trust what we send it about our entity (controls and position)
     * but it will need to validate that we're not cheating and send us an 
     * override (not currently implemented) when something happens to change
     * our position server side.
     * 
     * @returns The entity we're controlling
     */
    getLocalEntity(): Entity | undefined {
        return this.entities.find(entity => entity.id === this.myId);;
    }

    /**
     * Send the state associated with the entity we're controlling if we know
     * which one that is
     */
    sendState(): void {
        const entity = this.getLocalEntity();
        if (entity) {
            // we're going to encode the state into binary here to keep the payload 
            // small. I doubt it really makes much difference assuming you're not reaching 
            // the average MTU (1500 bytes) - since every update is going to send a packet anyway
            const data: number[] = [];

            // first put the entity position
            data[0] = Math.floor(entity.x);
            data[1] = Math.floor(entity.y);

            // now encode the boolean control states and put them into the update
            let controls = 0;
            controls += entity.left ? LEFT : 0;
            controls += entity.right ? RIGHT : 0;
            controls += entity.up ? UP : 0;
            controls += entity.down ? DOWN : 0;
            data[2] = controls;

            // finally wrap it and send. Right now I'm sending this Unordered - which also
            // means its going over UDP and hence not reliable.
            const state = new Uint16Array(data);
            this.client.sendUnorderedBinary(state);
        }
    }

    /**
     * Handle a message sent on the ordered reliable channel. These are used for non-time
     * sensitive messages that *must* get through.
     * 
     * @param text The text content sent.
     */
    handleReliable(text: string): void {
        const message = JSON.parse(text);

        // identify = tell me which entity is mine
        if (message.type === "identify") {
            this.myId = message.entityId;
        // name = tell me the name/label to apply to any entity
        } else if (message.type === "name") {
            this.nameById[message.entityId] = message.name;
        } else if (message.type === "time") {
            console.log("Start time set at: " + message.seq);
            this.localSequenceNumber = message.seq;
        } else {
            console.log("Unrecognized message: " + text);
        }
    }

    /**
     * Handle the full game state as sent by the server. This state should contain 
     * information for any entity that exists.
     * 
     * @param buffer The buffer of binary encoded data for the state update
     */
    handleState(buffer: ArrayBuffer): void {
        console.log("Got state: " + this.myId);
        const state = new Uint16Array(buffer);
        console.log(state.length);
        // four byte sequence number
        const seq = state[0] | ((state[1] << 16) & 0xFFFF0000);

        // check if this sequence number is old - note that the sequence number will
        // overflow and loop so more than 10000 older is probably a loop
        
        if (seq <= this.lastSequenceNumber) {
            return;
        }
        this.lastSequenceNumber = seq;

        let index = 2;
        
        const entitiesInUpdate: Entity[] = [];

        // loop through the state updates for each entity applying
        while (index < state.length) {
            const id = state[index++];
            let entity = this.entities.find(entity => entity.id === id);
            let created = false;

            // if we can't find an existing entity for the one specified
            // then create one - we'll update it that same as the other afterwards
            if (!entity) {
                created = true;
                this.entities.push(entity = new Entity(id, 0, 0, 0));
            } 
                
            // decode the binary data
            const x = state[index++];
            const y = state[index++];
            const type = state[index++];
            const controls = state[index++];

            // update the specified entity unless its our locally controlled
            // entity. Even on a good day with a following wind the control updates
            // will take *some* time to reach the server. So the server update will
            // always be behind what our local control has - so lets assume the client
            // is ok by its measure, but then validate on the server
            const localEntity = this.getLocalEntity();
            if (entity !== localEntity || created) {
                const left: boolean = (controls & LEFT) !== 0;
                const right: boolean = (controls & RIGHT) !== 0;
                const up: boolean = (controls & UP) !== 0;
                const down: boolean = (controls & DOWN) !== 0;

                entity.updateState(x, y, type, left, right, up, down);
            }

            // finally remember which entities have been mentioned in this update. Any
            // entities that aren't mentioned should be removed from the model
            entitiesInUpdate.push(entity);
        }

        // Remove entities that were not mentioned in the state update
        // since the server doesn't think they exist any more
        for (const entity of [...this.entities]) {
            if (!entitiesInUpdate.includes(entity)) {
                this.entities.splice(this.entities.indexOf(entity), 1);
            }
        }

        // finally adjust our current positions based on where they were
        // at this sequence number and where we think we are in time
        const step = SERVER_UPDATES_PER_SECOND / CLIENT_UPDATES_PER_SECOND;
        let stepsAhead = Math.floor((this.localSequenceNumber - this.lastSequenceNumber) / step);

        if (stepsAhead > 0) {
            for (let i=0;i<stepsAhead;i++) {
                // move all the entities from their server confirm positions to the point
                // in time where client prediction thinks we are - apart from our local
                // player since it'll be accurate based on local controls
                this.moveEntities(this.getLocalEntity());
            }
        } else {
            this.localSequenceNumber = this.lastSequenceNumber;
        }
    }
}