import { prisma } from './db';
import type { Prisma } from '@prisma/client';
import { broadcastInventory } from './realtime';
import { calculateBookingPriceBreakdown } from './pricing';
export { calculateBookingPriceBreakdown } from './pricing';
import { isPastCheckoutTime, todayIST } from './hotelPolicy';

export interface AvailabilityParams {
    checkIn: Date;
    checkOut: Date;
    roomId?: string;
}

export interface RoomAvailability {
    roomId: string;
    available: boolean;
    reason?: string;
}

/**
 * Check if a specific room is available for the given date range.
 *
 * OTA-style same-day turnover logic:
 *  - A room's booking checkOut date == new booking's checkIn date → NOT overlapping.
 *    The DB overlap query already handles this correctly (checkOut: { gt: checkIn }).
 *  - HOWEVER: on the same day as checkout, rooms are only available AFTER 10 AM IST.
 *    Before 10 AM the departing guest hasn't left yet, so we must block same-day check-in.
 */
export async function checkRoomAvailability(
    roomId: string,
    checkIn: Date,
    checkOut: Date
): Promise<boolean> {
    // Find any overlapping bookings for this room.
    // The overlap conditions below CORRECTLY allow same-day turnover:
    //   existing checkOut == new checkIn → NOT overlapping (checkOut: { gt: checkIn } is false)
    const overlappingBookingsRaw = await prisma.booking.findMany({
        where: {
            rooms: { some: { roomId } },
            status: {
                in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'],
            },
            OR: [
                {
                    // Existing booking starts during our requested period
                    AND: [
                        { checkIn: { gte: checkIn } },
                        { checkIn: { lt: checkOut } },
                    ],
                },
                {
                    // Existing booking ends during our requested period (strictly inside)
                    AND: [
                        { checkOut: { gt: checkIn } },
                        { checkOut: { lte: checkOut } },
                    ],
                },
                {
                    // Existing booking completely encompasses our requested period
                    AND: [
                        { checkIn: { lte: checkIn } },
                        { checkOut: { gte: checkOut } },
                    ],
                },
            ],
        },
    });

    // Filter out abandoned PENDING bookings (older than 15 minutes)
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const overlappingBookings = overlappingBookingsRaw.filter(b => 
        b.status !== 'PENDING' || b.createdAt >= fifteenMinsAgo
    );

    if (overlappingBookings.length > 0) return false;

    // ── OTA TIME POLICY ──────────────────────────────────────────────────────
    // If the requested checkIn is TODAY (IST), we must also enforce:
    //   - Same-day check-in is only allowed on or after 11 AM IST (handled on the frontend).
    //   - But more importantly: if there's a booking checking out TODAY, the room
    //     is physically unavailable until 10 AM IST (checkout deadline).
    //
    // Check: is there a CHECKED_IN booking for this room that checks out today?
    const checkInDateStr = todayIST();
    const requestedCheckInStr = new Date(checkIn.getTime() + 5.5 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

    if (requestedCheckInStr === checkInDateStr) {
        // Is there a booking that checks out today (and the guest hasn't physically left yet)?
        const istOffsetMs = 5.5 * 60 * 60 * 1000;
        const nowInIST = new Date(Date.now() + istOffsetMs);
        const startOfTodayUTC = new Date(
            Date.UTC(nowInIST.getUTCFullYear(), nowInIST.getUTCMonth(), nowInIST.getUTCDate())
        );
        const endOfTodayUTC = new Date(startOfTodayUTC.getTime() + 24 * 60 * 60 * 1000);

        const checkingOutToday = await prisma.booking.findFirst({
            where: {
                rooms: { some: { roomId } },
                status: 'CHECKED_IN',
                checkOut: { gte: startOfTodayUTC, lt: endOfTodayUTC },
            },
        });

        if (checkingOutToday && !isPastCheckoutTime()) {
            // Departing guest hasn't passed checkout deadline — room not available yet
            return false;
        }
    }

    // Check for overlapping room blocks (inventory closures)
    let overlappingBlocks = [] as Array<unknown>;
    try {
        overlappingBlocks = await prisma.roomBlock.findMany({
            where: {
                roomId,
                OR: [
                    {
                        AND: [
                            { startDate: { lte: checkIn } },
                            { endDate: { gt: checkIn } },
                        ],
                    },
                    {
                        AND: [
                            { startDate: { lt: checkOut } },
                            { endDate: { gte: checkOut } },
                        ],
                    },
                    {
                        AND: [
                            { startDate: { gte: checkIn } },
                            { endDate: { lte: checkOut } },
                        ],
                    },
                ],
            },
        });
    } catch (err) {
        // If the RoomBlock table isn't migrated yet, avoid hard-failing availability
        console.warn('RoomBlock query failed; treating as no blocks. Error:', err);
        overlappingBlocks = [];
    }

    return overlappingBlocks.length === 0;
}

/**
 * Get all available rooms for a given date range.
 *
 * Inventory logic:
 *  - MAINTENANCE / OUT_OF_ORDER rooms are permanently excluded.
 *  - AVAILABLE, OCCUPIED, CLEANING rooms are all candidates — their
 *    actual availability is determined purely by booking overlap checks.
 *    This means:
 *      • A room booked Apr 1→2 will reappear on site from Apr 2 onwards.
 *      • After a guest checks out, the room immediately shows as bookable
 *        for future dates (even while in CLEANING state).
 *  - For same-day searches, an OCCUPIED room won't pass its overlap check
 *    anyway (a current booking blocks the date), so no double-booking risk.
 */
export async function getAvailableRooms(checkIn: Date, checkOut: Date) {
    // Exclude only rooms that are permanently out of service
    const allRooms = await prisma.room.findMany({
        where: {
            status: {
                notIn: ['MAINTENANCE', 'OUT_OF_ORDER'],
            },
        },
        include: {
            rates: {
                where: {
                    effectiveFrom: { lte: checkIn },
                    OR: [
                        { effectiveTo: null },
                        { effectiveTo: { gte: checkIn } },
                    ],
                },
                orderBy: {
                    effectiveFrom: 'desc',
                },
                take: 1,
            },
        },
    });

    // Check availability for each room (booking-based overlap check)
    const availabilityChecks: (Prisma.RoomGetPayload<{
        include: {
            rates: {
                where: {
                    effectiveFrom: { lte: Date };
                    OR: ({ effectiveTo: null } | { effectiveTo: { gte: Date } })[];
                };
                orderBy: { effectiveFrom: 'desc' };
                take: 1;
            };
        };
    }> & { available: boolean })[] = await Promise.all(
        allRooms.map(async (room) => {
            const isAvailable = await checkRoomAvailability(room.id, checkIn, checkOut);
            return {
                ...room,
                available: isAvailable,
            };
        })
    );

    // Return only booking-available rooms
    return availabilityChecks
        .filter((room) => room.available)
        .map((room) => ({
            id: room.id,
            roomNumber: room.roomNumber,
            type: room.type,
            maxOccupancy: room.maxOccupancy,
            description: room.description,
            amenities: typeof (room.amenities as any) === 'string'
                ? (JSON.parse(room.amenities as unknown as string) as string[])
                : ((room.amenities as unknown as string[]) ?? []),
            images: typeof (room.images as any) === 'string'
                ? (JSON.parse(room.images as unknown as string) as string[])
                : ((room.images as unknown as string[]) ?? []),
            baseRate: room.rates[0]?.baseRate.toNumber() || 0,
            weekendMultiplier: room.rates[0]?.weekendMultiplier.toNumber() || 1.2,
            baseOccupancy: room.baseOccupancy,
            extraGuestCharge: room.extraGuestCharge?.toNumber() || 0,
            status: room.status,
        }));
}

/**
 * Calculate the total price for a room booking.
 * Fix 3+4: Delegates to the centralized pricing engine.
 * weekendMultiplier must come from the DB rate record (not hardcoded).
 *
 * @deprecated Use calculateBookingPriceBreakdown() from pricing.ts for full breakdown.
 */
export function calculateBookingPrice(
    baseRate: number,
    checkIn: Date,
    checkOut: Date,
    weekendMultiplier: number = 1.2, // Fix 3: default matches DB schema default
    numberOfGuests: number = 1,
    baseOccupancy: number = 2,
    extraGuestChargePerNight: number = 0
): number {
    const breakdown = calculateBookingPriceBreakdown({
        rooms: [{ roomId: 'legacy', baseRate, weekendMultiplier, baseOccupancy, extraGuestChargePerNight }],
        checkIn,
        checkOut,
        numberOfGuests,
        addons: [],
    });
    return breakdown.totalAmount;
}

/**
 * Prevent double bookings by creating a booking with proper validation
 */
export async function createBooking(data: {
    guestId: string;
    roomId: string;
    checkIn: Date;
    checkOut: Date;
    numberOfGuests: number;
    totalAmount: number;
    addons?: Array<{ addonType: string; name: string; quantity: number; price: number }>;
}) {
    // Use an interactive transaction + advisory lock per room to prevent race conditions
    return await prisma.$transaction(async (tx) => {
        // Acquire advisory lock for this room within the transaction
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${data.roomId}))`;

        // Re-check overlapping bookings within the transaction
        const overlappingBookingsRaw = await tx.booking.findMany({
            where: {
                rooms: { some: { roomId: data.roomId } },
                status: { in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
                OR: [
                    { AND: [{ checkIn: { gte: data.checkIn } }, { checkIn: { lt: data.checkOut } }] },
                    { AND: [{ checkOut: { gt: data.checkIn } }, { checkOut: { lte: data.checkOut } }] },
                    { AND: [{ checkIn: { lte: data.checkIn } }, { checkOut: { gte: data.checkOut } }] },
                ],
            },
        });

        // Ignore PENDING bookings older than 15 minutes (abandoned checkouts)
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
        const overlappingBookings = overlappingBookingsRaw.filter(b => 
            b.status !== 'PENDING' || b.createdAt >= fifteenMinsAgo
        );

        if (overlappingBookings.length > 0) {
            throw new Error('Room is no longer available for the selected dates');
        }

        // Check for overlapping blocks (best-effort in case table is missing)
        try {
            const overlappingBlocks = await tx.roomBlock.findMany({
                where: {
                    roomId: data.roomId,
                    OR: [
                        { AND: [{ startDate: { lte: data.checkIn } }, { endDate: { gt: data.checkIn } }] },
                        { AND: [{ startDate: { lt: data.checkOut } }, { endDate: { gte: data.checkOut } }] },
                        { AND: [{ startDate: { gte: data.checkIn } }, { endDate: { lte: data.checkOut } }] },
                    ],
                },
            });
            if (overlappingBlocks.length > 0) {
                throw new Error('Room is blocked for these dates');
            }
        } catch {
            // ignore when table not available
        }

        // Generate unique booking reference
        const now = new Date();
        const bookingReference = `OMK-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        // Fix 1+2: Use centralized pricing to calculate GST correctly
        // We need the room's baseOccupancy and extraGuestCharge for pricing
        const roomForPrice = await tx.room.findUnique({
            where: { id: data.roomId },
            include: { rates: { orderBy: { effectiveFrom: 'desc' }, take: 1 } },
        });
        const pricingBreakdown = calculateBookingPriceBreakdown({
            rooms: [{
                roomId: data.roomId,
                baseRate: roomForPrice?.rates[0]?.baseRate.toNumber() || data.totalAmount,
                weekendMultiplier: roomForPrice?.rates[0]?.weekendMultiplier.toNumber() || 1.2,
                baseOccupancy: roomForPrice?.baseOccupancy || 2,
                extraGuestChargePerNight: roomForPrice?.extraGuestCharge?.toNumber() || 0,
            }],
            checkIn: data.checkIn,
            checkOut: data.checkOut,
            numberOfGuests: data.numberOfGuests,
            addons: data.addons ? data.addons.map(a => ({ id: a.addonType, name: a.name, price: Number(a.price), quantity: a.quantity })) : [],
        });

        const booking = await tx.booking.create({
            data: {
                bookingReference,
                guestId: data.guestId,
                rooms: { create: [{ roomId: data.roomId }] },
                checkIn: data.checkIn,
                checkOut: data.checkOut,
                numberOfGuests: data.numberOfGuests,
                totalAmount: pricingBreakdown.totalAmount,
                taxAmount: pricingBreakdown.gstAmount,
                status: 'PENDING',
                addons: data.addons
                    ? {
                        create: data.addons.map((addon) => ({
                            addonType: addon.addonType,
                            name: addon.name,
                            quantity: addon.quantity,
                            price: addon.price,
                        })),
                    }
                    : undefined,
            },
            include: { rooms: { include: { room: true } }, guest: true, addons: true },
        });

        // Broadcast inventory update (best-effort)
        await broadcastInventory({
            type: 'booking:created',
            payload: {
                roomId: data.roomId,
                checkIn: data.checkIn.toISOString(),
                checkOut: data.checkOut.toISOString(),
            },
        });

        return booking;
    });
}
