import { Entity } from "./Entity";
import { WorldMap } from "./WorldMap";

// bit field setting for sending controls across
export const LEFT: number = 1;
export const RIGHT: number = 2;
export const UP: number = 4;
export const DOWN: number = 8;

// it's important to pick the server and client updates as
// values easily divisible with the current game model - otherwise
// you'll introduce rounding errors (20 and 40 feel pretty good to me)

// The number of updates per second the server uses
export const SERVER_UPDATES_PER_SECOND: number = 20;
// The number of updates per second the client uses
export const CLIENT_UPDATES_PER_SECOND: number = 40;
// The amount the player moves each frame
export const MOVE_SPEED: number = 8;

/**
 * The common elements between the server and client for maintaining the game world model. 
 */
export abstract class AbstractWorld {
    /** The game entities in the world, in this case just positions, inputs and types */
    entities: Entity[] = [];
    /** The map the game is taking place on */
    map: WorldMap;
    /** The size of the step in a move entities call */
    stepSize: number;

    constructor(map: WorldMap, stepSize: number) {
        this.map = map;
        this.stepSize = stepSize;
    }

    /**
     * Move the entities based on their current inputs. If entities are remote they still
     * move on the client at the same rate as they would on the server so things should
     * stay reasonably in sync.
     */
    public moveEntities(exclude?: Entity) {
        // move each entity (including the local one) based
        // on the inputs. Don't ever move an entity into a blocked (invalid)
        // position
        const moveStep = MOVE_SPEED * this.stepSize;

        for (const entity of this.entities) {
            if (entity === exclude) {
                continue;
            }

            let nx = entity.x;
            let ny = entity.y;
            if (entity.up) {
                ny -= moveStep;
            }
            if (entity.down) {
                ny += moveStep;
            }
            if (entity.left) {
                nx -= moveStep;
            }
            if (entity.right) {
                nx += moveStep;
            }

            // if the new position is to the right or left mark it 
            // so the sprite can flip
            if (nx > entity.x) {
                entity.faceLeft = false;
            }
            if (nx < entity.x) {
                entity.faceLeft = true;
            }

            // if we actually are changing position then record that we're moving
            // so we can use the run animation.
            entity.moving = (entity.x !== nx) || (entity.y !== ny);
            if (entity.moving) {
                if (!this.map.blockedAt(nx, ny)) {
                    entity.x = nx;
                    entity.y = ny;
                }
            }
        }
    }
}