import Razorpay from 'razorpay';
import { BookingStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { checkinReadyUTC } from '@/lib/hotelPolicy';
import { sendBookingCancellation } from '@/lib/email';
import { cancelBookingInPMS } from '@/lib/pms/sync';

const FULL_REFUND_HOURS = 48;
const PARTIAL_REFUND_HOURS = 24;
const PLATFORM_FEE_PERCENTAGE = 5; // 5% covers Razorpay gateway charges (2% + GST) + processing costs

export type CancellationActor = 'ADMIN' | 'GUEST';

export type CancellationPreview = {
  canCancel: boolean;
  blockReason: string | null;
  policyWindow: 'full' | 'partial' | 'none';
  refundPercentage: number;
  platformFeePercentage: number;
  platformFeeAmount: number;
  paidAmount: number;
  refundAmount: number;
  cancellationCharge: number;
  hoursUntilCheckIn: number;
};

export type CancellationResult = {
  booking: BookingWithCancellationRelations;
  summary: {
    policyWindow: CancellationPreview['policyWindow'];
    refundPercentage: number;
    platformFeePercentage: number;
    platformFeeAmount: number;
    paidAmount: number;
    refundAmount: number;
    cancellationCharge: number;
    refundGatewayId: string | null;
  };
};

export class CancellationError extends Error {
  code: string;
  httpStatus: number;

  constructor(code: string, message: string, httpStatus = 400) {
    super(message);
    this.name = 'CancellationError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

const cancellationInclude = {
  guest: {
    select: {
      fullName: true,
      email: true,
    },
  },
  rooms: {
    include: {
      room: {
        select: {
          id: true,
          roomNumber: true,
          type: true,
          status: true,
        },
      },
    },
  },
  transaction: true,
} satisfies Prisma.BookingInclude;

type BookingWithCancellationRelations = Prisma.BookingGetPayload<{
  include: typeof cancellationInclude;
}>;

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

function roundToCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function getCheckInCutoffUtc(checkInDate: Date) {
  const dateKey = checkInDate.toISOString().split('T')[0];
  return checkinReadyUTC(dateKey);
}

function computeRefundPercentage(hoursUntilCheckIn: number) {
  if (hoursUntilCheckIn > FULL_REFUND_HOURS) {
    return 100 - PLATFORM_FEE_PERCENTAGE; // 95% — 5% platform fee retained
  }

  if (hoursUntilCheckIn > PARTIAL_REFUND_HOURS) {
    return 50;
  }

  return 0;
}

function readMetadataObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {};
  }

  return value as Record<string, unknown>;
}

function toJsonObject(value: unknown): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

function buildCancellationReason(existing: string | null, reason?: string) {
  if (!reason || !reason.trim()) {
    return existing;
  }

  const note = `Cancellation Reason: ${reason.trim()}`;

  if (!existing || !existing.trim()) {
    return note;
  }

  return `${existing.trim()}\n\n${note}`;
}

function isPaymentCaptured(status: string | null | undefined) {
  return status === 'COMPLETED' || status === 'REFUNDED';
}

function isLikelyRazorpayId(value: string | null | undefined) {
  return Boolean(value && (/^order_/i.test(value) || /^pay_/i.test(value)));
}

function extractPaymentId(metadata: Record<string, unknown>) {
  const direct = metadata.paymentId;
  if (typeof direct === 'string' && direct.trim()) {
    return direct;
  }

  const paymentDetails = metadata.paymentDetails;
  if (paymentDetails && typeof paymentDetails === 'object' && !Array.isArray(paymentDetails)) {
    const nestedId = (paymentDetails as Record<string, unknown>).id;
    if (typeof nestedId === 'string' && nestedId.trim()) {
      return nestedId;
    }
  }

  return null;
}

function createRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return null;
  }

  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

type RazorpayOrderPaymentsResponse = {
  items?: Array<{
    id?: string;
    status?: string;
    captured?: boolean;
  }>;
};

async function resolvePaymentIdFromOrder(razorpay: Razorpay, orderId: string) {
  try {
    const payments = (await razorpay.orders.fetchPayments(orderId)) as unknown as RazorpayOrderPaymentsResponse;
    const candidate =
      payments.items?.find((payment) => payment.status === 'captured') ??
      payments.items?.find((payment) => payment.captured) ??
      payments.items?.[0];

    return candidate?.id ?? null;
  } catch (error) {
    console.warn('[Cancellation] Unable to resolve payment id from order:', error);
    return null;
  }
}

export function getCancellationPreview(booking: BookingWithCancellationRelations): CancellationPreview {
  const now = new Date();
  const checkInCutoffUtc = getCheckInCutoffUtc(booking.checkIn);
  const hoursUntilCheckIn = (checkInCutoffUtc.getTime() - now.getTime()) / (1000 * 60 * 60);
  const refundPercentage = computeRefundPercentage(hoursUntilCheckIn);

  // Determine if this falls into the "full refund" window (> 48h)
  const isFull = hoursUntilCheckIn > FULL_REFUND_HOURS;
  const platformFeePercentage = isFull ? PLATFORM_FEE_PERCENTAGE : 0;

  const transaction = booking.transaction;
  const paidAmount =
    transaction && isPaymentCaptured(transaction.status)
      ? toNumber(transaction.amount)
      : 0;

  const computedRefundAmount = roundToCurrency((paidAmount * refundPercentage) / 100);
  const platformFeeAmount = isFull ? roundToCurrency((paidAmount * platformFeePercentage) / 100) : 0;
  const alreadyRefundedAmount = transaction ? toNumber(transaction.refundAmount) : 0;
  const refundAmount = Math.max(computedRefundAmount, alreadyRefundedAmount);
  const cancellationCharge = roundToCurrency(Math.max(0, paidAmount - refundAmount));

  if (booking.status === BookingStatus.CANCELLED) {
    return {
      canCancel: false,
      blockReason: 'Booking is already cancelled.',
      policyWindow: isFull ? 'full' : refundPercentage === 50 ? 'partial' : 'none',
      refundPercentage,
      platformFeePercentage,
      platformFeeAmount,
      paidAmount,
      refundAmount,
      cancellationCharge,
      hoursUntilCheckIn,
    };
  }

  if (booking.status === BookingStatus.CHECKED_IN) {
    return {
      canCancel: false,
      blockReason: 'Checked-in bookings cannot be cancelled online.',
      policyWindow: 'none',
      refundPercentage,
      platformFeePercentage: 0,
      platformFeeAmount: 0,
      paidAmount,
      refundAmount,
      cancellationCharge,
      hoursUntilCheckIn,
    };
  }

  if (booking.status === BookingStatus.CHECKED_OUT || booking.status === BookingStatus.NO_SHOW) {
    return {
      canCancel: false,
      blockReason: 'This booking is in a terminal state and cannot be cancelled.',
      policyWindow: 'none',
      refundPercentage,
      platformFeePercentage: 0,
      platformFeeAmount: 0,
      paidAmount,
      refundAmount,
      cancellationCharge,
      hoursUntilCheckIn,
    };
  }

  return {
    canCancel: true,
    blockReason: null,
    policyWindow: isFull ? 'full' : refundPercentage === 50 ? 'partial' : 'none',
    refundPercentage,
    platformFeePercentage,
    platformFeeAmount,
    paidAmount,
    refundAmount,
    cancellationCharge,
    hoursUntilCheckIn,
  };
}

async function findBookingByReference(bookingReference: string) {
  return prisma.booking.findUnique({
    where: { bookingReference },
    include: cancellationInclude,
  });
}

async function findBookingById(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: cancellationInclude,
  });
}

export async function getCancellationPreviewByReference(bookingReference: string) {
  const booking = await findBookingByReference(bookingReference.trim().toUpperCase());

  if (!booking) {
    throw new CancellationError('booking_not_found', 'Booking not found', 404);
  }

  return {
    booking,
    preview: getCancellationPreview(booking),
  };
}

export async function processBookingCancellation(input: {
  bookingId?: string;
  bookingReference?: string;
  cancellationReason?: string;
  actor: CancellationActor;
}): Promise<CancellationResult> {
  const booking = input.bookingId
    ? await findBookingById(input.bookingId)
    : input.bookingReference
      ? await findBookingByReference(input.bookingReference.trim().toUpperCase())
      : null;

  if (!booking) {
    throw new CancellationError('booking_not_found', 'Booking not found', 404);
  }

  const preview = getCancellationPreview(booking);

  if (!preview.canCancel) {
    throw new CancellationError('cancellation_not_allowed', preview.blockReason ?? 'Cancellation not allowed', 400);
  }

  const transaction = booking.transaction;
  const now = new Date();

  let refundAmount = preview.refundAmount;
  let refundGatewayId: string | null = null;

  if (transaction && preview.paidAmount > 0 && refundAmount > 0) {
    const alreadyRefundedAmount = toNumber(transaction.refundAmount);
    if (transaction.status === 'REFUNDED' || alreadyRefundedAmount > 0) {
      refundAmount = Math.max(refundAmount, alreadyRefundedAmount);
    } else if (isLikelyRazorpayId(transaction.paymentGatewayId) || transaction.paymentMethod?.toUpperCase() === 'ONLINE') {
      const razorpay = createRazorpayClient();
      if (!razorpay) {
        throw new CancellationError(
          'refund_gateway_unavailable',
          'Unable to process online refund right now. Please contact support.',
          503
        );
      }

      const metadata = readMetadataObject(transaction.metadata as Prisma.JsonValue | null);
      let paymentId = extractPaymentId(metadata);

      if (!paymentId && transaction.paymentGatewayId && isLikelyRazorpayId(transaction.paymentGatewayId)) {
        if (/^order_/i.test(transaction.paymentGatewayId)) {
          paymentId = await resolvePaymentIdFromOrder(razorpay, transaction.paymentGatewayId);
        } else {
          paymentId = transaction.paymentGatewayId;
        }
      }

      if (!paymentId) {
        throw new CancellationError(
          'payment_id_missing',
          'Unable to locate the payment record for refund. Please contact support.',
          502
        );
      }

      try {
        const refundResponse = await razorpay.payments.refund(paymentId, {
          amount: Math.max(1, Math.round(refundAmount * 100)),
          speed: 'optimum', // 'optimum' attempts instant refund, fallback to normal
          notes: {
            bookingReference: booking.bookingReference,
            cancellationActor: input.actor,
          },
        });

        refundGatewayId = typeof (refundResponse as { id?: unknown }).id === 'string'
          ? ((refundResponse as { id: string }).id)
          : null;
      } catch (error) {
        // Extract the actual Razorpay error so we can handle it intelligently.
        const rzpError = error as {
          error?: { code?: string; description?: string; reason?: string };
          statusCode?: number;
          message?: string;
        };
        const errCode = rzpError?.error?.code ?? '';
        const errDesc = rzpError?.error?.description ?? rzpError?.message ?? String(error);
        const errReason = rzpError?.error?.reason ?? '';

        console.error('[Cancellation] Razorpay refund failed:', {
          paymentId,
          code: errCode,
          description: errDesc,
          reason: errReason,
          raw: error,
        });

        // If the payment simply doesn't exist in this Razorpay mode (e.g., a test-mode
        // payment being cancelled after switching to live keys), we should NOT block the
        // cancellation. Mark the refund as manual and let the booking cancel cleanly.
        const isNotFound =
          errCode === 'BAD_REQUEST_ERROR' &&
          (errDesc.toLowerCase().includes('does not exist') ||
           errDesc.toLowerCase().includes('invalid') ||
           errReason === 'input_validation_failed');

        if (isNotFound) {
          console.warn(
            `[Cancellation] Payment ${paymentId} not found in current Razorpay mode. ` +
            `This usually means a test-mode payment is being cancelled after switching to live mode. ` +
            `Proceeding with cancellation; refund of ₹${refundAmount} must be issued manually.`
          );
          // Set refundAmount to 0 so the booking cancels without recording a phantom refund.
          // The original refundAmount is logged above for manual processing.
          refundAmount = 0;
          refundGatewayId = null;
        } else {
          // Real failure (network error, amount too high, payment already refunded, etc.)
          throw new CancellationError(
            'refund_failed',
            `Refund could not be processed: ${errDesc || 'Unknown error from payment gateway'}. Please contact support.`,
            502
          );
        }
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: 'CANCELLED',
        specialRequests: buildCancellationReason(booking.specialRequests, input.cancellationReason),
        totalAmount: preview.cancellationCharge,
        taxAmount: 0,
        discountAmount: 0,
      },
      include: cancellationInclude,
    });

    if (transaction) {
      const existingMetadata = readMetadataObject(transaction.metadata as Prisma.JsonValue | null);
      const paidAmount = toNumber(transaction.amount);
      const nextStatus =
        refundAmount > 0
          ? 'REFUNDED'
          : transaction.status;

      await tx.transaction.update({
        where: { bookingId: booking.id },
        data: {
          refundAmount,
          refundedAt: refundAmount > 0 ? now : transaction.refundedAt,
          status: nextStatus,
          metadata: toJsonObject({
            ...existingMetadata,
            cancellation: {
              actor: input.actor,
              cancelledAt: now.toISOString(),
              refundAmount,
              refundPercentage: preview.refundPercentage,
              cancellationCharge: preview.cancellationCharge,
              refundGatewayId,
              policyWindow: preview.policyWindow,
              cancellationReason: input.cancellationReason?.trim() || null,
              originalTotalAmount: booking.totalAmount.toNumber(),
              originalTaxAmount: booking.taxAmount.toNumber(),
              originalDiscountAmount: booking.discountAmount.toNumber(),
            },
          }),
        },
      });
    }

    // Free up all rooms in the booking if they were OCCUPIED / CLEANING
    if (booking.status !== 'CHECKED_IN') {
      for (const br of updated.rooms) {
        if (br.room.status === 'OCCUPIED' || br.room.status === 'CLEANING') {
          await tx.room.update({
            where: { id: br.room.id },
            data: { status: 'AVAILABLE' },
          });
        }
      }
    }
  });

  const updatedBooking = await findBookingById(booking.id);

  if (!updatedBooking) {
    throw new CancellationError('booking_not_found', 'Booking not found after cancellation update', 500);
  }

  if (updatedBooking.guest.email) {
    sendBookingCancellation({
      guestName: updatedBooking.guest.fullName,
      guestEmail: updatedBooking.guest.email,
      bookingReference: updatedBooking.bookingReference,
      roomType: updatedBooking.rooms[0]?.room.type ?? 'Room',
      checkIn: updatedBooking.checkIn,
      checkOut: updatedBooking.checkOut,
      totalAmount: toNumber(updatedBooking.totalAmount),
      refundAmount,
      platformFeeAmount: preview.platformFeeAmount,
      cancellationReason: input.cancellationReason,
    }).catch((error) => {
      console.error('[Cancellation] Failed to send cancellation email:', error);
    });
  }

  cancelBookingInPMS(updatedBooking.id).catch((error) => {
    console.error('[Cancellation] PMS cancellation sync failed:', error);
  });

  return {
    booking: updatedBooking,
    summary: {
      policyWindow: preview.policyWindow,
      refundPercentage: preview.refundPercentage,
      platformFeePercentage: preview.platformFeePercentage,
      platformFeeAmount: preview.platformFeeAmount,
      paidAmount: preview.paidAmount,
      refundAmount,
      cancellationCharge: roundToCurrency(Math.max(0, preview.paidAmount - refundAmount)),
      refundGatewayId,
    },
  };
}
