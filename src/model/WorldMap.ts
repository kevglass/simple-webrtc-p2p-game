/**
 * A simple interface describing what the game model needs to know from 
 * the game world.
 */
export interface WorldMap {
    /**
     * Check if an actor standing at the specified coordinates (in pixels)
     * would be standing on a blocked location
     * 
     * @param x The x position in pixels to check 
     * @param y The y position in pixels to check
     * @return True if the location would be blocked
     */
    blockedAt(x: number, y: number): boolean;

    /**
     * Get the width of the map in tiles
     * 
     * @return The width of the map in tiles
     */
    get width(): number;

    /**
     * Get the height of the map in tiles
     * 
     * @return The height of the map in tiles
     */
    get height(): number;
}