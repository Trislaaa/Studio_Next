/**
 * Guest Distribution Utility
 *
 * Distributes a total guest count across multiple rooms, respecting each room's
 * maxOccupancy. Used by both admin manual booking and frontend pricing to ensure
 * correct per-room guest counts and extra-guest charges.
 *
 * Algorithm:
 *   1. Validate total fits within combined capacity
 *   2. Give each room an equal base share (capped at its maxOccupancy)
 *   3. Distribute any remainder to rooms that still have capacity
 *   4. Ensure every room has at least 1 guest (you wouldn't book an empty room)
 */

export interface RoomForDistribution {
    maxOccupancy: number;
}

/**
 * Distributes `totalGuests` across rooms, respecting each room's maxOccupancy.
 *
 * Returns an array of guest counts (same order as input rooms), or null if
 * guests cannot fit (total > combined capacity).
 *
 * Examples:
 *   distributeGuests(6, [{max:3}, {max:3}]) → [3, 3]
 *   distributeGuests(5, [{max:3}, {max:3}]) → [3, 2]
 *   distributeGuests(7, [{max:3}, {max:5}]) → [3, 4]  (fills smaller first)
 *   distributeGuests(4, [{max:3}])          → null     (exceeds capacity)
 */
export function distributeGuests(
    totalGuests: number,
    rooms: RoomForDistribution[]
): number[] | null {
    if (rooms.length === 0) return null;
    if (totalGuests <= 0) return rooms.map(() => 1); // Minimum 1 per room

    const totalCapacity = rooms.reduce((sum, r) => sum + r.maxOccupancy, 0);
    if (totalGuests > totalCapacity) return null; // Can't fit

    const n = rooms.length;

    // Ensure we have enough guests for at least 1 per room
    if (totalGuests < n) {
        // Fewer guests than rooms — allocate 1 to the first `totalGuests` rooms, 0 to rest
        // (edge case: usually means they shouldn't have selected this many rooms)
        return rooms.map((_, i) => (i < totalGuests ? 1 : 0));
    }

    const allocation = new Array(n).fill(0);
    let remaining = totalGuests;

    // Round 1: give each room 1 guest minimum
    for (let i = 0; i < n; i++) {
        allocation[i] = 1;
        remaining--;
    }

    // Round 2: distribute remaining evenly (capped at maxOccupancy)
    if (remaining > 0) {
        const baseExtra = Math.floor(remaining / n);
        for (let i = 0; i < n; i++) {
            const canAdd = rooms[i].maxOccupancy - allocation[i];
            const toAdd = Math.min(baseExtra, canAdd);
            allocation[i] += toAdd;
            remaining -= toAdd;
        }
    }

    // Round 3: distribute leftover one by one to rooms with capacity
    for (let i = 0; i < n && remaining > 0; i++) {
        const canAdd = rooms[i].maxOccupancy - allocation[i];
        if (canAdd > 0) {
            const toAdd = Math.min(canAdd, remaining);
            allocation[i] += toAdd;
            remaining -= toAdd;
        }
    }

    // Safety check (shouldn't happen if totalCapacity check passed)
    if (remaining > 0) return null;

    return allocation;
}

/**
 * Returns the minimum number of rooms needed to seat `totalGuests`,
 * given a per-room maxOccupancy.
 */
export function minRoomsNeeded(totalGuests: number, maxOccupancyPerRoom: number): number {
    if (maxOccupancyPerRoom <= 0) return Infinity;
    return Math.ceil(totalGuests / maxOccupancyPerRoom);
}
