import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CancellationError, processBookingCancellation } from '@/lib/cancellation';
import { getManageBookingContext } from '@/lib/manage-booking';
import { checkManageBookingRateLimit } from '@/lib/manage-booking-rate-limit';

const manageCancelSchema = z.object({
  token: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = manageCancelSchema.parse(await request.json());
    const rateLimit = await checkManageBookingRateLimit({
      request,
      action: 'cancel',
      identity: body.token,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many cancellation attempts. Please wait and try again.',
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

    const context = await getManageBookingContext(body.token);

    const result = await processBookingCancellation({
      bookingId: context.booking.id,
      cancellationReason: body.reason,
      actor: 'GUEST',
    });

    return NextResponse.json(
      {
        success: true,
        booking: {
          id: result.booking.id,
          bookingReference: result.booking.bookingReference,
          status: result.booking.status,
        },
        cancellation: result.summary,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request payload', details: error.flatten() },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (error instanceof CancellationError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.httpStatus, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    console.error('Manage booking cancellation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel booking' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
