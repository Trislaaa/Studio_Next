import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { sendBookingConfirmation } from '@/lib/email';

// ─── Razorpay Webhook Handler ─────────────────────────────────────────────────
//
// Razorpay sends POST requests to this endpoint for key payment lifecycle events.
// This acts as a SAFETY NET for cases where the frontend verify call fails
// (e.g., browser crash, network drop after payment).
//
// Events handled:
//   • payment.captured  — Payment successful. Create booking if not already created.
//   • payment.failed    — Payment failed. Log for monitoring.
//   • refund.processed  — Refund completed by Razorpay. Update our DB.
//   • refund.failed     — Refund failed. Alert for manual intervention.
//
// Setup in Razorpay Dashboard:
//   1. Go to Settings → Webhooks → Add New Webhook
//   2. URL: https://your-domain.com/api/webhooks/razorpay
//   3. Secret: Generate a strong secret, add to env as RAZORPAY_WEBHOOK_SECRET
//   4. Events: payment.captured, payment.failed, refund.processed, refund.failed
// ──────────────────────────────────────────────────────────────────────────────

// ─── Signature Verification ──────────────────────────────────────────────────

function verifyWebhookSignature(
    body: string,
    signature: string,
    secret: string
): boolean {
    try {
        const expected = createHmac('sha256', secret).update(body).digest('hex');
        return timingSafeEqual(
            Buffer.from(expected, 'hex'),
            Buffer.from(signature, 'hex')
        );
    } catch {
        return false;
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildBookingReference(): string {
    const now = new Date();
    const datePart = now.toISOString().split('T')[0].replace(/-/g, '');
    const randomPart = randomBytes(4).toString('hex').toUpperCase();
    return `OMK-${datePart}-${randomPart}`;
}

function toJsonObject(value: unknown): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

// ─── Event Handlers ──────────────────────────────────────────────────────────

/**
 * payment.captured — The payment was successfully captured by Razorpay.
 *
 * In normal flow, /api/payments/razorpay/verify already created the booking.
 * This handler only acts if the verify call was missed (browser crash, etc.).
 *
 * We check: does a transaction with this paymentId already exist?
 *   YES → Do nothing (booking already created by verify endpoint)
 *   NO  → Log a warning. We can't create the booking without the signed
 *          booking token (guest details, room selection, etc.), but we CAN
 *          record the orphan payment so admin can reconcile it.
 */
async function handlePaymentCaptured(payment: Record<string, unknown>) {
    const paymentId = payment.id as string;
    const orderId = payment.order_id as string;
    const amount = (payment.amount as number) / 100; // paise → rupees
    const method = (payment.method as string) || 'ONLINE';

    console.log(`[Webhook] payment.captured: ${paymentId}, order: ${orderId}, ₹${amount}`);

    // Check if this payment was already processed by the verify endpoint
    const existingTxn = await prisma.transaction.findFirst({
        where: { paymentGatewayId: paymentId },
        include: { booking: { select: { id: true, bookingReference: true, status: true } } },
    });

    if (existingTxn) {
        console.log(`[Webhook] Payment ${paymentId} already processed → Booking ${existingTxn.booking.bookingReference}`);
        return { action: 'already_processed', bookingReference: existingTxn.booking.bookingReference };
    }

    // Payment exists in Razorpay but NOT in our DB → the verify call was missed.
    // We can't auto-create a booking (we don't have guest details or room selection
    // from the signed token), but we MUST record the orphan payment for reconciliation.
    //
    // The admin dashboard should show these orphan payments so staff can manually
    // create the booking or issue a refund.

    const notes = (payment.notes as Record<string, string>) || {};
    const receipt = orderId; // The order receipt contains the booking reference

    console.warn(
        `[Webhook] ⚠️ ORPHAN PAYMENT DETECTED!\n` +
        `  Payment ID: ${paymentId}\n` +
        `  Order ID:   ${orderId}\n` +
        `  Amount:     ₹${amount}\n` +
        `  Method:     ${method}\n` +
        `  Notes:      ${JSON.stringify(notes)}\n` +
        `  Action:     Admin must manually reconcile this payment.`
    );

    // Store the orphan payment in the hotel config as a JSON log for admin visibility
    try {
        const orphanKey = 'orphan_payments';
        const existing = await prisma.hotelConfig.findUnique({ where: { key: orphanKey } });
        const orphans: unknown[] = existing ? JSON.parse(existing.value as string) : [];
        orphans.push({
            paymentId,
            orderId,
            amount,
            method,
            notes,
            capturedAt: new Date().toISOString(),
            status: 'NEEDS_RECONCILIATION',
        });

        await prisma.hotelConfig.upsert({
            where: { key: orphanKey },
            update: { value: JSON.stringify(orphans) },
            create: { key: orphanKey, value: JSON.stringify(orphans) },
        });
    } catch (err) {
        console.error('[Webhook] Failed to record orphan payment:', err);
    }

    return { action: 'orphan_recorded', paymentId };
}

/**
 * payment.failed — Razorpay reports a failed payment attempt.
 * Log it for monitoring. No DB action needed (no booking was created).
 */
async function handlePaymentFailed(payment: Record<string, unknown>) {
    const paymentId = payment.id as string;
    const orderId = payment.order_id as string;
    const errorCode = (payment.error_code as string) || 'unknown';
    const errorDescription = (payment.error_description as string) || '';

    console.warn(
        `[Webhook] payment.failed: ${paymentId}, order: ${orderId}\n` +
        `  Error: ${errorCode} — ${errorDescription}`
    );

    return { action: 'logged', paymentId };
}

/**
 * refund.processed — Razorpay confirms a refund was successfully processed.
 * Update our transaction record to reflect the confirmed refund.
 */
async function handleRefundProcessed(refund: Record<string, unknown>) {
    const refundId = refund.id as string;
    const paymentId = refund.payment_id as string;
    const refundAmount = (refund.amount as number) / 100; // paise → rupees

    console.log(`[Webhook] refund.processed: ${refundId}, payment: ${paymentId}, ₹${refundAmount}`);

    // Find the transaction by the original payment ID
    const transaction = await prisma.transaction.findFirst({
        where: { paymentGatewayId: paymentId },
        include: { booking: { select: { id: true, bookingReference: true } } },
    });

    if (!transaction) {
        console.warn(`[Webhook] Refund ${refundId} for unknown payment ${paymentId} — skipping`);
        return { action: 'skipped', reason: 'transaction_not_found' };
    }

    // Update the transaction with confirmed refund details
    const existingMetadata = transaction.metadata
        ? (typeof transaction.metadata === 'object' && !Array.isArray(transaction.metadata)
            ? transaction.metadata as Record<string, unknown>
            : {})
        : {};

    await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
            status: 'REFUNDED',
            refundAmount,
            refundedAt: new Date(),
            metadata: toJsonObject({
                ...existingMetadata,
                refundWebhook: {
                    refundId,
                    amount: refundAmount,
                    processedAt: new Date().toISOString(),
                    confirmedByWebhook: true,
                },
            }),
        },
    });

    console.log(`[Webhook] Refund confirmed for booking ${transaction.booking.bookingReference}`);
    return { action: 'refund_confirmed', bookingReference: transaction.booking.bookingReference };
}

/**
 * refund.failed — Razorpay reports a refund that could not be processed.
 * This needs admin attention — the guest is owed money but Razorpay couldn't process it.
 */
async function handleRefundFailed(refund: Record<string, unknown>) {
    const refundId = refund.id as string;
    const paymentId = refund.payment_id as string;
    const refundAmount = (refund.amount as number) / 100;

    console.error(
        `[Webhook] ⚠️ REFUND FAILED!\n` +
        `  Refund ID:  ${refundId}\n` +
        `  Payment ID: ${paymentId}\n` +
        `  Amount:     ₹${refundAmount}\n` +
        `  Action:     Admin must manually process this refund.`
    );

    // Find and update the transaction
    const transaction = await prisma.transaction.findFirst({
        where: { paymentGatewayId: paymentId },
    });

    if (transaction) {
        const existingMetadata = transaction.metadata
            ? (typeof transaction.metadata === 'object' && !Array.isArray(transaction.metadata)
                ? transaction.metadata as Record<string, unknown>
                : {})
            : {};

        await prisma.transaction.update({
            where: { id: transaction.id },
            data: {
                metadata: toJsonObject({
                    ...existingMetadata,
                    refundFailure: {
                        refundId,
                        amount: refundAmount,
                        failedAt: new Date().toISOString(),
                        needsManualIntervention: true,
                    },
                }),
            },
        });
    }

    return { action: 'refund_failure_logged', refundId };
}

// ─── Main Webhook Endpoint ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

        if (!webhookSecret) {
            console.error('[Webhook] RAZORPAY_WEBHOOK_SECRET is not configured');
            // Return 200 anyway — Razorpay will keep retrying on non-2xx
            return NextResponse.json({ status: 'webhook_secret_not_configured' }, { status: 200 });
        }

        // Read raw body for signature verification
        const rawBody = await request.text();
        const signature = request.headers.get('x-razorpay-signature') || '';

        if (!signature) {
            console.warn('[Webhook] Missing x-razorpay-signature header');
            return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
        }

        // Verify the webhook signature
        if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
            console.warn('[Webhook] Invalid signature — possible tampering attempt');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
        }

        // Parse the event
        const event = JSON.parse(rawBody) as {
            event: string;
            payload: {
                payment?: { entity: Record<string, unknown> };
                refund?: { entity: Record<string, unknown> };
            };
        };

        console.log(`[Webhook] Received event: ${event.event}`);

        let result: Record<string, unknown> = {};

        switch (event.event) {
            case 'payment.captured':
                if (event.payload.payment?.entity) {
                    result = await handlePaymentCaptured(event.payload.payment.entity);
                }
                break;

            case 'payment.failed':
                if (event.payload.payment?.entity) {
                    result = await handlePaymentFailed(event.payload.payment.entity);
                }
                break;

            case 'refund.processed':
                if (event.payload.refund?.entity) {
                    result = await handleRefundProcessed(event.payload.refund.entity);
                }
                break;

            case 'refund.failed':
                if (event.payload.refund?.entity) {
                    result = await handleRefundFailed(event.payload.refund.entity);
                }
                break;

            default:
                console.log(`[Webhook] Unhandled event type: ${event.event}`);
                result = { action: 'ignored', event: event.event };
        }

        // Always return 200 to acknowledge receipt.
        // If we return non-2xx, Razorpay will retry the webhook up to 24 hours.
        return NextResponse.json({ status: 'ok', ...result });
    } catch (error) {
        console.error('[Webhook] Unexpected error:', error);
        // Return 200 even on error to prevent Razorpay from flooding us with retries
        return NextResponse.json({ status: 'error', message: 'Internal error' }, { status: 200 });
    }
}
