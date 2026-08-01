import { prisma } from '../db'
import { getPMSAdapter } from './adapter-factory'
import type { SyncInventoryResult, PMSBookingData, PMSBookingResponse } from './types'

/**
 * Synchronize room inventory from PMS to our database
 * This function is called by the cron job every 5 minutes
 */
export async function syncInventoryFromPMS(): Promise<SyncInventoryResult> {
    const pms = getPMSAdapter()
    const errors: string[] = []
    let updatedRooms = 0

    console.log('[PMS Sync] Starting inventory synchronization...')

    try {
        // Fetch inventory from PMS
        const inventory = await pms.syncInventory()
        console.log(`[PMS Sync] Received ${inventory.length} rooms from PMS`)

        // Compare with our database and update discrepancies
        for (const pmsRoom of inventory) {
            try {
                const localRoom = await prisma.room.findUnique({
                    where: { roomNumber: pmsRoom.roomNumber }
                })

                if (!localRoom) {
                    errors.push(`Room ${pmsRoom.roomNumber} exists in PMS but not in local database`)
                    continue
                }

                // Update if status differs
                if (localRoom.status !== pmsRoom.status) {
                    await prisma.room.update({
                        where: { id: localRoom.id },
                        data: { status: pmsRoom.status }
                    })

                    updatedRooms++
                    console.log(`[PMS Sync] Updated room ${pmsRoom.roomNumber}: ${localRoom.status} → ${pmsRoom.status}`)
                }

                // TODO: Handle blocked dates (create PMS-originated bookings)
                // This would check pmsRoom.blockedDates and create corresponding bookings

            } catch (roomError) {
                const errorMsg = `Failed to update room ${pmsRoom.roomNumber}: ${roomError instanceof Error ? roomError.message : 'Unknown error'}`
                errors.push(errorMsg)
                console.error(`[PMS Sync] ${errorMsg}`)
            }
        }

        // Log sync result
        await prisma.pmsLog.create({
            data: {
                action: 'SYNC_INVENTORY',
                direction: 'INBOUND',
                status: errors.length > 0 ? 'FAILED' : 'SUCCESS',
                payload: {
                    inventoryCount: inventory.length,
                    updatedRooms,
                    timestamp: new Date().toISOString()
                },
                errorMsg: errors.length > 0 ? errors.join('; ') : null
            }
        })

        console.log(`[PMS Sync] Completed. Updated ${updatedRooms} rooms, ${errors.length} errors`)

        return {
            success: errors.length === 0,
            updatedRooms,
            errors,
            timestamp: new Date()
        }

    } catch (error) {
        const errorMsg = `Inventory sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(`[PMS Sync] ${errorMsg}`)

        // Log failure
        await logPMSError('SYNC_INVENTORY', 'INBOUND', error)

        return {
            success: false,
            updatedRooms: 0,
            errors: [errorMsg],
            timestamp: new Date()
        }
    }
}

/**
 * Push a booking to the PMS
 * Called after successful payment on our website
 */
export async function pushBookingToPMS(
    bookingId: string,
    retryCount = 0
): Promise<PMSBookingResponse> {
    const MAX_RETRIES = 3
    const pms = getPMSAdapter()

    console.log(`[PMS Push] Pushing booking ${bookingId} to PMS (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`)

    // Fetch booking with relations
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
            guest: true,
            rooms: { include: { room: true } }
        }
    })

    if (!booking) {
        throw new Error(`Booking ${bookingId} not found`)
    }

    // Check if already synced
    if (booking.pmsBookingId) {
        console.log(`[PMS Push] Booking ${bookingId} already synced (PMS ID: ${booking.pmsBookingId})`)
        return {
            success: true,
            pmsBookingId: booking.pmsBookingId,
            errors: []
        }
    }

    // Transform to PMS format — use first room for backwards-compatible single-room PMS integrations
    const firstRoom = booking.rooms[0]?.room;
    const pmsData: PMSBookingData = {
        guestName: booking.guest.fullName,
        email: booking.guest.email,
        phone: booking.guest.phone,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        roomType: firstRoom?.type ?? 'STANDARD',
        roomNumber: firstRoom?.roomNumber ?? 'N/A',
        numberOfGuests: booking.numberOfGuests,
        totalAmount: booking.totalAmount.toNumber(),
        specialRequests: booking.specialRequests || undefined
    }

    try {
        const response = await pms.pushBooking(pmsData)

        if (response.success) {
            // Update booking with PMS ID
            await prisma.booking.update({
                where: { id: bookingId },
                data: { pmsBookingId: response.pmsBookingId }
            })

            // Log success
            await prisma.pmsLog.create({
                data: {
                    bookingId,
                    action: 'PUSH_BOOKING',
                    direction: 'OUTBOUND',
                    status: 'SUCCESS',
                    payload: JSON.parse(JSON.stringify({
                        pmsData,
                        response,
                        retryCount
                    }))
                }
            })

            console.log(`[PMS Push] Successfully pushed booking ${bookingId}, PMS ID: ${response.pmsBookingId}`)

            return response

        } else {
            // PMS rejected the booking
            console.warn(`[PMS Push] PMS rejected booking ${bookingId}: ${response.errors?.join(', ')}`)

            if (retryCount < MAX_RETRIES) {
                // Exponential backoff: 1s, 2s, 4s
                const delayMs = Math.pow(2, retryCount) * 1000
                console.log(`[PMS Push] Retrying in ${delayMs}ms...`)

                await new Promise(resolve => setTimeout(resolve, delayMs))
                return pushBookingToPMS(bookingId, retryCount + 1)
            }

            // Max retries exceeded, log failure
            await logPMSError('PUSH_BOOKING', 'OUTBOUND', new Error(response.errors?.join(', ')), bookingId)

            throw new Error(`PMS booking failed after ${MAX_RETRIES} retries: ${response.errors?.join(', ')}`)
        }

    } catch (error) {
        console.error(`[PMS Push] Error pushing booking ${bookingId}:`, error)

        if (retryCount < MAX_RETRIES) {
            // Retry on network/system errors
            const delayMs = Math.pow(2, retryCount) * 1000
            console.log(`[PMS Push] Retrying in ${delayMs}ms...`)

            await new Promise(resolve => setTimeout(resolve, delayMs))
            return pushBookingToPMS(bookingId, retryCount + 1)
        }

        // Log failure
        await logPMSError('PUSH_BOOKING', 'OUTBOUND', error, bookingId)

        throw error
    }
}

/**
 * Cancel a booking in the PMS
 */
export async function cancelBookingInPMS(
    bookingId: string
): Promise<void> {
    const pms = getPMSAdapter()

    console.log(`[PMS Cancel] Cancelling booking ${bookingId} in PMS`)

    const booking = await prisma.booking.findUnique({
        where: { id: bookingId }
    })

    if (!booking) {
        throw new Error(`Booking ${bookingId} not found`)
    }

    if (!booking.pmsBookingId) {
        console.warn(`[PMS Cancel] Booking ${bookingId} has no PMS ID, skipping PMS cancellation`)
        return
    }

    try {
        await pms.cancelBooking(booking.pmsBookingId)

        // Log success
        await prisma.pmsLog.create({
            data: {
                bookingId,
                action: 'CANCEL_BOOKING',
                direction: 'OUTBOUND',
                status: 'SUCCESS',
                payload: { pmsBookingId: booking.pmsBookingId }
            }
        })

        console.log(`[PMS Cancel] Successfully cancelled booking ${bookingId} in PMS`)

    } catch (error) {
        await logPMSError('CANCEL_BOOKING', 'OUTBOUND', error, bookingId)
        throw error
    }
}

/**
 * Helper function to log PMS errors
 */
async function logPMSError(
    action: string,
    direction: 'INBOUND' | 'OUTBOUND',
    error: unknown,
    bookingId?: string
): Promise<void> {
    const errorMsg = error instanceof Error ? error.message : String(error)

    try {
        await prisma.pmsLog.create({
            data: {
                bookingId: bookingId || null,
                action,
                direction,
                status: 'FAILED',
                payload: { error: errorMsg },
                errorMsg
            }
        })
    } catch (logError) {
        console.error('[PMS] Failed to log error:', logError)
    }
}
