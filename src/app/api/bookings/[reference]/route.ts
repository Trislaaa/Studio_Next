import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

function toNumber(value: unknown) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (
        typeof value === 'object' &&
        value !== null &&
        'toNumber' in value &&
        typeof (value as { toNumber: unknown }).toNumber === 'function'
    ) {
        return (value as { toNumber: () => number }).toNumber();
    }
    return Number(value) || 0;
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ reference: string }> }
) {
    try {
        const { reference } = await params;
        if (!reference) {
            return NextResponse.json({ error: 'Booking reference is required' }, { status: 400 });
        }

        const booking = await prisma.booking.findUnique({
            where: { bookingReference: reference },
            include: {
                guest: true,
                rooms: { include: { room: true } },
                transaction: true,
                addons: true,
            },
        });

        if (!booking) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        return NextResponse.json({
            booking: {
                id: booking.id,
                bookingReference: booking.bookingReference,
                status: booking.status,
                checkIn: booking.checkIn.toISOString(),
                checkOut: booking.checkOut.toISOString(),
                numberOfGuests: booking.numberOfGuests,
                totalAmount: toNumber(booking.totalAmount),
                taxAmount: toNumber(booking.taxAmount),
                discountAmount: toNumber(booking.discountAmount),
                specialRequests: booking.specialRequests,
                // Legacy: first room for backward compat
                room: booking.rooms[0] ? {
                    id: booking.rooms[0].roomId,
                    number: booking.rooms[0].room.roomNumber,
                    type: booking.rooms[0].room.type,
                } : null,
                // All rooms in this booking
                rooms: booking.rooms.map(br => ({
                    id: br.roomId,
                    number: br.room.roomNumber,
                    type: br.room.type,
                })),
                guest: {
                    name: booking.guest.fullName,
                    email: booking.guest.email,
                    phone: booking.guest.phone,
                },
                addons: booking.addons.map((addon) => ({
                    id: addon.addonType,
                    name: addon.name,
                    quantity: addon.quantity,
                    price: toNumber(addon.price),
                })),
                transaction: booking.transaction
                    ? {
                        id: booking.transaction.id,
                        status: booking.transaction.status,
                        amount: toNumber(booking.transaction.amount),
                        currency: booking.transaction.currency,
                        paymentGatewayId: booking.transaction.paymentGatewayId,
                        paymentMethod: booking.transaction.paymentMethod,
                        metadata: booking.transaction.metadata,
                        updatedAt: booking.transaction.updatedAt.toISOString(),
                    }
                    : null,
                createdAt: booking.createdAt.toISOString(),
            },
        });
    } catch (error) {
        console.error('Error fetching booking by reference:', error);
        return NextResponse.json({ error: 'Failed to fetch booking' }, { status: 500 });
    }
}
