import { z } from 'zod';
import { prisma } from '@/lib/db';
import {
  createManageBookingToken,
  verifyManageBookingToken,
  type VerifiedManageBookingToken,
} from '@/lib/auth-token';
import { sendManageBookingLink } from '@/lib/email';
import {
  CancellationError,
  getCancellationPreview,
  getCancellationPreviewByReference,
  type CancellationPreview,
} from '@/lib/cancellation';

export const bookingReferenceSchema = z
  .string()
  .regex(/^OMK-\d{8}-[A-Z0-9]{4,8}$/i, 'Booking reference must match OMK-YYYYMMDD-XXXX format');

const emailSchema = z.string().email();

type ManageLinkRequestResult = {
  accepted: true;
  sent: boolean;
  expiresInMinutes: number;
  reason?: 'booking_mismatch' | 'email_delivery_failed';
};

function getManageLinkExpiryMinutes() {
  const parsed = Number.parseInt(process.env.MANAGE_BOOKING_LINK_EXPIRY_MINUTES ?? '15', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
}

function normalizeBookingReference(reference: string) {
  return reference.trim().toUpperCase();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function buildManageBookingUrl(token: string) {
  const baseUrl =
    process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `${baseUrl.replace(/\/$/, '')}/manage/${token}`;
}

export async function requestManageBookingLink(referenceRaw: string, emailRaw: string): Promise<ManageLinkRequestResult> {
  const bookingReference = normalizeBookingReference(bookingReferenceSchema.parse(referenceRaw));
  const email = normalizeEmail(emailSchema.parse(emailRaw));

  const booking = await prisma.booking.findUnique({
    where: { bookingReference },
    include: {
      guest: {
        select: {
          email: true,
        },
      },
    },
  });

  if (!booking || booking.guest.email.toLowerCase() !== email) {
    return {
      accepted: true,
      sent: false,
      expiresInMinutes: getManageLinkExpiryMinutes(),
      reason: 'booking_mismatch',
    };
  }

  const token = createManageBookingToken(bookingReference, getManageLinkExpiryMinutes());
  const emailResult = await sendManageBookingLink(email, bookingReference, token);

  if (!emailResult.success) {
    console.error('[ManageBooking] Email send failed:', emailResult.error);
    return {
      accepted: true,
      sent: false,
      expiresInMinutes: getManageLinkExpiryMinutes(),
      reason: 'email_delivery_failed',
    };
  }

  return {
    accepted: true,
    sent: true,
    expiresInMinutes: getManageLinkExpiryMinutes(),
  };
}

export async function getManageBookingContext(token: string) {
  const verified = verifyManageBookingToken(token);

  if (!verified.ok) {
    throw new CancellationError(
      verified.reason === 'expired' ? 'token_expired' : 'token_invalid',
      verified.reason === 'expired' ? 'Manage booking link has expired.' : 'Invalid manage booking link.',
      verified.reason === 'expired' ? 410 : 400
    );
  }

  const data = await getCancellationPreviewByReference(verified.value.bookingReference);

  return {
    token: verified.value,
    booking: data.booking,
    preview: data.preview,
  };
}

export async function getCancellationPreviewFromReference(referenceRaw: string): Promise<CancellationPreview> {
  const bookingReference = normalizeBookingReference(bookingReferenceSchema.parse(referenceRaw));
  const booking = await prisma.booking.findUnique({
    where: { bookingReference },
    include: {
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
    },
  });

  if (!booking) {
    throw new CancellationError('booking_not_found', 'Booking not found', 404);
  }

  return getCancellationPreview(booking);
}

export function ensureTokenBookingMatch(tokenData: VerifiedManageBookingToken, bookingReference: string) {
  const normalizedBookingReference = normalizeBookingReference(bookingReference);
  if (tokenData.bookingReference !== normalizedBookingReference) {
    throw new CancellationError('token_mismatch', 'Token does not match booking reference', 403);
  }
}
