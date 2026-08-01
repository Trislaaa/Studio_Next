import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { bookingReferenceSchema, requestManageBookingLink } from '@/lib/manage-booking';
import { checkManageBookingRateLimit } from '@/lib/manage-booking-rate-limit';

const manageAuthSchema = z.object({
  reference: bookingReferenceSchema,
  email: z.string().email(),
});

const GENERIC_SUCCESS_MESSAGE =
  'If the booking details match our records, a secure manage-booking link has been sent to your email.';

export async function POST(request: NextRequest) {
  try {
    const body = manageAuthSchema.parse(await request.json());
    const identityKey = `${body.reference.trim().toUpperCase()}|${body.email.trim().toLowerCase()}`;
    const rateLimit = await checkManageBookingRateLimit({
      request,
      action: 'auth',
      identity: identityKey,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many manage-booking attempts. Please wait and try again.',
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    await requestManageBookingLink(body.reference, body.email);

    return NextResponse.json(
      {
        success: true,
        message: GENERIC_SUCCESS_MESSAGE,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request payload', details: error.flatten() },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    console.error('Manage booking auth error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to start secure manage-booking flow right now. Please try again shortly.',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
