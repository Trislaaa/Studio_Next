import type { RoomStatus } from '@prisma/client'
import type {
    PMSAdapter,
    PMSBookingData,
    PMSBookingResponse,
    PMSInventoryItem,
    delay
} from './types'

// Import delay helper
const delayFn = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Mock PMS Adapter for development and testing
 * Simulates realistic PMS behavior including API delays and error scenarios
 */
export class MockPMSAdapter implements PMSAdapter {
    private mockInventory: Map<string, PMSInventoryItem>
    private mockBookings: Map<string, PMSBookingData>
    private errorRate: number // Percentage of operations that should fail (0-100)

    constructor(errorRate: number = 10) {
        this.mockInventory = new Map()
        this.mockBookings = new Map()
        this.errorRate = errorRate

        // Initialize with sample room inventory
        this.initializeMockInventory()
    }

    /**
     * Initialize mock inventory with sample rooms
     */
    private initializeMockInventory(): void {
        const rooms = [
            { roomNumber: '101', roomType: 'DELUXE', status: 'AVAILABLE' as RoomStatus },
            { roomNumber: '102', roomType: 'DELUXE', status: 'AVAILABLE' as RoomStatus },
            { roomNumber: '201', roomType: 'SUITE', status: 'AVAILABLE' as RoomStatus },
            { roomNumber: '202', roomType: 'SUITE', status: 'AVAILABLE' as RoomStatus },
            { roomNumber: '301', roomType: 'FAMILY', status: 'AVAILABLE' as RoomStatus },
            { roomNumber: '302', roomType: 'STANDARD', status: 'AVAILABLE' as RoomStatus },
        ]

        rooms.forEach(room => {
            this.mockInventory.set(room.roomNumber, {
                ...room,
                isAvailable: room.status === 'AVAILABLE',
                blockedDates: []
            })
        })
    }

    /**
     * Simulate random status changes (e.g., walk-in bookings, housekeeping)
     */
    private simulateRandomChanges(): void {
        const rooms = Array.from(this.mockInventory.values())

        // 20% chance to change a room's status
        if (Math.random() < 0.2) {
            const randomRoom = rooms[Math.floor(Math.random() * rooms.length)]
            const statuses: RoomStatus[] = ['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE']
            const newStatus = statuses[Math.floor(Math.random() * statuses.length)]

            randomRoom.status = newStatus
            randomRoom.isAvailable = newStatus === 'AVAILABLE'

            console.log(`[MockPMS] Room ${randomRoom.roomNumber} status changed to ${newStatus}`)
        }
    }

    /**
     * Simulate API errors based on error rate
     */
    private shouldSimulateError(): boolean {
        return Math.random() * 100 < this.errorRate
    }

    /**
     * Fetch current inventory from mock PMS
     */
    async syncInventory(): Promise<PMSInventoryItem[]> {
        // Simulate realistic API delay (500-1000ms)
        await delayFn(500 + Math.random() * 500)

        if (this.shouldSimulateError()) {
            throw new Error('Mock PMS: Failed to connect to inventory service')
        }

        // Simulate random status changes
        this.simulateRandomChanges()

        return Array.from(this.mockInventory.values())
    }

    /**
     * Push a booking to mock PMS
     */
    async pushBooking(booking: PMSBookingData): Promise<PMSBookingResponse> {
        // Simulate realistic API delay (800-1200ms)
        await delayFn(800 + Math.random() * 400)

        // Simulate random "room sold out" errors
        if (this.shouldSimulateError()) {
            console.warn('[MockPMS] Simulating booking push failure')
            return {
                success: false,
                pmsBookingId: '',
                errors: ['Room no longer available in PMS', 'Inventory mismatch detected']
            }
        }

        // Generate mock PMS booking ID
        const timestamp = Date.now()
        const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase()
        const pmsBookingId = `PMS-${timestamp}-${randomSuffix}`
        const confirmationNumber = `CONF-${randomSuffix}`

        // Store in mock state
        this.mockBookings.set(pmsBookingId, booking)

        // Update room status to occupied if room number is specified
        if (booking.roomNumber) {
            const room = this.mockInventory.get(booking.roomNumber)
            if (room) {
                room.status = 'OCCUPIED'
                room.isAvailable = false
                room.blockedDates = [
                    ...(room.blockedDates || []),
                    { from: booking.checkIn, to: booking.checkOut }
                ]
            }
        }

        console.log(`[MockPMS] Booking created successfully: ${pmsBookingId}`)

        return {
            success: true,
            pmsBookingId,
            confirmationNumber,
            errors: []
        }
    }

    /**
     * Cancel a booking in mock PMS
     */
    async cancelBooking(pmsBookingId: string): Promise<void> {
        await delayFn(400 + Math.random() * 200)

        if (this.shouldSimulateError()) {
            throw new Error('Mock PMS: Failed to cancel booking')
        }

        const booking = this.mockBookings.get(pmsBookingId)
        if (!booking) {
            throw new Error(`Mock PMS: Booking ${pmsBookingId} not found`)
        }

        // Remove booking
        this.mockBookings.delete(pmsBookingId)

        // Free up the room
        if (booking.roomNumber) {
            const room = this.mockInventory.get(booking.roomNumber)
            if (room) {
                room.status = 'CLEANING'
                room.isAvailable = false
                // Remove blocked dates for this booking
                room.blockedDates = (room.blockedDates || []).filter(
                    blocked => !(blocked.from === booking.checkIn && blocked.to === booking.checkOut)
                )
            }
        }

        console.log(`[MockPMS] Booking cancelled: ${pmsBookingId}`)
    }

    /**
     * Get real-time status of a specific room
     */
    async getRoomStatus(roomNumber: string): Promise<RoomStatus> {
        await delayFn(200 + Math.random() * 100)

        const room = this.mockInventory.get(roomNumber)
        if (!room) {
            throw new Error(`Mock PMS: Room ${roomNumber} not found`)
        }

        return room.status
    }

    /**
     * Health check - mock PMS is always "connected"
     */
    async isConnected(): Promise<boolean> {
        await delayFn(100)
        // 1% chance of reporting disconnected for testing
        return Math.random() > 0.01
    }

    /**
     * Get all mock bookings (for debugging)
     */
    getMockBookings(): Map<string, PMSBookingData> {
        return new Map(this.mockBookings)
    }

    /**
     * Reset mock state (useful for testing)
     */
    reset(): void {
        this.mockBookings.clear()
        this.initializeMockInventory()
    }

    /**
     * Set error rate dynamically (for testing failure scenarios)
     */
    setErrorRate(rate: number): void {
        this.errorRate = Math.max(0, Math.min(100, rate))
    }
}
