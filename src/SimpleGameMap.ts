import { WorldMap } from "./model/WorldMap";

// Map of the wall tiles - rubbish.
const MAP: number[] = [
    226,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,227,
    258,34,65,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,65,34,259,
    257,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,256,
    257,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,256,
    257,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,256,
    257,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,256,
    257,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,256,
    257,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,256,
    257,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,256,
    257,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,256,
    257,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,256,
    257,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,256,
    257,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,256,
    257,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,256,
    257,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,256,
    257,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,256,
    257,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,256,
    257,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,256,
    290,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,291,
    34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,
];

/**
 * A very simple and rubbish implementation of a game map
 */
export class SimpleGameMap implements WorldMap {
    /** The tile indexes to be displayed on the floor, we generate this at start up for a random tiling effect*/
    floors: number[] = [];

    constructor() {
        // Generate the random floor by selecting a map's worth of tiles from a random list

        // randomize the floor but put a heavier weight on the plain tile
        const possibleFloors = [129,129,129,129,129,129,129,130,131,161,162,163];
        for (let i=0;i<this.width*this.height;i++) {
            this.floors[i] = possibleFloors[Math.floor(Math.random() * possibleFloors.length)];
        }
    }

    /**
     * Check if a sprite standing at a given pixel location shouldn't
     * be allowed. Used to check wall blockages.
     * 
     * @param x The x position in pixels of the sprite
     * @param y The y position in pixels of the sprite
     */
    blockedAt(x: number, y: number): boolean {
        y += 20;
        x += 8;
        if (this.getTile(Math.floor(x/16), Math.floor(y/16)) !== 0) {
            return true;
        }

        return false;
    }

    /**
     * Get the floor tile at the given tile location
     * 
     * @param tx The x position of the tile to get
     * @param ty The y position of the tile to get
     * @returns The tile for the floor at the given location
     */
    getFloor(tx: number, ty: number): number {
        return this.floors[tx+(ty*this.width)];
    }

    /**
     * Get the wall tile at the given tile location
     * 
     * @param tx The x position of the tile to get
     * @param ty The y position of the tile to get
     * @returns The tile for the wall at the given location
     */
    getTile(tx: number, ty: number): number {
        return MAP[tx+(ty*this.width)];
    }

    /**
     * Get the width of the map in tiles
     * 
     * @return The width of the map in tiles
     */
    get width(): number {
        return 30;
    }
    
    /**
     * Get the height of the map in tiles
     * 
     * @return The height of the map in tiles
     */
    get height(): number {
        return 20;
    }
}