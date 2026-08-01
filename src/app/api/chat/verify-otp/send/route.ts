import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { chatConfig } from '@/lib/chat/config';
import { prisma } from '@/lib/db';
import { getActiveChatSession } from '@/lib/chat/session';
import {
  createVerificationAttempt,
  deliverOtp,
  findBookingForContact,
  normalizeBookingReference,
} from '@/lib/chat/verification';

const bookingReferenceSchema = z
  .string()
  .regex(/^OMK-\d{8}-[A-Z0-9]{4,8}$/i, 'Booking reference must match OMK-YYYYMMDD-XXXX format');

const sendOtpSchema = z.object({
  sessionToken: z.string().min(1).optional(),
  bookingReference: bookingReferenceSchema,
  contact: z.string().min(4).max(120),
});

function getSessionToken(request: NextRequest, body: { sessionToken?: string }) {
  return body.sessionToken ?? request.cookies.get('chat_session_token')?.value ?? null;
}

export async function POST(request: NextRequest) {
  try {
    if (!chatConfig.enabled) {
      return NextResponse.json({ success: false, error: 'Chatbot is disabled' }, { status: 503 });
    }

    const body = sendOtpSchema.parse(await request.json());
    const sessionToken = getSessionToken(request, body);

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Chat session is required' }, { status: 400 });
    }

    const session = await getActiveChatSession(sessionToken);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Chat session expired or not found' }, { status: 410 });
    }

    const bookingReference = normalizeBookingReference(body.bookingReference);
    const booking = await findBookingForContact(bookingReference, body.contact);

    if (!booking) {
      await prisma.toolAuditLog.create({
        data: {
          sessionId: session.id,
          toolName: 'initiate_booking_verification',
          input: {
            bookingReference,
          },
          outputStatus: 'error',
          outputSummary: 'Booking verification failed due to reference/contact mismatch',
        },
      });

      return NextResponse.json(
        { success: false, error: 'Booking reference or contact did not match our records' },
        { status: 400 }
      );
    }

    const attempt = await createVerificationAttempt(session.id, bookingReference, body.contact);
    const delivery = await deliverOtp(body.contact, attempt.otp);

    if (!delivery.sent) {
      const errorMessage =
        delivery.reason === 'sms_not_configured'
          ? 'OTP on phone number is not enabled yet. Please use your booking email for OTP.'
          : delivery.reason === 'email_delivery_failed'
            ? 'OTP email could not be sent. Please ensure sender domain is verified in Resend and try again.'
          : 'Unable to deliver OTP right now. Please contact reception.';

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 503 }
      );
    }

    await prisma.toolAuditLog.create({
      data: {
        sessionId: session.id,
        toolName: 'initiate_booking_verification',
        input: {
          bookingReference,
          contact: attempt.maskedContact,
        },
        outputStatus: 'success',
        outputSummary: `OTP sent via ${delivery.channel}`,
      },
    });

    return NextResponse.json(
      {
        success: true,
        bookingReference,
        maskedContact: attempt.maskedContact,
        expiresAt: attempt.expiresAt,
        channel: delivery.channel,
        debugOtp: delivery.debugOtp,
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

    console.error('OTP send error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send OTP' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
