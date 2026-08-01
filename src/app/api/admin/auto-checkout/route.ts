import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';

/**
 * Admin proxy for auto-checkout.
 * This endpoint verifies the admin session server-side, then executes
 * the same logic as the cron auto-checkout — without exposing the
 * CRON_SECRET to the client.
 * 
 * Route: POST /api/admin/auto-checkout
 */
export async function POST(request: NextRequest) {
    try {
        const guard = await requireAuth(request, ['ADMIN', 'MANAGER', 'RECEPTION']);
        if (guard.error) return guard.error;

        const nowUTC = new Date();
        const istOffsetMs = 5.5 * 60 * 60 * 1000;
        const nowIST = new Date(nowUTC.getTime() + istOffsetMs);
        const todayIST = new Date(
            Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate())
        );
        const endOfTodayIST = new Date(todayIST.getTime() + 24 * 60 * 60 * 1000);

        const overdueBookings = await prisma.booking.findMany({
            where: {
                status: 'CHECKED_IN',
                checkOut: { lt: endOfTodayIST },
            },
            include: { rooms: { include: { room: true } } },
        });

        if (overdueBookings.length === 0) {
            return NextResponse.json({
                success: true,
                checkedOut: 0,
                message: 'No overdue checkouts',
            });
        }

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
                results.push({ bookingRef: booking.bookingReference, room: booking.rooms.map(r => r.room.roomNumber).join(', '), status: 'ok' });
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                results.push({ bookingRef: booking.bookingReference, room: booking.rooms.map(r => r.room.roomNumber).join(', '), status: 'error', error: msg });
            }
        }

        const successCount = results.filter(r => r.status === 'ok').length;
        const errorCount = results.filter(r => r.status === 'error').length;

        return NextResponse.json({
            success: true,
            checkedOut: successCount,
            errors: errorCount,
            results,
        });
    } catch (error) {
        console.error('[Admin AutoCheckout] Error:', error);
        return NextResponse.json(
            { error: 'Auto-checkout failed' },
            { status: 500 }
        );
    }
}
