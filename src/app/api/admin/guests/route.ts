import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';

// GET /api/admin/guests - Fetch all guests with search and stats
export async function GET(request: NextRequest) {
    try {
        const guard = await requireAuth(request, ['ADMIN', 'MANAGER', 'RECEPTION']);
        if (guard.error) return guard.error;

        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search');

        const guests = await prisma.guest.findMany({
            where: search
                ? {
                      OR: [
                          { fullName: { contains: search, mode: 'insensitive' } },
                          { email: { contains: search, mode: 'insensitive' } },
                          { phone: { contains: search } },
                      ],
                  }
                : undefined,
            include: {
                bookings: {
                    select: {
                        id: true,
                        checkIn: true,
                        checkOut: true,
                        status: true,
                        totalAmount: true,
                        rooms: {
                            include: { room: { select: { roomNumber: true, type: true } } },
                            take: 1,
                        },
                    },
                    orderBy: { checkIn: 'desc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Format guests with computed fields
        const formattedGuests = guests.map((guest) => {
            const completedBookings = guest.bookings.filter((b) =>
                ['CHECKED_OUT', 'COMPLETED'].includes(b.status)
            );
            const lastBooking = guest.bookings[0];
            const totalSpend = guest.bookings.reduce(
                (sum, b) => sum + b.totalAmount.toNumber(),
                0
            );

            // Determine status based on booking count
            let status = 'New';
            if (completedBookings.length >= 5) status = 'VIP';
            else if (completedBookings.length >= 1) status = 'Regular';

            return {
                id: guest.id,
                fullName: guest.fullName,
                email: guest.email,
                phone: guest.phone,
                address: guest.address,
                idProof: guest.idProof,
                totalBookings: guest.bookings.length,
                completedBookings: completedBookings.length,
                totalSpend,
                lastVisit: lastBooking
                    ? lastBooking.checkOut.toISOString().split('T')[0]
                    : null,
                status,
                createdAt: guest.createdAt,
                bookings: guest.bookings.map((b) => ({
                    id: b.id,
                    checkIn: b.checkIn.toISOString().split('T')[0],
                    checkOut: b.checkOut.toISOString().split('T')[0],
                    status: b.status,
                    totalAmount: b.totalAmount.toNumber(),
                    roomNumber: b.rooms[0]?.room.roomNumber ?? 'N/A',
                    roomType: b.rooms[0]?.room.type ?? 'N/A',
                })),
            };
        });

        // Stats
        const stats = {
            total: formattedGuests.length,
            vip: formattedGuests.filter((g) => g.status === 'VIP').length,
            regular: formattedGuests.filter((g) => g.status === 'Regular').length,
            new: formattedGuests.filter((g) => g.status === 'New').length,
        };

        return NextResponse.json({ guests: formattedGuests, stats }, { status: 200 });
    } catch (error) {
        console.error('Error fetching guests:', error);
        return NextResponse.json(
            { error: 'Failed to fetch guests' },
            { status: 500 }
        );
    }
}

// POST /api/admin/guests - Create a new guest
export async function POST(request: NextRequest) {
    try {
        const guard = await requireAuth(request, ['ADMIN', 'MANAGER', 'RECEPTION']);
        if (guard.error) return guard.error;

        const body = await request.json();
        const { fullName, email, phone, address, idProof } = body;

        if (!fullName || !email || !phone) {
            return NextResponse.json(
                { error: 'Full name, email, and phone are required' },
                { status: 400 }
            );
        }

        // Check if guest with email already exists
        const existing = await prisma.guest.findUnique({ where: { email } });
        if (existing) {
            return NextResponse.json(
                { error: 'Guest with this email already exists' },
                { status: 409 }
            );
        }

        const guest = await prisma.guest.create({
            data: {
                fullName,
                email,
                phone,
                address: address || null,
                idProof: idProof || null,
            },
        });

        return NextResponse.json({ guest }, { status: 201 });
    } catch (error) {
        console.error('Error creating guest:', error);
        return NextResponse.json(
            { error: 'Failed to create guest' },
            { status: 500 }
        );
    }
}
