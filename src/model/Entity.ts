/**
 * Represents an entity in the game world. This data will be synced via the 
 * server.
 */
export class Entity {
    /** The ID given to the entity by the server */
    id: number;
    /** The x position in pixels of the entity */
    x: number;
    /** The y position in pixels of the entity */
    y: number;
    /** The type of entity - at the moment thats an index into the character sprites we have */
    type: number;
    /** True if the entity is facing left, i.e. it moved left last. This lets us flip the sprite to feel like we're in control */
    faceLeft: boolean = true;
    /** True if the entity was moving last update */
    moving: boolean = false;

    /** Indicate the entity is trying to move left */
    left: boolean = false;
    /** Indicate the entity is trying to move right */
    right: boolean = false;
    /** Indicate the entity is trying to move up */
    up: boolean = false;
    /** Indicate the entity is trying to move down */
    down: boolean = false;

    constructor(id: number, x: number, y: number, type: number) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.type = type;
    }

    update(): void {
        // do interpolation here maybe?
    }

    updateState(x: number, y: number, type: number, left: boolean, right: boolean, up: boolean, down: boolean): void {
        this.x = x;
        this.y = y;
        this.type = type;
        this.left = left;
        this.right = right;
        this.up = up;
        this.down = down;
    }
}