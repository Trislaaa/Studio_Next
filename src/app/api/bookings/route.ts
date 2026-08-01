import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createHmac } from 'crypto';
import { prisma } from '@/lib/db';
import { calculateBookingPriceBreakdown, type AddonItem } from '@/lib/pricing';
import { getAvailableRooms } from '@/lib/availability';
import { z } from 'zod';
import { checkApiRateLimit } from '@/lib/api-rate-limit';

// ─── ID Proof Validation Patterns ────────────────────────────────────────────
// These match Indian government-issued ID formats exactly.
const ID_PROOF_PATTERNS: Record<string, RegExp> = {
    aadhar: /^\d{12}$/,                                     // 12-digit numeric
    passport: /^[A-Z][1-9][0-9]{7}$/,                       // Letter + 7 alphanumeric (e.g. A1234567)
    driving_license: /^[A-Z]{2}[0-9]{2}[0-9]{4}[0-9]{7}$/, // e.g. MH0120240123456
    voter_id: /^[A-Z]{3}[0-9]{7}$/,                         // 3 letters + 7 digits (e.g. ABC1234567)
};

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const addonInputSchema = z.object({
    id: z.string().min(1),
    quantity: z.number().int().positive().default(1),
});

const cartItemSchema = z.object({
    roomId: z.string().optional().nullable(),
    roomType: z.string().min(1),
    qty: z.number().int().positive().default(1)
});

const bookingRequestSchema = z.object({
    cart: z.array(cartItemSchema).min(1, 'Cart must contain at least one room'),
    checkIn: z.string().min(1),
    checkOut: z.string().min(1),
    numberOfGuests: z.number().int().positive(),
    addons: z.array(addonInputSchema).default([]),
    guest: z.object({
        fullName: z.string().min(2, 'Full name must be at least 2 characters'),
        email: z.string().email('Invalid email address'),
        // Indian mobile: must start with 6-9, exactly 10 digits
        phone: z
            .string()
            .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number starting with 6-9'),
        idProofType: z.enum(['aadhar', 'passport', 'driving_license', 'voter_id'], {
            errorMap: () => ({ message: 'Please select a valid ID proof type' }),
        }),
        idProofNumber: z.string().min(1, 'ID proof number is required'),
        idProofImageUrl: z.string().url().optional(),
        address: z.object({
            street: z.string().min(1, 'Street address is required'),
            city: z.string().min(1, 'City is required'),
            state: z.string().min(1, 'State is required'),
            country: z.string().min(1, 'Country is required'),
            zipCode: z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit Indian PIN code'),
        }),
    }),
    specialRequests: z.string().optional(),
    couponCode: z.string().optional(),
}).refine((value) => {
    // Cross-field validation: ID proof number must match the format for the selected ID type
    const pattern = ID_PROOF_PATTERNS[value.guest.idProofType];
    if (!pattern) return false;
    return pattern.test(value.guest.idProofNumber.replace(/\s/g, '').toUpperCase());
}, {
    message: 'ID proof number does not match the expected format for the selected ID type',
    path: ['guest', 'idProofNumber'],
});

// ─── HMAC Token (sign booking payload so verify endpoint trusts it) ───────────

/**
 * Signs the booking payload using HMAC-SHA256.
 * The verify endpoint uses the same secret to confirm the payload wasn't tampered with.
 * We intentionally do NOT use JWT to avoid adding a dependency.
 * Format: base64url(JSON payload) + "." + base64url(HMAC signature)
 */
function getBookingTokenSecret(): string {
    const secret =
        process.env.BOOKING_TOKEN_SECRET ??
        process.env.MANAGE_BOOKING_TOKEN_SECRET ??
        process.env.NEXTAUTH_SECRET;
    if (!secret) throw new Error('Booking token secret is not configured');
    return secret;
}

export type BookingTokenPayload = {
    v: 1;
    rooms: {
        roomId: string;
        roomNumber: string;
        baseRate: number;
        weekendMultiplier: number;
        baseOccupancy: number;
        extraGuestChargePerNight: number;
    }[];
    checkIn: string;   // ISO string
    checkOut: string;  // ISO string
    numberOfGuests: number;
    addons: AddonItem[];
    guest: {
        fullName: string;
        email: string;
        phone: string;
        idProofType: string;
        idProofNumber: string;
        idProofImageUrl?: string;
        address: {
            street: string;
            city: string;
            state: string;
            country: string;
            zipCode: string;
        };
    };
    specialRequests?: string;
    couponId?: string;
    iat: number; // issued at (ms)
    exp: number; // expiry (ms) — 30 minutes to complete payment
};

function signBookingToken(payload: BookingTokenPayload): string {
    const secret = getBookingTokenSecret();
    const payloadJson = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', secret).update(payloadJson).digest('base64url');
    return `bkt1.${payloadJson}.${sig}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildBookingReference() {
    const now = new Date();
    const datePart = now.toISOString().split('T')[0].replace(/-/g, '');
    const { randomBytes } = require('crypto');
    const randomPart = randomBytes(4).toString('hex').toUpperCase();
    return `OMK-${datePart}-${randomPart}`;
}

function parseAddonsConfig(raw: unknown): { id: string; name: string; price: number }[] {
    if (!raw) return [];
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((item) => ({
                id: item.id,
                name: item.name,
                price: Number(item.price ?? 0),
            }))
            .filter((item) => Boolean(item.id));
    } catch {
        return [];
    }
}

function extractErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'object' && error !== null) {
        const err = error as { error?: { description?: string; reason?: string } };
        if (err.error?.description) return err.error.description;
        if (err.error?.reason) return err.error.reason;
    }
    return fallback;
}

function isRazorpayAuthError(error: unknown): boolean {
    return /authentication failed/i.test(extractErrorMessage(error, ''));
}

// ─── POST /api/bookings ───────────────────────────────────────────────────────
/**
 * SECURITY: This endpoint intentionally does NOT write anything to the database.
 *
 * Design rationale:
 *   - Previously, calling this endpoint created a PENDING booking in the DB immediately.
 *   - Any user could submit the form and abandon the Razorpay modal, leaving orphan PENDING
 *     bookings that blocked room availability and appeared in the admin panel.
 *   - Now the flow is:
 *       1. Validate → check availability → calculate pricing (no DB write)
 *       2. Create a Razorpay order
 *       3. Sign the validated booking details into a tamper-proof token (HMAC)
 *       4. Return the token + order to the frontend
 *       5. On payment success, the frontend calls /api/payments/razorpay/verify
 *       6. ONLY on successful signature verification does the DB write happen (Guest + Booking + Transaction)
 *
 *   This means: if a user submits the form but never pays, NOTHING is saved.
 *   Fake bookings are impossible.
 */
export async function POST(request: NextRequest) {
    try {
        // ── Rate limit: max 10 booking attempts per IP per 15 minutes ────────
        const rateLimit = await checkApiRateLimit(request, 'booking', {
            max: 10,
            windowMs: 15 * 60 * 1000, // 15 minutes
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: 'Too many booking requests. Please wait and try again.' },
                {
                    status: 429,
                    headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
                }
            );
        }

        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        const publicKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? keyId;

        if (!keyId || !keySecret || !publicKey) {
            return NextResponse.json({ error: 'Razorpay keys are not configured' }, { status: 500 });
        }

        const body = await request.json();
        const validated = bookingRequestSchema.parse(body);

        const checkIn = new Date(validated.checkIn);
        const checkOut = new Date(validated.checkOut);

        if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
            return NextResponse.json({ error: 'Invalid check-in or check-out date' }, { status: 400 });
        }

        if (checkIn >= checkOut) {
            return NextResponse.json(
                { error: 'Check-out date must be after check-in date' },
                { status: 400 }
            );
        }

        const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        if (nights < 1) {
            return NextResponse.json({ error: 'Minimum stay is 1 night' }, { status: 400 });
        }

        // ── Resolve rooms from cart ───────────────────────────────────────────
        let resolvedRooms: any[] = [];
        const availableRooms = await getAvailableRooms(checkIn, checkOut);

        for (const item of validated.cart) {
            let matches = [];
            if (item.roomId) {
                 matches = availableRooms.filter((r) => r.id === item.roomId);
                 if (matches.length < item.qty) {
                     return NextResponse.json({ error: `Specific room ${item.roomId} is no longer available.` }, { status: 409 });
                 }
                 for (let i=0; i<item.qty; i++) resolvedRooms.push(matches[0]);
            } else {
                 matches = availableRooms.filter((r) => r.type === item.roomType && !resolvedRooms.some((rr) => rr.id === r.id));
                 if (matches.length < item.qty) {
                     return NextResponse.json({ error: `Not enough ${item.roomType} rooms available. Requested: ${item.qty}, Available: ${matches.length}` }, { status: 409 });
                 }
                 for (let i=0; i<item.qty; i++) resolvedRooms.push(matches[i]);
            }
        }

        // ── Validate guest count against total room capacity ──────────────────
        const totalCapacity = resolvedRooms.reduce((sum: number, r: any) => sum + (r.maxOccupancy ?? 3), 0);
        if (validated.numberOfGuests > totalCapacity) {
            return NextResponse.json(
                { error: `${validated.numberOfGuests} guests exceed total room capacity of ${totalCapacity}. Please select additional rooms.` },
                { status: 400 }
            );
        }

        // ── Pricing ───────────────────────────────────────────────────────────

        const addonsConfigRecord = await prisma.hotelConfig.findUnique({ where: { key: 'addons' } });
        const addonsCatalog = parseAddonsConfig(addonsConfigRecord?.value);

        const resolvedAddons: AddonItem[] = validated.addons
            .map((selected) => {
                const match = addonsCatalog.find((a) => a.id === selected.id);
                if (!match) return null;
                return {
                    id: match.id,
                    name: match.name,
                    price: match.price,
                    quantity: selected.quantity ?? 1,
                };
            })
            .filter(Boolean) as AddonItem[];

        // ── Validate Coupon ───────────────────────────────────────────────────
        let activeCoupon = null;
        if (validated.couponCode) {
            const cp = await prisma.coupon.findUnique({
                where: { code: validated.couponCode.toUpperCase() },
            });
            
            const nowTime = new Date();
            if (
                cp &&
                cp.isActive &&
                nowTime >= cp.validFrom &&
                nowTime <= cp.validUntil &&
                (cp.maxUses === null || cp.currentUses < cp.maxUses)
            ) {
                activeCoupon = {
                    id: cp.id,
                    type: cp.discountType,
                    value: cp.discountValue.toNumber(), // Convert Decimal to number
                };
            } else {
                return NextResponse.json(
                    { error: 'Invalid or expired coupon code' },
                    { status: 400 }
                );
            }
        }

        const pricing = calculateBookingPriceBreakdown({
            rooms: resolvedRooms.map((r) => ({
                roomId: r.id,
                baseRate: r.baseRate,
                weekendMultiplier: r.weekendMultiplier,
                baseOccupancy: r.baseOccupancy,
                extraGuestChargePerNight: r.extraGuestCharge
            })),
            checkIn,
            checkOut,
            numberOfGuests: validated.numberOfGuests,
            addons: resolvedAddons,
            coupon: activeCoupon ? { type: activeCoupon.type, value: activeCoupon.value } : null,
        });

        const amountPaise = Math.max(1, Math.round(pricing.totalAmount * 100));
        const bookingReference = buildBookingReference();

        // ── Create Razorpay order (no DB write yet) ───────────────────────────
        const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
        let order;
        try {
            order = await razorpay.orders.create({
                amount: amountPaise,
                currency: 'INR',
                receipt: bookingReference,
                notes: {
                    roomIds: resolvedRooms.map((r) => r.id).join(','),
                    checkIn: validated.checkIn,
                    checkOut: validated.checkOut,
                },
            });
        } catch (err) {
            if (isRazorpayAuthError(err)) {
                throw new Error(
                    'Razorpay authentication failed. Verify RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are valid.'
                );
            }
            throw new Error(extractErrorMessage(err, 'Failed to create Razorpay order'));
        }

        // ── Sign the booking payload (so verify endpoint can trust it) ────────
        const now = Date.now();
        const tokenPayload: BookingTokenPayload = {
            v: 1,
            rooms: resolvedRooms.map((r) => ({
                roomId: r.id,
                roomNumber: r.roomNumber,
                baseRate: r.baseRate,
                weekendMultiplier: r.weekendMultiplier,
                baseOccupancy: r.baseOccupancy,
                extraGuestChargePerNight: r.extraGuestCharge
            })),
            checkIn: checkIn.toISOString(),
            checkOut: checkOut.toISOString(),
            numberOfGuests: validated.numberOfGuests,
            addons: resolvedAddons,
            guest: {
                fullName: validated.guest.fullName,
                email: validated.guest.email,
                phone: validated.guest.phone,
                idProofType: validated.guest.idProofType,
                idProofNumber: validated.guest.idProofNumber,
                idProofImageUrl: validated.guest.idProofImageUrl,
                address: {
                    street: validated.guest.address.street,
                    city: validated.guest.address.city,
                    state: validated.guest.address.state,
                    country: validated.guest.address.country,
                    zipCode: validated.guest.address.zipCode,
                },
            },
            specialRequests: validated.specialRequests,
            couponId: activeCoupon?.id,
            iat: now,
            exp: now + 30 * 60 * 1000, // 30 minutes to complete payment
        };

        const bookingToken = signBookingToken(tokenPayload);

        return NextResponse.json(
            {
                bookingToken,
                bookingReference,
                order,
                pricing,
                razorpayKey: publicKey,
                rooms: resolvedRooms.map((r) => ({
                    id: r.id,
                    number: r.roomNumber,
                    type: r.type,
                })),
            },
            { status: 200 }
        );
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation failed', details: error.issues },
                { status: 400 }
            );
        }
        console.error('Error creating booking order:', error);
        const message = extractErrorMessage(error, 'Failed to create booking order');
        const status = /Razorpay authentication failed/i.test(message) ? 502 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
