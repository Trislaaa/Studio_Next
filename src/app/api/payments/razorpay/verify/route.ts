import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createHmac, timingSafeEqual } from 'crypto';
import { PaymentStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { sendBookingConfirmation } from '@/lib/email';
import type { BookingTokenPayload } from '@/app/api/bookings/route';
import { calculateBookingPriceBreakdown } from '@/lib/pricing';

// ─── Schema ───────────────────────────────────────────────────────────────────

const verifySchema = z.object({
    orderId: z.string().min(1),
    paymentId: z.string().min(1),
    signature: z.string().min(1),
    bookingToken: z.string().min(1),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function verifyRazorpaySignature(
    orderId: string,
    paymentId: string,
    signature: string,
    secret: string
): boolean {
    const expected = createHmac('sha256', secret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
    // Constant-time compare to prevent timing attacks
    try {
        return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
    } catch {
        return false;
    }
}

function getBookingTokenSecret(): string {
    const secret =
        process.env.BOOKING_TOKEN_SECRET ??
        process.env.MANAGE_BOOKING_TOKEN_SECRET ??
        process.env.NEXTAUTH_SECRET;
    if (!secret) throw new Error('Booking token secret is not configured');
    return secret;
}

/**
 * Verifies and decodes the HMAC-signed booking token issued by /api/bookings.
 * Returns the payload if valid and not expired, or null otherwise.
 */
function verifyBookingToken(token: string): BookingTokenPayload | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3 || parts[0] !== 'bkt1') return null;

        const [, payloadBase64, sig] = parts;
        const secret = getBookingTokenSecret();
        const expectedSig = createHmac('sha256', secret)
            .update(payloadBase64)
            .digest('base64url');

        // Constant-time comparison
        const sigBuf = Buffer.from(sig, 'base64url');
        const expectedBuf = Buffer.from(expectedSig, 'base64url');
        if (sigBuf.length !== expectedBuf.length) return null;
        if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

        const payload = JSON.parse(
            Buffer.from(payloadBase64, 'base64url').toString('utf8')
        ) as BookingTokenPayload;

        // Check version
        if (payload.v !== 1) return null;

        // Check expiry
        if (payload.exp <= Date.now()) {
            return null; // Token expired (payment took too long)
        }

        return payload;
    } catch {
        return null;
    }
}

function buildBookingReference(): string {
    const now = new Date();
    const datePart = now.toISOString().split('T')[0].replace(/-/g, '');
    const { randomBytes } = require('crypto');
    const randomPart = randomBytes(4).toString('hex').toUpperCase();
    return `OMK-${datePart}-${randomPart}`;
}

function toJsonObject(value: unknown): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

function readMetadataObject(value: Prisma.JsonValue | null): Record<string, unknown> {
    if (!value || Array.isArray(value) || typeof value !== 'object') return {};
    return value as Record<string, unknown>;
}

type RazorpayPaymentDetails = {
    amount?: number;
    method?: string;
    status?: string;
};

// ─── POST /api/payments/razorpay/verify ───────────────────────────────────────
/**
 * This is the ONLY place where bookings are written to the database.
 *
 * Flow:
 *   1. Verify Razorpay payment signature (cryptographic proof payment succeeded)
 *   2. Verify & decode the booking token (proves form data wasn't tampered with)
 *   3. Check expiry (token is valid 30 minutes from form submission)
 *   4. Run a DB transaction with advisory lock to prevent race conditions:
 *      a. Re-check room availability (definitive double-booking prevention)
 *      b. Upsert Guest
 *      c. Create Booking (status = CONFIRMED)
 *      d. Create Transaction (status = COMPLETED)
 *   5. Send confirmation email (non-blocking)
 *   6. Return booking reference to redirect to confirmation page
 */
export async function POST(request: NextRequest) {
    try {
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        const keyId = process.env.RAZORPAY_KEY_ID;

        if (!keySecret || !keyId) {
            return NextResponse.json({ error: 'Razorpay keys are not configured' }, { status: 500 });
        }

        const body = await request.json();
        const payload = verifySchema.parse(body);

        // ── Step 1: Verify Razorpay signature ────────────────────────────────
        if (!verifyRazorpaySignature(payload.orderId, payload.paymentId, payload.signature, keySecret)) {
            return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
        }

        // ── Step 2: Verify & decode booking token ─────────────────────────────
        const bookingData = verifyBookingToken(payload.bookingToken);
        if (!bookingData) {
            return NextResponse.json(
                {
                    error: 'Booking session expired or was tampered with. Payment has been received — please contact us at 8928584198 with your payment ID to complete your booking.',
                    paymentId: payload.paymentId,
                },
                { status: 410 }
            );
        }

        // ── Step 3: Fetch payment details from Razorpay ───────────────────────
        const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
        let paymentDetails: RazorpayPaymentDetails | null = null;
        try {
            const fetched = await razorpay.payments.fetch(payload.paymentId);
            paymentDetails = fetched as unknown as RazorpayPaymentDetails;
        } catch (err) {
            console.warn('Unable to fetch Razorpay payment details:', err);
        }

        const paidAmount = paymentDetails?.amount
            ? paymentDetails.amount / 100
            : 0;
        const method = paymentDetails?.method ?? 'ONLINE';
        const normalizedStatus = paymentDetails?.status?.toUpperCase() ?? 'CAPTURED';
        const finalStatus: PaymentStatus =
            normalizedStatus === 'FAILED'
                ? 'FAILED'
                : normalizedStatus === 'REFUNDED'
                    ? 'REFUNDED'
                    : 'COMPLETED';

        // ── Step 4: Re-calculate authoritative total (coupon-aware) ──────────
        // Fetch coupon from DB using the couponId stored in the signed booking token
        let activeCoupon = null;
        if (bookingData.couponId) {
            const cp = await prisma.coupon.findUnique({
                where: { id: bookingData.couponId },
            });
            if (cp) {
                activeCoupon = {
                    id: cp.id,
                    type: cp.discountType,
                    value: cp.discountValue.toNumber(),
                };
            }
        }

        // Single authoritative pricing calculation — includes coupon discount
        const finalPricing = calculateBookingPriceBreakdown({
            rooms: bookingData.rooms,
            checkIn: new Date(bookingData.checkIn),
            checkOut: new Date(bookingData.checkOut),
            numberOfGuests: bookingData.numberOfGuests,
            addons: bookingData.addons,
            coupon: activeCoupon ? { type: activeCoupon.type, value: activeCoupon.value } : null,
        });

        if (finalStatus === 'COMPLETED' && paidAmount > 0 && Math.abs(paidAmount - finalPricing.totalAmount) > 1) {
            console.error(
                `[Payment] Amount mismatch! Expected: ₹${finalPricing.totalAmount}, Paid: ₹${paidAmount}, ` +
                `OrderId: ${payload.orderId}`
            );
            return NextResponse.json(
                { error: 'Payment amount does not match booking amount. Please contact support.' },
                { status: 400 }
            );
        }

        // ── Step 5: DB transaction with advisory lock ─────────────────────────
        // This is the definitive check — prevent any race conditions.
        const checkIn = new Date(bookingData.checkIn);
        const checkOut = new Date(bookingData.checkOut);

        const bookingRef = await prisma.$transaction(async (tx) => {
            // Advisory lock per room — prevents double booking under concurrent requests
            for (const r of bookingData.rooms) {
                await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${r.roomId}))`;
            }

            const roomIds = bookingData.rooms.map(r => r.roomId);

            // Re-check availability under the lock
            const overlapping = await tx.booking.findFirst({
                where: {
                    rooms: { some: { roomId: { in: roomIds } } },
                    status: { in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
                    OR: [
                        { checkIn: { lte: checkIn }, checkOut: { gt: checkIn } },
                        { checkIn: { lt: checkOut }, checkOut: { gte: checkOut } },
                        { checkIn: { gte: checkIn }, checkOut: { lte: checkOut } },
                    ],
                },
            });

            if (overlapping) {
                throw new Error('One or more selected rooms are no longer available for the selected dates');
            }

            // Check if this payment was already processed (idempotency)
            const existingTransaction = await tx.transaction.findFirst({
                where: { paymentGatewayId: payload.paymentId },
                include: { booking: true },
            });

            if (existingTransaction?.booking) {
                // Already processed — return existing reference
                return existingTransaction.booking.bookingReference;
            }

            // ── Upsert guest ─────────────────────────────────────────────────
            const guestData = bookingData.guest;
            const idProofData: Record<string, string> = {
                type: guestData.idProofType,
                number: guestData.idProofNumber,
            };
            if (guestData.idProofImageUrl) {
                idProofData.image_url = guestData.idProofImageUrl;
            }

            const guest = await tx.guest.upsert({
                where: { email: guestData.email },
                update: {
                    fullName: guestData.fullName,
                    phone: guestData.phone,
                    address: {
                        street: guestData.address.street,
                        city: guestData.address.city,
                        state: guestData.address.state,
                        country: guestData.address.country,
                        zip: guestData.address.zipCode,
                    },
                    idProof: idProofData,
                },
                create: {
                    fullName: guestData.fullName,
                    email: guestData.email,
                    phone: guestData.phone,
                    address: {
                        street: guestData.address.street,
                        city: guestData.address.city,
                        state: guestData.address.state,
                        country: guestData.address.country,
                        zip: guestData.address.zipCode,
                    },
                    idProof: idProofData,
                },
            });

            // ── Create booking (CONFIRMED from the start) ─────────────────────
            const bookingReference = buildBookingReference();
            const booking = await tx.booking.create({
                data: {
                    bookingReference,
                    guestId: guest.id,
                    checkIn,
                    checkOut,
                    numberOfGuests: bookingData.numberOfGuests,
                    rooms: {
                        create: bookingData.rooms.map((r) => ({
                            roomId: r.roomId,
                        }))
                    },
                    specialRequests: bookingData.specialRequests,
                    totalAmount: finalPricing.totalAmount,
                    taxAmount: finalPricing.gstAmount,
                    discountAmount: finalPricing.discountAmount,
                    couponId: bookingData.couponId,
                    status: 'CONFIRMED', // ← Confirmed immediately on payment
                    addons: bookingData.addons.length
                        ? {
                            create: bookingData.addons.map((addon) => ({
                                addonType: addon.id,
                                name: addon.name,
                                quantity: addon.quantity ?? 1,
                                price: addon.price,
                            })),
                        }
                        : undefined,
                },
            });

            // ── Update Coupon usage — atomic check+increment under the same txn ─
            if (bookingData.couponId) {
                // Re-read coupon under the transaction to catch concurrent uses
                const couponForUse = await tx.coupon.findUnique({
                    where: { id: bookingData.couponId },
                });
                if (
                    !couponForUse ||
                    !couponForUse.isActive ||
                    new Date() > couponForUse.validUntil ||
                    (couponForUse.maxUses !== null && couponForUse.currentUses >= couponForUse.maxUses)
                ) {
                    throw new Error(
                        'Coupon is no longer valid or has reached its usage limit. Payment has been received — please contact us for assistance.'
                    );
                }
                await tx.coupon.update({
                    where: { id: bookingData.couponId },
                    data: { currentUses: { increment: 1 } },
                });
            }

            // ── Create transaction (COMPLETED) ────────────────────────────────
            await tx.transaction.create({
                data: {
                    bookingId: booking.id,
                    paymentGatewayId: payload.paymentId,
                    amount: paidAmount > 0 ? paidAmount : finalPricing.totalAmount,
                    status: finalStatus,
                    paymentMethod: method,
                    currency: 'INR',
                    metadata: toJsonObject({
                        orderId: payload.orderId,
                        paymentId: payload.paymentId,
                        signature: payload.signature,
                        paymentDetails,
                        pricing: finalPricing,
                        source: 'public-booking',
                    }),
                },
            });

            return bookingReference;
        });

        // ── Step 6: Fetch room details for email ──────────────────────────────
        const firstRoomId = bookingData.rooms[0]?.roomId;
        const room = firstRoomId ? await prisma.room.findUnique({ where: { id: firstRoomId } }) : null;

        // ── Step 7: Send confirmation email (non-blocking) ────────────────────
        if (bookingData.guest.email && room) {
            const nights = Math.ceil(
                (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
            );
            sendBookingConfirmation({
                guestName: bookingData.guest.fullName,
                guestEmail: bookingData.guest.email,
                bookingReference: bookingRef,
                roomType: bookingData.rooms.length > 1 ? 'Multiple Rooms' : room.type,
                roomNumber: bookingData.rooms.map(r => r.roomNumber).join(', '),
                checkIn,
                checkOut,
                numberOfGuests: bookingData.numberOfGuests,
                numberOfNights: nights,
                totalAmount: finalPricing.totalAmount,
                taxAmount: finalPricing.gstAmount,
                paymentMethod: method,
            })
                .then((result) => {
                    if (!result.success) console.error('[Email] Confirmation email failed:', result.error);
                    else console.log('[Email] Confirmation sent, id:', result.id);
                })
                .catch((err) => console.error('[Email] Confirmation error:', err));
        }

        return NextResponse.json({
            bookingReference: bookingRef,
            paymentStatus: finalStatus,
            amountPaid: paidAmount > 0 ? paidAmount : finalPricing.totalAmount,
            rooms: bookingData.rooms.map((r) => ({
                id: r.roomId,
                number: r.roomNumber
            })),
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation failed', details: error.issues },
                { status: 400 }
            );
        }

        const message = error instanceof Error ? error.message : 'Payment verification failed';

        // Room no longer available is a legit 409
        if (/no longer available/i.test(message)) {
            return NextResponse.json({ error: message }, { status: 409 });
        }

        console.error('Error verifying Razorpay payment:', error);
        return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 });
    }
}
