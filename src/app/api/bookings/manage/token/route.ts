import { NextRequest, NextResponse } from 'next/server';
import { CancellationError } from '@/lib/cancellation';
import { getManageBookingContext } from '@/lib/manage-booking';
import { checkManageBookingRateLimit } from '@/lib/manage-booking-rate-limit';

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

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    const rateLimit = await checkManageBookingRateLimit({
      request,
      action: 'token',
      identity: token ?? undefined,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many manage-booking detail requests. Please wait and try again.',
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

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const { token: verified, booking, preview } = await getManageBookingContext(token);

    return NextResponse.json(
      {
        success: true,
        token: {
          bookingReference: verified.bookingReference,
          issuedAt: verified.issuedAt.toISOString(),
          expiresAt: verified.expiresAt.toISOString(),
        },
        booking: {
          id: booking.id,
          bookingReference: booking.bookingReference,
          status: booking.status,
          checkIn: booking.checkIn.toISOString(),
          checkOut: booking.checkOut.toISOString(),
          totalAmount: toNumber(booking.totalAmount),
          room: {
            number: booking.rooms[0]?.room.roomNumber ?? 'N/A',
            type: booking.rooms[0]?.room.type ?? 'N/A',
          },
          guest: {
            name: booking.guest.fullName,
            email: booking.guest.email,
          },
          transaction: booking.transaction
            ? {
                status: booking.transaction.status,
                amount: toNumber(booking.transaction.amount),
                paymentMethod: booking.transaction.paymentMethod,
                refundedAmount: toNumber(booking.transaction.refundAmount),
              }
            : null,
        },
        cancellation: preview,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    if (error instanceof CancellationError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.httpStatus, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    console.error('Manage booking token error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load manage booking details' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
