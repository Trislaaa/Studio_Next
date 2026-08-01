import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { chatConfig } from '@/lib/chat/config';
import { prisma } from '@/lib/db';
import { getActiveChatSession } from '@/lib/chat/session';
import { normalizeBookingReference, verifyOtpAttempt } from '@/lib/chat/verification';

const bookingReferenceSchema = z
  .string()
  .regex(/^OMK-\d{8}-[A-Z0-9]{4,8}$/i, 'Booking reference must match OMK-YYYYMMDD-XXXX format');

const verifyOtpSchema = z.object({
  sessionToken: z.string().min(1).optional(),
  bookingReference: bookingReferenceSchema,
  otp: z.string().regex(/^\d{6}$/),
});

function getSessionToken(request: NextRequest, body: { sessionToken?: string }) {
  return body.sessionToken ?? request.cookies.get('chat_session_token')?.value ?? null;
}

export async function POST(request: NextRequest) {
  try {
    if (!chatConfig.enabled) {
      return NextResponse.json({ success: false, error: 'Chatbot is disabled' }, { status: 503 });
    }

    const body = verifyOtpSchema.parse(await request.json());
    const sessionToken = getSessionToken(request, body);

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Chat session is required' }, { status: 400 });
    }

    const session = await getActiveChatSession(sessionToken);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Chat session expired or not found' }, { status: 410 });
    }

    const bookingReference = normalizeBookingReference(body.bookingReference);
    const verification = await verifyOtpAttempt(session.id, bookingReference, body.otp);

    if (!verification.ok) {
      const statusByReason: Record<typeof verification.reason, number> = {
        not_found: 404,
        expired: 410,
        locked: 429,
        invalid: 400,
      };

      await prisma.toolAuditLog.create({
        data: {
          sessionId: session.id,
          toolName: 'verify_booking_otp',
          input: {
            bookingReference,
          },
          outputStatus: 'error',
          outputSummary: `OTP verification failed: ${verification.reason}`,
        },
      });

      return NextResponse.json(
        { success: false, error: `OTP verification failed: ${verification.reason}` },
        { status: statusByReason[verification.reason], headers: { 'Cache-Control': 'no-store' } }
      );
    }

    await prisma.toolAuditLog.create({
      data: {
        sessionId: session.id,
        toolName: 'verify_booking_otp',
        input: {
          bookingReference,
        },
        outputStatus: 'success',
        outputSummary: 'OTP verification successful',
      },
    });

    return NextResponse.json(
      {
        success: true,
        verified: true,
        bookingReference,
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

    console.error('OTP check error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify OTP' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
