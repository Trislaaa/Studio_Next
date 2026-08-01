import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

/**
 * Webhook endpoint for PMS to push updates to our system
 * Handles events like: booking created, cancelled, room status changed
 * 
 * Route: POST /api/webhooks/pms-sync
 */
export async function POST(request: NextRequest) {
    try {
        // Verify webhook signature for security
        const signature = request.headers.get('x-pms-signature')
        const webhookSecret = process.env.PMS_WEBHOOK_SECRET

        if (!webhookSecret) {
            console.error('[PMS Webhook] PMS_WEBHOOK_SECRET env var is not set')
            return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
        }

        const body = await request.text()
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(body)
            .digest('hex')

        // In development, allow requests without signature
        const isDevelopment = process.env.NODE_ENV === 'development'

        if (!isDevelopment && signature !== expectedSignature) {
            console.warn('[PMS Webhook] Invalid signature')
            return NextResponse.json(
                { error: 'Unauthorized - Invalid signature' },
                { status: 401 }
            )
        }

        const payload = JSON.parse(body)
        console.log(`[PMS Webhook] Received event: ${payload.event}`)

        // Handle different webhook event types
        switch (payload.event) {
            case 'booking.created':
                await handleInboundBooking(payload.data)
                break

            case 'booking.cancelled':
                await handleBookingCancellation(payload.data)
                break

            case 'room.status_changed':
                await handleRoomStatusChange(payload.data)
                break

            case 'inventory.updated':
                await handleInventoryUpdate(payload.data)
                break

            default:
                console.warn(`[PMS Webhook] Unknown event type: ${payload.event}`)
                return NextResponse.json(
                    { error: 'Unknown event type' },
                    { status: 400 }
                )
        }

        return NextResponse.json({ success: true, received: payload.event })

    } catch (error) {
        console.error('[PMS Webhook] Processing error:', error)
        return NextResponse.json(
            { error: 'Webhook processing failed' },
            { status: 500 }
        )
    }
}

/**
 * Handle inbound booking from PMS (e.g., phone/walk-in booking)
 */
async function handleInboundBooking(data: any): Promise<void> {
    console.log('[PMS Webhook] Creating inbound booking from PMS')

    // TODO: Implement full booking creation from PMS data
    // This would create Guest, Booking, and link with pmsBookingId

    await prisma.pmsLog.create({
        data: {
            action: 'INBOUND_BOOKING',
            direction: 'INBOUND',
            status: 'SUCCESS',
            payload: data
        }
    })
}

/**
 * Handle booking cancellation from PMS
 */
async function handleBookingCancellation(data: { pmsBookingId: string; reason?: string }): Promise<void> {
    console.log(`[PMS Webhook] Cancelling booking: ${data.pmsBookingId}`)

    const booking = await prisma.booking.findUnique({
        where: { pmsBookingId: data.pmsBookingId }
    })

    if (booking) {
        await prisma.booking.update({
            where: { id: booking.id },
            data: { status: 'CANCELLED' }
        })

        await prisma.pmsLog.create({
            data: {
                bookingId: booking.id,
                action: 'CANCEL_BOOKING',
                direction: 'INBOUND',
                status: 'SUCCESS',
                payload: data
            }
        })

        console.log(`[PMS Webhook] Cancelled booking ${booking.bookingReference}`)
    } else {
        console.warn(`[PMS Webhook] Booking not found: ${data.pmsBookingId}`)
    }
}

/**
 * Handle room status change from PMS
 */
async function handleRoomStatusChange(data: { roomNumber: string; status: string }): Promise<void> {
    console.log(`[PMS Webhook] Room status change: ${data.roomNumber} -> ${data.status}`)

    const room = await prisma.room.findUnique({
        where: { roomNumber: data.roomNumber }
    })

    if (room) {
        await prisma.room.update({
            where: { id: room.id },
            data: { status: data.status as any }
        })

        await prisma.pmsLog.create({
            data: {
                action: 'ROOM_STATUS_CHANGE',
                direction: 'INBOUND',
                status: 'SUCCESS',
                payload: data
            }
        })
    } else {
        console.warn(`[PMS Webhook] Room not found: ${data.roomNumber}`)
    }
}

/**
 * Handle inventory update from PMS
 */
async function handleInventoryUpdate(data: any): Promise<void> {
    console.log('[PMS Webhook] Processing inventory update')

    // Trigger full inventory sync
    const { syncInventoryFromPMS } = await import('@/lib/pms/sync')
    await syncInventoryFromPMS()
}
