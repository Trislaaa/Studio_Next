import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Auto-Checkout Cron Job
 * Route: POST /api/cron/auto-checkout
 * Schedule: 04:30 UTC = 10:00 AM IST, every day
 *
 * Finds all CHECKED_IN bookings whose checkOut date is today (or earlier)
 * and automatically marks them CHECKED_OUT + sets room to CLEANING.
 * This matches OTA platform behaviour (checkout deadline = 10 AM).
 */
export async function GET(request: NextRequest) {
    // Verify cron secret — required in production
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
        console.error('[AutoCheckout] CRON_SECRET env var is not set');
        return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn('[AutoCheckout] Unauthorized attempt');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Find bookings that are CHECKED_IN and checkOut <= today (overdue)
        const nowUTC = new Date();
        // IST midnight of today = yesterday 18:30 UTC
        const istOffsetMs = 5.5 * 60 * 60 * 1000;
        const nowIST = new Date(nowUTC.getTime() + istOffsetMs);
        const todayIST = new Date(
            Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate())
        );
        // endOfToday IST (exclusive upper bound)
        const endOfTodayIST = new Date(todayIST.getTime() + 24 * 60 * 60 * 1000);

        const overdueBookings = await prisma.booking.findMany({
            where: {
                status: 'CHECKED_IN',
                checkOut: {
                    // checkOut date is today or earlier (in the DB, dates are stored at midnight UTC)
                    lt: endOfTodayIST,
                },
            },
            include: { rooms: { include: { room: true } } },
        });

        if (overdueBookings.length === 0) {
            console.log('[AutoCheckout] No overdue checkouts found.');
            return NextResponse.json({
                success: true,
                checkedOut: 0,
                message: 'No overdue checkouts',
            });
        }

        // Process each overdue booking in a transaction
        const results: { bookingRef: string; room: string; status: 'ok' | 'error'; error?: string }[] = [];

        for (const booking of overdueBookings) {
            try {
                await prisma.$transaction([
                    prisma.booking.update({
                        where: { id: booking.id },
                        data: { status: 'CHECKED_OUT' },
                    }),
                    ...booking.rooms.map(r => prisma.room.update({
                        where: { id: r.roomId },
                        data: { status: 'CLEANING' },
                    })),
                ]);
                const roomNumbers = booking.rooms.map(r => r.room.roomNumber).join(', ');
                results.push({ bookingRef: booking.bookingReference, room: roomNumbers, status: 'ok' });
                console.log(`[AutoCheckout] ✓ Checked out booking ${booking.bookingReference} (Rooms ${roomNumbers})`);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                results.push({ bookingRef: booking.bookingReference, room: booking.rooms.map(r => r.room.roomNumber).join(', '), status: 'error', error: msg });
                console.error(`[AutoCheckout] ✗ Failed booking ${booking.bookingReference}:`, err);
            }
        }

        const successCount = results.filter(r => r.status === 'ok').length;
        const errorCount = results.filter(r => r.status === 'error').length;

        return NextResponse.json({
            success: true,
            checkedOut: successCount,
            errors: errorCount,
            results,
            timestamp: nowUTC.toISOString(),
        });
    } catch (error) {
        console.error('[AutoCheckout] Fatal error:', error);
        return NextResponse.json(
            { error: 'Auto-checkout failed', message: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
