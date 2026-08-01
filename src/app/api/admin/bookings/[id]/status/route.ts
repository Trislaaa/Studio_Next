import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { updateBookingStatusSchema } from '@/lib/validations/booking';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-guard';
import { sendCheckoutThankyou, sendBookingConfirmation } from '@/lib/email';
import { CancellationError, processBookingCancellation } from '@/lib/cancellation';

// PATCH /api/admin/bookings/[id]/status - Update booking status
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const guard = await requireAuth(request, ['ADMIN', 'MANAGER', 'RECEPTION']);
        if (guard.error) return guard.error;

        const { id } = await params;
        const body = await request.json();
        const validatedData = updateBookingStatusSchema.parse(body);

        // Get booking with room and transaction
        const booking = await prisma.booking.findUnique({
            where: { id },
            include: { rooms: { include: { room: true } }, transaction: true },
        });

        if (!booking) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        // Fix 5: Status Machine — enforce valid transitions
        const VALID_TRANSITIONS: Record<string, string[]> = {
            PENDING:     ['CONFIRMED', 'CANCELLED'],
            CONFIRMED:   ['CHECKED_IN', 'CANCELLED'],
            CHECKED_IN:  ['CHECKED_OUT'],
            CHECKED_OUT: [],           // terminal state
            CANCELLED:   [],           // terminal state
            NO_SHOW:     [],           // terminal state
        };

        const currentStatus = booking.status;
        const newStatus = validatedData.status;
        const allowed = VALID_TRANSITIONS[currentStatus] || [];

        if (!allowed.includes(newStatus)) {
            return NextResponse.json(
                { error: `Cannot change status from ${currentStatus} to ${newStatus}. Allowed transitions: ${allowed.join(', ') || 'none (terminal state)'}` },
                { status: 400 }
            );
        }

        if (validatedData.status === 'CANCELLED') {
            const result = await processBookingCancellation({
                bookingId: id,
                cancellationReason: validatedData.cancellationReason,
                actor: 'ADMIN',
            });

            return NextResponse.json(
                {
                    booking: result.booking,
                    cancellation: result.summary,
                },
                { status: 200 }
            );
        }

        const updates: Prisma.BookingUpdateInput = { status: validatedData.status };

        // Handle status-specific logic
        switch (validatedData.status) {
            case 'CHECKED_IN':
                // Update all rooms in this booking to OCCUPIED
                await prisma.$transaction(
                    booking.rooms.map(r => prisma.room.update({
                        where: { id: r.roomId },
                        data: { status: 'OCCUPIED' },
                    }))
                );
                break;

            case 'CHECKED_OUT':
                // Set all rooms to CLEANING after guest departs
                await prisma.$transaction(
                    booking.rooms.map(r => prisma.room.update({
                        where: { id: r.roomId },
                        data: { status: 'CLEANING' },
                    }))
                );
                break;
        }

        // Update booking
        const updatedBooking = await prisma.booking.update({
            where: { id },
            data: updates,
            include: {
                guest: true,
                rooms: { include: { room: true } },
                transaction: true,
            },
        });

        // ── Post-update side effects: email notifications ──────────────────────
        // Non-blocking — email failure must never cause a 500 on status update
        const guestEmail = updatedBooking.guest?.email;
        const guestName = updatedBooking.guest?.fullName ?? 'Guest';

        if (validatedData.status === 'CONFIRMED' && guestEmail) {
            const totalAmt = updatedBooking.totalAmount.toNumber();
            const taxAmt = updatedBooking.taxAmount.toNumber();
            const nights = Math.ceil(
                (new Date(updatedBooking.checkOut).getTime() - new Date(updatedBooking.checkIn).getTime()) / (1000 * 60 * 60 * 24)
            );
            sendBookingConfirmation({
                guestName,
                guestEmail,
                bookingReference: updatedBooking.bookingReference,
                roomType: updatedBooking.rooms[0]?.room.type ?? 'Room',
                roomNumber: updatedBooking.rooms[0]?.room.roomNumber ?? '',
                checkIn: updatedBooking.checkIn,
                checkOut: updatedBooking.checkOut,
                numberOfGuests: updatedBooking.numberOfGuests,
                numberOfNights: nights,
                totalAmount: totalAmt,
                taxAmount: taxAmt,
                paymentMethod: updatedBooking.transaction?.paymentMethod ?? 'ONLINE',
                specialRequests: updatedBooking.specialRequests ?? undefined,
            }).then(r => {
                if (!r.success) console.error('[Email] Confirmation email failed:', r.error);
            }).catch(err => console.error('[Email] Confirmation error:', err));
        }

        if (validatedData.status === 'CHECKED_OUT' && guestEmail) {
            const nights = Math.ceil(
                (new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24)
            );
            const totalAmt = booking.totalAmount.toNumber();
            const taxAmt = totalAmt - (totalAmt / 1.12);
            sendCheckoutThankyou({
                guestName,
                guestEmail,
                bookingReference: booking.bookingReference,
                roomType: booking.rooms[0]?.room.type ?? 'Room',
                checkIn: booking.checkIn,
                checkOut: booking.checkOut,
                numberOfNights: nights,
                totalAmount: totalAmt,
                taxAmount: taxAmt,
                paymentMethod: booking.transaction?.paymentMethod ?? 'ONLINE',
            }).then(r => {
                if (!r.success) console.error('[Email] Checkout email failed:', r.error);
            }).catch(err => console.error('[Email] Checkout error:', err));
        }

        return NextResponse.json({ booking: updatedBooking }, { status: 200 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation failed', details: error.issues },
                { status: 400 }
            );
        }

        if (error instanceof CancellationError) {
            return NextResponse.json(
                { error: error.message, code: error.code },
                { status: error.httpStatus }
            );
        }

        console.error('Error updating booking status:', error);
        return NextResponse.json(
            { error: 'Failed to update booking status' },
            { status: 500 }
        );
    }
}
