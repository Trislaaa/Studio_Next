import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';

// GET /api/admin/bookings/[id] - Get booking details
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const guard = await requireAuth(request, ['ADMIN', 'MANAGER', 'RECEPTION']);
        if (guard.error) return guard.error;

        const { id } = await params;

        const booking = await prisma.booking.findUnique({
            where: { id },
            include: {
                guest: true,
                rooms: {
                    include: {
                        room: {
                            include: {
                                rates: {
                                    orderBy: { effectiveFrom: 'desc' },
                                    take: 1,
                                },
                            },
                        },
                    },
                },
                transaction: true,
                addons: true,
            },
        });

        if (!booking) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        const formattedBooking = {
            ...booking,
            totalAmount: booking.totalAmount.toNumber(),
            transaction: booking.transaction ? {
                ...booking.transaction,
                amount: booking.transaction.amount.toNumber(),
            } : null,
        };

        return NextResponse.json({ booking: formattedBooking }, { status: 200 });
    } catch (error) {
        console.error('Error fetching booking:', error);
        return NextResponse.json(
            { error: 'Failed to fetch booking details' },
            { status: 500 }
        );
    }
}
