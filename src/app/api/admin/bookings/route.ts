import { NextRequest, NextResponse } from 'next/server';
import { BookingStatus, type Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { createBookingSchema } from '@/lib/validations/booking';
import { calculateBookingPriceBreakdown } from '@/lib/pricing';
import { sendBookingConfirmation } from '@/lib/email';
import { randomBytes } from 'crypto';
import { z } from 'zod';

function readMetadataObject(value: Prisma.JsonValue | null): Record<string, unknown> {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
        return {};
    }

    return value as Record<string, unknown>;
}

function extractCancellationAudit(value: Prisma.JsonValue | null) {
    const metadata = readMetadataObject(value);
    const cancellation = metadata.cancellation;

    if (!cancellation || Array.isArray(cancellation) || typeof cancellation !== 'object') {
        return null;
    }

    const audit = cancellation as Record<string, unknown>;

    return {
        actor: typeof audit.actor === 'string' ? audit.actor : null,
        cancelledAt: typeof audit.cancelledAt === 'string' ? audit.cancelledAt : null,
        refundAmount: typeof audit.refundAmount === 'number' ? audit.refundAmount : 0,
        refundPercentage: typeof audit.refundPercentage === 'number' ? audit.refundPercentage : 0,
        refundGatewayId: typeof audit.refundGatewayId === 'string' ? audit.refundGatewayId : null,
        policyWindow: typeof audit.policyWindow === 'string' ? audit.policyWindow : null,
        cancellationReason: typeof audit.cancellationReason === 'string' ? audit.cancellationReason : null,
    };
}

function isBookingStatus(value: string): value is BookingStatus {
    return Object.values(BookingStatus).includes(value as BookingStatus);
}

type BookingCursor = {
    createdAt: string;
    id: string;
};

function parseLimit(raw: string | null) {
    if (!raw) return 100;

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return 100;
    }

    return Math.min(parsed, 250);
}

function encodeCursor(cursor: BookingCursor) {
    return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeCursor(raw: string | null): BookingCursor | null {
    if (!raw) return null;

    try {
        const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<BookingCursor>;
        if (typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string') {
            return null;
        }

        const asDate = new Date(parsed.createdAt);
        if (Number.isNaN(asDate.getTime())) {
            return null;
        }

        return {
            createdAt: asDate.toISOString(),
            id: parsed.id,
        };
    } catch {
        return null;
    }
}

// GET /api/admin/bookings - Fetch all bookings with filters
export async function GET(request: NextRequest) {
    try {
        const guard = await requireAuth(request, ['ADMIN', 'MANAGER', 'RECEPTION']);
        if (guard.error) return guard.error;

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const search = searchParams.get('search');
        const statusFilter = status && status !== 'all' && isBookingStatus(status) ? status : undefined;
        const limit = parseLimit(searchParams.get('limit'));

        const cursorParam = searchParams.get('cursor');
        const cursor = decodeCursor(cursorParam);
        if (cursorParam && !cursor) {
            return NextResponse.json(
                { error: 'Invalid cursor' },
                { status: 400, headers: { 'Cache-Control': 'no-store' } }
            );
        }

        const searchFilter: Prisma.BookingWhereInput | undefined = search
            ? {
                OR: [
                    { bookingReference: { contains: search, mode: 'insensitive' as const } },
                    { guest: { fullName: { contains: search, mode: 'insensitive' as const } } },
                    { rooms: { some: { room: { roomNumber: { contains: search, mode: 'insensitive' as const } } } } },
                ],
            }
            : undefined;

        const where: Prisma.BookingWhereInput = {
            ...(statusFilter && { status: statusFilter }),
            ...(searchFilter ? searchFilter : {}),
        };

        if (cursor) {
            const cursorDate = new Date(cursor.createdAt);
            const existingAnd = Array.isArray(where.AND)
                ? where.AND
                : where.AND
                    ? [where.AND]
                    : [];

            where.AND = [
                ...existingAnd,
                {
                    OR: [
                        { createdAt: { lt: cursorDate } },
                        {
                            createdAt: cursorDate,
                            id: { lt: cursor.id },
                        },
                    ],
                },
            ];
        }

        const bookings = await prisma.booking.findMany({
            where,
            include: {
                guest: true,
                rooms: { include: { room: true } },
                transaction: true,
            },
            orderBy: [
                { createdAt: 'desc' },
                { id: 'desc' },
            ],
            take: limit + 1,
        });

        const pageRows = bookings.slice(0, limit);
        const hasMore = bookings.length > limit;
        const nextCursor = hasMore && pageRows.length > 0
            ? encodeCursor({
                createdAt: pageRows[pageRows.length - 1].createdAt.toISOString(),
                id: pageRows[pageRows.length - 1].id,
            })
            : null;

        const statusCountsWhere: Prisma.BookingWhereInput = {
            ...(searchFilter ? searchFilter : {}),
        };

        const statusCounts = await prisma.booking.groupBy({
            by: ['status'],
            where: statusCountsWhere,
            _count: { _all: true },
        });

        const summary = statusCounts.reduce<Record<string, number>>((acc, entry) => {
            acc[entry.status] = entry._count._all;
            return acc;
        }, {});

        summary.all = statusCounts.reduce((total, entry) => total + entry._count._all, 0);

        // Format bookings for frontend
        const formattedBookings = pageRows.map((booking) => ({
            id: booking.id,
            bookingReference: booking.bookingReference,
            roomId: booking.rooms[0]?.roomId ?? '',
            guestName: booking.guest.fullName,
            guestEmail: booking.guest.email,
            guestPhone: booking.guest.phone,
            guestIdProof: booking.guest.idProof as { type?: string; number?: string; image_url?: string } | null,
            room: booking.rooms.map(r => r.room.roomNumber).join(', '),
            roomType: booking.rooms.length > 1 ? 'Multiple' : booking.rooms[0]?.room.type,
            checkIn: booking.checkIn.toISOString().split('T')[0],
            checkOut: booking.checkOut.toISOString().split('T')[0],
            status: booking.status,
            totalAmount: booking.totalAmount.toNumber(),
            taxAmount: booking.taxAmount.toNumber(),
            discountAmount: booking.discountAmount.toNumber(),
            baseAmount: booking.totalAmount.toNumber() - booking.taxAmount.toNumber() + booking.discountAmount.toNumber(),
            paidAmount: booking.transaction ? booking.transaction.amount.toNumber() : 0,
            refundAmount: booking.transaction ? booking.transaction.refundAmount.toNumber() : 0,
            guests: booking.numberOfGuests,
            createdAt: booking.createdAt,
            pmsBookingId: booking.pmsBookingId,
            cancellationAudit: booking.transaction ? extractCancellationAudit(booking.transaction.metadata as Prisma.JsonValue | null) : null,
        }));

        return NextResponse.json(
            {
                bookings: formattedBookings,
                pagination: {
                    limit,
                    hasMore,
                    nextCursor,
                },
                summary,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('Error fetching bookings:', error);
        return NextResponse.json(
            { error: 'Failed to fetch bookings' },
            { status: 500 }
        );
    }
}

// POST /api/admin/bookings - Create a manual booking (walk-in)
export async function POST(request: NextRequest) {
    try {
        const guard = await requireAuth(request, ['ADMIN', 'MANAGER', 'RECEPTION']);
        if (guard.error) return guard.error;

        const body = await request.json();
        const validatedData = createBookingSchema.parse(body);

        const checkIn = new Date(validatedData.checkIn);
        const checkOut = new Date(validatedData.checkOut);

        // Validate dates
        if (checkIn >= checkOut) {
            return NextResponse.json(
                { error: 'Check-out date must be after check-in date' },
                { status: 400 }
            );
        }

        // Check room availability
        const room = await prisma.room.findUnique({
            where: { id: validatedData.roomId },
            include: { rates: { orderBy: { effectiveFrom: 'desc' }, take: 1 } },
        });

        if (!room) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        // Validate guest count does not exceed room's max occupancy
        if (validatedData.numberOfGuests > room.maxOccupancy) {
            return NextResponse.json(
                { error: `Guest count (${validatedData.numberOfGuests}) exceeds room max occupancy (${room.maxOccupancy}). Distribute guests across multiple rooms.` },
                { status: 400 }
            );
        }

        // Check for overlapping bookings
        // Include PENDING bookings only if they are recent (< 15 min old) —
        // older PENDING bookings are abandoned checkouts and should not block admin.
        const overlappingBookings = await prisma.booking.findMany({
            where: {
                rooms: { some: { roomId: validatedData.roomId } },
                status: { in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
                OR: [
                    {
                        checkIn: { lte: checkIn },
                        checkOut: { gt: checkIn },
                    },
                    {
                        checkIn: { lt: checkOut },
                        checkOut: { gte: checkOut },
                    },
                    {
                        checkIn: { gte: checkIn },
                        checkOut: { lte: checkOut },
                    },
                ],
            },
        });

        // Filter out abandoned PENDING bookings (older than 15 minutes)
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
        const activeOverlaps = overlappingBookings.filter(b =>
            b.status !== 'PENDING' || b.createdAt >= fifteenMinsAgo
        );

        if (activeOverlaps.length > 0) {
            return NextResponse.json(
                { error: 'Room is not available for the selected dates' },
                { status: 400 }
            );
        }

        // Get or create guest (upsert to handle returning guests with same email)
        let guestId = validatedData.guestId;
        if (!guestId && validatedData.guestInfo) {
            const { idProofType, idProofNumber, address, ...guestData } = validatedData.guestInfo;
            const guestPayload = {
                ...guestData,
                idProof: { type: idProofType, number: idProofNumber },
                address: address ? { street: address } : undefined,
            };
            const guest = await prisma.guest.upsert({
                where: { email: guestData.email },
                update: {
                    fullName: guestData.fullName,
                    phone: guestData.phone,
                    idProof: { type: idProofType, number: idProofNumber },
                    ...(address ? { address: { street: address } } : {}),
                },
                create: guestPayload,
            });
            guestId = guest.id;
        }

        if (!guestId) {
            return NextResponse.json(
                { error: 'Guest information is required' },
                { status: 400 }
            );
        }

        // Use overrideRate if admin negotiated a custom rate, otherwise use DB rate
        const baseRate = validatedData.overrideRate ?? (room.rates[0]?.baseRate?.toNumber() || 0);
        const weekendMultiplier = room.rates[0]?.weekendMultiplier?.toNumber() ?? 1.2;

        const addonsConfigRecord = await prisma.hotelConfig.findUnique({ where: { key: 'addons' } });
        const allAddons: { id: string; name: string; price: number }[] = addonsConfigRecord
            ? JSON.parse(addonsConfigRecord.value as string)
            : [];
        const resolvedAddons = validatedData.addons
            .map((id: string) => allAddons.find((a) => a.id === id))
            .filter(Boolean) as { id: string; name: string; price: number }[];

        const pricing = calculateBookingPriceBreakdown({
            rooms: [{
                roomId: room.id,
                baseRate,
                weekendMultiplier,
                baseOccupancy: room.baseOccupancy ?? 2,
                extraGuestChargePerNight: room.extraGuestCharge?.toNumber() ?? 0,
            }],
            checkIn,
            checkOut,
            numberOfGuests: validatedData.numberOfGuests,
            addons: resolvedAddons.map(a => ({ id: a.id, name: a.name, price: a.price })),
        });

        const totalAmount = pricing.totalAmount;
        const taxAmount = pricing.gstAmount;

        // Prepend override note to specialRequests for record keeping
        const overridePrefix = validatedData.overrideRate
            ? `[RATE OVERRIDE ₹${validatedData.overrideRate}/night${validatedData.overrideNote ? ` — ${validatedData.overrideNote}` : ''}] `
            : '';
        const specialRequests = overridePrefix + (validatedData.specialRequests || '');

        // Generate booking reference
        const datePart = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const randomPart = randomBytes(4).toString('hex').toUpperCase();
        const bookingReference = `OMK-${datePart}-${randomPart}`;

        // Create booking with transaction
        const booking = await prisma.booking.create({
            data: {
                bookingReference,
                guestId,
                rooms: {
                    create: [{ roomId: validatedData.roomId }]
                },
                checkIn,
                checkOut,
                numberOfGuests: validatedData.numberOfGuests,
                specialRequests: specialRequests.trim() || undefined,
                addons: resolvedAddons.length > 0 ? {
                    create: resolvedAddons.map((a) => ({
                        addonType: a.id,
                        name: a.name,
                        quantity: 1,
                        price: a.price,
                    })),
                } : undefined,
                totalAmount,
                taxAmount,
                status: validatedData.paidAmount >= totalAmount ? 'CONFIRMED' : 'PENDING',
                transaction: validatedData.paidAmount > 0 ? {
                    create: {
                        amount: validatedData.paidAmount,
                        paymentMethod: validatedData.paymentMethod,
                        status: validatedData.paidAmount >= totalAmount ? 'COMPLETED' : 'PROCESSING',
                        paymentGatewayId: `TXN-${Date.now()}`,
                    },
                } : undefined,
            },
            include: {
                guest: true,
                rooms: { include: { room: true } },
                transaction: true,
                addons: true,
            },
        });

        // ── Post-create side effects: email notification ──────────────────────
        // Send confirmation email for manual/offline bookings (non-blocking)
        if (booking.status === 'CONFIRMED' && booking.guest.email) {
            const nights = Math.ceil(
                (new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24)
            );
            sendBookingConfirmation({
                guestName: booking.guest.fullName,
                guestEmail: booking.guest.email,
                bookingReference: booking.bookingReference,
                roomType: booking.rooms[0]?.room.type,
                roomNumber: booking.rooms[0]?.room.roomNumber,
                checkIn: booking.checkIn,
                checkOut: booking.checkOut,
                numberOfGuests: booking.numberOfGuests,
                numberOfNights: nights,
                totalAmount: totalAmount,
                taxAmount: taxAmount,
                paymentMethod: validatedData.paymentMethod ?? 'CASH',
                specialRequests: booking.specialRequests ?? undefined,
                addons: booking.addons.map(a => a.name),
            }).then(result => {
                if (!result.success) console.error('[Email] Manual confirmation email failed:', result.error);
            }).catch(err => console.error('[Email] Manual confirmation error:', err));
        }

        return NextResponse.json({ booking }, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation failed', details: error.issues },
                { status: 400 }
            );
        }

        console.error('Error creating booking:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: 'Failed to create booking', details: errorMessage },
            { status: 500 }
        );
    }
}
