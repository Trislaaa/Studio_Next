import type { RoomStatus } from '@prisma/client'

/**
 * PMS-agnostic booking data structure
 * This format is used to push bookings to any PMS provider
 */
export interface PMSBookingData {
    guestName: string
    email: string
    phone: string
    checkIn: Date
    checkOut: Date
    roomType: string
    roomNumber?: string
    numberOfGuests: number
    totalAmount: number
    specialRequests?: string
}

/**
 * Response from PMS after pushing a booking
 */
export interface PMSBookingResponse {
    success: boolean
    pmsBookingId: string
    confirmationNumber?: string
    errors?: string[]
}

/**
 * Room inventory item received from PMS
 */
export interface PMSInventoryItem {
    roomNumber: string
    roomType: string
    status: RoomStatus
    isAvailable: boolean
    blockedDates?: Array<{ from: Date; to: Date }>
}

/**
 * Base adapter interface that all PMS implementations must follow
 * This enables the Adapter Pattern for swapping between different PMS providers
 */
export interface PMSAdapter {
    /**
     * Fetch current room inventory from PMS
     * Called periodically by cron job to sync availability
     */
    syncInventory(): Promise<PMSInventoryItem[]>

    /**
     * Push a new booking to the PMS
     * Called after successful payment on our website
     */
    pushBooking(booking: PMSBookingData): Promise<PMSBookingResponse>

    /**
     * Cancel a booking in the PMS
     * Called when guest cancels or admin cancels
     */
    cancelBooking(pmsBookingId: string): Promise<void>

    /**
     * Get real-time status of a specific room
     * For on-demand checks before booking
     */
    getRoomStatus(roomNumber: string): Promise<RoomStatus>

    /**
     * Health check to verify PMS connection
     * Used by monitoring/admin dashboard
     */
    isConnected(): Promise<boolean>
}

/**
 * Result of inventory synchronization
 */
export interface SyncInventoryResult {
    success: boolean
    updatedRooms: number
    errors: string[]
    timestamp: Date
}

/**
 * Helper type for delay utility
 */
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
