import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { chatConfig } from '@/lib/chat/config';
import { prisma } from '@/lib/db';
import { getActiveChatSession } from '@/lib/chat/session';
import { findBookingForContact, maskContact, normalizeBookingReference } from '@/lib/chat/verification';

const bookingReferenceSchema = z
  .string()
  .regex(/^OMK-\d{8}-[A-Z0-9]{4,8}$/i, 'Booking reference must match OMK-YYYYMMDD-XXXX format');

const bookingInfoSchema = z.object({
  sessionToken: z.string().min(1).optional(),
  bookingReference: bookingReferenceSchema.optional(),
  email: z.string().email().max(120),
});

function getSessionToken(request: NextRequest, body: { sessionToken?: string }) {
  return body.sessionToken ?? request.cookies.get('chat_session_token')?.value ?? null;
}

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

export async function POST(request: NextRequest) {
  try {
    if (!chatConfig.enabled) {
      return NextResponse.json({ success: false, error: 'Chatbot is disabled' }, { status: 503 });
    }

    const body = bookingInfoSchema.parse(await request.json());
    const sessionToken = getSessionToken(request, body);

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Chat session is required' }, { status: 400 });
    }

    const session = await getActiveChatSession(sessionToken);

    if (!session) {
      return NextResponse.json({ success: false, error: 'Chat session expired or not found' }, { status: 410 });
    }

    const requestedReference = body.bookingReference
      ? normalizeBookingReference(body.bookingReference)
      : session.referenceNumber;

    if (!requestedReference) {
      return NextResponse.json(
        { success: false, error: 'Booking reference is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = body.email.trim().toLowerCase();
    const matchedBooking = await findBookingForContact(requestedReference, normalizedEmail);

    if (!matchedBooking) {
      return NextResponse.json(
        { success: false, error: 'Booking reference and email did not match our records' },
        { status: 403 }
      );
    }

    const shouldUpdateSession =
      !session.isVerified ||
      session.referenceNumber !== requestedReference ||
      session.emailOrPhone?.toLowerCase() !== normalizedEmail;

    if (shouldUpdateSession) {
      await prisma.chatSession.update({
        where: { id: session.id },
        data: {
          isVerified: true,
          verifiedAt: new Date(),
          referenceNumber: requestedReference,
          emailOrPhone: normalizedEmail,
        },
      });
    }

    const booking = await prisma.booking.findUnique({
      where: { bookingReference: requestedReference },
      include: {
        guest: true,
        rooms: { include: { room: true } },
        transaction: true,
        addons: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    await prisma.toolAuditLog.create({
      data: {
        sessionId: session.id,
        toolName: 'get_booking_status',
        input: {
          bookingReference: requestedReference,
          email: maskContact(normalizedEmail),
        },
        outputStatus: 'success',
        outputSummary: 'Booking details fetched using booking reference and email',
      },
    });

    return NextResponse.json(
      {
        success: true,
        booking: {
          bookingReference: booking.bookingReference,
          status: booking.status,
          checkIn: booking.checkIn.toISOString(),
          checkOut: booking.checkOut.toISOString(),
          numberOfGuests: booking.numberOfGuests,
          specialRequests: booking.specialRequests,
          totalAmount: toNumber(booking.totalAmount),
          taxAmount: toNumber(booking.taxAmount),
          room: {
            number: booking.rooms[0]?.room.roomNumber ?? 'N/A',
            type: booking.rooms[0]?.room.type ?? 'N/A',
            view: booking.rooms[0]?.room.view ?? null,
          },
          guest: {
            name: booking.guest.fullName,
            email: maskContact(booking.guest.email),
            phone: maskContact(booking.guest.phone),
          },
          addons: booking.addons.map((addon) => ({
            name: addon.name,
            quantity: addon.quantity,
            price: toNumber(addon.price),
          })),
          transaction: booking.transaction
            ? {
                status: booking.transaction.status,
                amount: toNumber(booking.transaction.amount),
                paymentMethod: booking.transaction.paymentMethod,
                updatedAt: booking.transaction.updatedAt.toISOString(),
              }
            : null,
        },
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid payload', details: error.flatten() },
        { status: 400 }
      );
    }

    console.error('Booking info error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch booking info' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
