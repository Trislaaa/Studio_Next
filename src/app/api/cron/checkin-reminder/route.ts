import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendCheckInReminder } from '@/lib/email';

/**
 * Cron job: Send check-in reminder emails to guests arriving tomorrow.
 * 
 * Schedule (vercel.json): "0 7 * * *" — runs at 07:00 UTC (12:30 PM IST) daily
 * 
 * Route: GET /api/cron/checkin-reminder
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
        console.error('[CheckinReminder] CRON_SECRET env var is not set');
        return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn('[CheckinReminder] Unauthorized cron attempt');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Find all CONFIRMED bookings checking in tomorrow (IST)
        const nowUTC = new Date();
        const istOffsetMs = 5.5 * 60 * 60 * 1000;
        const nowIST = new Date(nowUTC.getTime() + istOffsetMs);

        // Tomorrow in IST
        const tmrStart = new Date(Date.UTC(
            nowIST.getUTCFullYear(),
            nowIST.getUTCMonth(),
            nowIST.getUTCDate() + 1
        ));
        const tmrEnd = new Date(tmrStart.getTime() + 24 * 60 * 60 * 1000);

        const bookings = await prisma.booking.findMany({
            where: {
                status: 'CONFIRMED',
                checkIn: {
                    gte: tmrStart,
                    lt: tmrEnd,
                },
            },
            include: {
                guest: true,
                rooms: { include: { room: true } },
            },
        });

        if (bookings.length === 0) {
            return NextResponse.json({ success: true, sent: 0, message: 'No arrivals tomorrow' });
        }

        const results: { bookingRef: string; email: string; status: 'sent' | 'skipped' | 'error'; error?: string }[] = [];

        for (const booking of bookings) {
            if (!booking.guest?.email) {
                results.push({ bookingRef: booking.bookingReference, email: '(none)', status: 'skipped' });
                continue;
            }

            const nights = Math.ceil(
                (new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24)
            );

            try {
                const result = await sendCheckInReminder({
                    guestName: booking.guest.fullName,
                    guestEmail: booking.guest.email,
                    bookingReference: booking.bookingReference,
                    roomType: booking.rooms[0]?.room.type ?? 'Room',
                    roomNumber: booking.rooms[0]?.room.roomNumber ?? '',
                    checkIn: booking.checkIn,
                    checkOut: booking.checkOut,
                    numberOfGuests: booking.numberOfGuests,
                    numberOfNights: nights,
                    specialRequests: booking.specialRequests ?? undefined,
                });

                results.push({
                    bookingRef: booking.bookingReference,
                    email: booking.guest.email,
                    status: result.success ? 'sent' : 'error',
                    error: result.success ? undefined : result.error,
                });
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                results.push({ bookingRef: booking.bookingReference, email: booking.guest.email, status: 'error', error: msg });
            }
        }

        const sent = results.filter(r => r.status === 'sent').length;
        const errors = results.filter(r => r.status === 'error').length;

        console.log(`[CheckinReminder] Processed ${bookings.length} bookings — ${sent} sent, ${errors} errors`);

        return NextResponse.json({ success: true, sent, errors, total: bookings.length, results });
    } catch (error) {
        console.error('[CheckinReminder] Error:', error);
        return NextResponse.json({ error: 'Reminder cron failed' }, { status: 500 });
    }
}
