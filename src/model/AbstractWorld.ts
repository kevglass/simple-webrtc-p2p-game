import { Entity } from "./Entity";
import { WorldMap } from "./WorldMap";

// bit field setting for sending controls across
export const LEFT: number = 1;
export const RIGHT: number = 2;
export const UP: number = 4;
export const DOWN: number = 8;
// The number of updates per second the server uses
export const UPDATES_PER_SECOND: number = 20;
// The amount the player moves each frame
export const MOVE_SPEED: number = 6;

/**
 * The common elements between the server and client for maintaining the game world model. 
 */
export abstract class AbstractWorld {
    /** The game entities in the world, in this case just positions, inputs and types */
    entities: Entity[] = [];
    /** The map the game is taking place on */
    map: WorldMap;

    constructor(map: WorldMap) {
        this.map = map;
    }

    /**
     * Move the entities based on their current inputs. If entities are remote they still
     * move on the client at the same rate as they would on the server so things should
     * stay reasonably in sync.
     */
    public moveEntities() {
        // move each entity (including the local one) based
        // on the inputs. Don't ever move an entity into a blocked (invalid)
        // position
        for (const entity of this.entities) {
            let nx = entity.x;
            let ny = entity.y;
            if (entity.up) {
                ny -= MOVE_SPEED;
            }
            if (entity.down) {
                ny += MOVE_SPEED;
            }
            if (entity.left) {
                nx -= MOVE_SPEED;
            }
            if (entity.right) {
                nx += MOVE_SPEED;
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