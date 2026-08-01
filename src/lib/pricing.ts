/**
 * STUDIO NEXT — Centralized Pricing Engine
 *
 * All pricing, tax, and surcharge calculations must go through this module.
 * This ensures consistency across booking creation, admin panel, and public APIs.
 *
 * GST Rules (India, as per GST Notification No. 11/2017):
 *  - Per-night room rate < ₹1,000    → 0% GST
 *  - Per-night room rate ₹1,001–₹7,500 → 12% GST
 *  - Per-night room rate > ₹7,500    → 18% GST
 */

// ─── GST ────────────────────────────────────────────────────────────────────

/**
 * Returns the applicable GST rate (as a decimal, e.g. 0.12 = 12%)
 * based on the per-night room rate (INR).
 */
export function getGstRate(perNightRate: number): number {
    if (perNightRate <= 1000) return 0;
    if (perNightRate <= 7500) return 0.12;
    return 0.18;
}

/**
 * Calculates GST amount for a given base amount at the applicable rate.
 * The gstRate is derived from the per-night rate, not the total room amount.
 */
export function calculateGst(baseAmount: number, perNightRate: number): number {
    const rate = getGstRate(perNightRate);
    return Math.round(baseAmount * rate * 100) / 100;
}

// ─── NIGHT COUNT ─────────────────────────────────────────────────────────────

/**
 * Returns the number of nights between check-in and check-out.
 * Uses Math.ceil to handle partial days consistently.
 */
export function calculateNights(checkIn: Date, checkOut: Date): number {
    const ms = checkOut.getTime() - checkIn.getTime();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// ─── PER-NIGHT RATE ───────────────────────────────────────────────────────────

/**
 * Returns the rate for a specific calendar day.
 * Uses the weekend multiplier from the database rate record.
 * Saturday (6) and Sunday (0) are considered weekend.
 */
export function getNightRate(baseRate: number, date: Date, weekendMultiplier: number = 1.2): number {
    const day = date.getDay();
    const isWeekend = day === 0 || day === 6;
    return isWeekend ? Math.round(baseRate * weekendMultiplier) : baseRate;
}

// ─── ROOM TOTAL ───────────────────────────────────────────────────────────────

/**
 * Calculates the total room charge across all nights.
 * Uses the DB weekendMultiplier (not a hardcoded constant).
 *
 * @param baseRate         - Base nightly rate in INR
 * @param checkIn          - Check-in date
 * @param checkOut         - Check-out date
 * @param weekendMultiplier- From the DB rate record (default 1.2 = 20% premium)
 */
export function calculateRoomTotal(
    baseRate: number,
    checkIn: Date,
    checkOut: Date,
    weekendMultiplier: number = 1.2
): { nights: number; roomTotal: number; weekendNights: number; weekdayNights: number } {
    const nights = calculateNights(checkIn, checkOut);
    let roomTotal = 0;
    let weekendNights = 0;
    let weekdayNights = 0;

    const cursor = new Date(checkIn);
    for (let i = 0; i < nights; i++) {
        const rate = getNightRate(baseRate, cursor, weekendMultiplier);
        roomTotal += rate;
        if (cursor.getDay() === 0 || cursor.getDay() === 6) {
            weekendNights++;
        } else {
            weekdayNights++;
        }
        cursor.setDate(cursor.getDate() + 1);
    }

    return { nights, roomTotal, weekendNights, weekdayNights };
}

// ─── EXTRA GUEST CHARGE ───────────────────────────────────────────────────────

/**
 * Calculates extra guest charge for guests beyond the base occupancy.
 *
 * @param numberOfGuests   - Actual number of guests in the booking
 * @param baseOccupancy    - Number of guests included in base rate (from room)
 * @param extraGuestCharge - Per-extra-guest per-night charge (from room)
 * @param nights           - Number of nights
 */
export function calculateExtraGuestCharge(
    numberOfGuests: number,
    baseOccupancy: number,
    extraGuestCharge: number,
    nights: number
): number {
    const extraGuests = Math.max(0, numberOfGuests - baseOccupancy);
    return extraGuests * extraGuestCharge * nights;
}

// ─── ADD-ONS TOTAL ────────────────────────────────────────────────────────────

export interface AddonItem {
    id: string;
    name: string;
    price: number;
    quantity?: number;
}

/**
 * Calculates the total cost of selected addons.
 * Addon prices are per-stay (not per-night) unless specified.
 */
export function calculateAddonsTotal(addons: AddonItem[]): number {
    return addons.reduce((sum, a) => sum + a.price * (a.quantity ?? 1), 0);
}

// ─── FULL BOOKING PRICE ───────────────────────────────────────────────────────

import { DiscountType } from '@prisma/client';

export interface RoomBookingInput {
    roomId: string;
    baseRate: number;
    weekendMultiplier: number;
    baseOccupancy: number;           
    extraGuestChargePerNight: number;
}

export interface BookingPriceInput {
    rooms: RoomBookingInput[];
    checkIn: Date;
    checkOut: Date;
    numberOfGuests: number;
    addons: AddonItem[];
    coupon?: {
        type: DiscountType;
        value: number; // Decimal converted to number
    } | null;
}

export interface BookingPriceBreakdown {
    nights: number;
    weekdayNights: number;
    weekendNights: number;
    roomTotal: number;
    extraGuestCharge: number;
    addonsTotal: number;
    subtotal: number;
    discountAmount: number;
    gstRate: number;           // Represents primary GST rate or an average across rooms
    gstAmount: number;
    totalAmount: number;
}

/**
 * Master function: calculates the complete price breakdown for a booking.
 * This is the SINGLE source of truth for all pricing.
 */
export function calculateBookingPriceBreakdown(input: BookingPriceInput): BookingPriceBreakdown {
    const nights = calculateNights(input.checkIn, input.checkOut);
    
    let roomTotal = 0;
    let weekendNights = 0;
    let weekdayNights = 0;
    let totalBaseOccupancy = 0;
    
    let totalGstAmount = 0;
    let firstRoomStats: { weekendNights: number; weekdayNights: number } | null = null;
    
    // Sum up room totals
    for (const room of input.rooms) {
        const stats = calculateRoomTotal(room.baseRate, input.checkIn, input.checkOut, room.weekendMultiplier);
        roomTotal += stats.roomTotal;
        totalBaseOccupancy += room.baseOccupancy;
        
        if (!firstRoomStats) {
            firstRoomStats = { weekendNights: stats.weekendNights, weekdayNights: stats.weekdayNights };
        }
    }
    
    if (firstRoomStats) {
        weekendNights = firstRoomStats.weekendNights;
        weekdayNights = firstRoomStats.weekdayNights;
    }

    const maxExtraGuestCharge = input.rooms.length > 0 
        ? Math.max(...input.rooms.map(r => r.extraGuestChargePerNight)) 
        : 0;

    const extraGuestCharge = calculateExtraGuestCharge(
        input.numberOfGuests,
        totalBaseOccupancy,
        maxExtraGuestCharge,
        nights
    );

    const addonsTotal = calculateAddonsTotal(input.addons);

    let subtotal = roomTotal + extraGuestCharge + addonsTotal;
    
    // Apply discount — always round to 2 dp immediately
    let discountAmount = 0;
    if (input.coupon) {
        if (input.coupon.type === DiscountType.PERCENTAGE) {
            discountAmount = Math.round(Math.min(subtotal, (subtotal * input.coupon.value) / 100) * 100) / 100;
        } else if (input.coupon.type === DiscountType.FIXED) {
            discountAmount = Math.round(Math.min(subtotal, input.coupon.value) * 100) / 100;
        }
    }
    
    const discountRatio = subtotal > 0 ? discountAmount / subtotal : 0;
    
    // Calculate precise GST per room after applying discount proportionally.
    // GST tier (0%, 12%, 18%) is determined by the DECLARED per-night tariff (baseRate),
    // but GST is levied on the taxable value after discount — per Indian GST notification 11/2017.
    for (const room of input.rooms) {
        const stats = calculateRoomTotal(room.baseRate, input.checkIn, input.checkOut, room.weekendMultiplier);
        const roomTaxable = Math.round(stats.roomTotal * (1 - discountRatio) * 100) / 100;
        totalGstAmount += calculateGst(roomTaxable, room.baseRate);
    }
    
    // Addons/Extra guests use the first room's base rate for GST tier
    const extraTaxable = Math.round((extraGuestCharge + addonsTotal) * (1 - discountRatio) * 100) / 100;
    if (extraTaxable > 0 && input.rooms.length > 0) {
        totalGstAmount += calculateGst(extraTaxable, input.rooms[0].baseRate);
    }
    
    const gstAmount = Math.round(totalGstAmount * 100) / 100;
    const taxableAmount = Math.round((subtotal - discountAmount) * 100) / 100;
    const totalAmount = Math.round((taxableAmount + gstAmount) * 100) / 100;

    return {
        nights,
        weekdayNights,
        weekendNights,
        roomTotal,
        extraGuestCharge,
        addonsTotal,
        subtotal,
        discountAmount,
        gstRate: input.rooms.length > 0 ? getGstRate(input.rooms[0].baseRate) : 0,
        gstAmount,
        totalAmount,
    };
}
