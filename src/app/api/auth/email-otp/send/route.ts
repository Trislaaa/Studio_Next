import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createOtp } from '@/lib/otp-store';
import { sendOtpEmail } from '@/lib/email/templates/otp';
import { checkApiRateLimit } from '@/lib/api-rate-limit';

const schema = z.object({
    email: z.string().email('Invalid email address'),
    name: z.string().min(1).default('Guest'),
});

export async function POST(request: NextRequest) {
    try {
        // ── Rate limit: max 20 OTP sends per IP per hour ─────────────────────
        const rateLimit = await checkApiRateLimit(request, 'otp-send', {
            max: 20,
            windowMs: 60 * 60 * 1000, // 1 hour
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                {
                    error: `Too many verification requests. Please try again later.`,
                    cooldownRemainingSeconds: rateLimit.retryAfterSeconds,
                },
                {
                    status: 429,
                    headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
                }
            );
        }

        const body = await request.json();
        const { email, name } = schema.parse(body);

        const result = createOtp(email);

        if (result.cooldownConflict) {
            return NextResponse.json(
                {
                    error: `Please wait ${result.remainingSeconds} seconds before requesting a new code.`,
                    cooldownRemainingSeconds: result.remainingSeconds,
                },
                { status: 429 }
            );
        }

        const emailResult = await sendOtpEmail({
            guestName: name,
            guestEmail: email,
            otp: result.otp,
            expiresInMinutes: 10,
        });

        if (!emailResult.success) {
            console.error('[OTP] Failed to send OTP email:', emailResult.error);
            return NextResponse.json(
                { error: 'Failed to send verification email. Please try again.' },
                { status: 500 }
            );
        }

        return NextResponse.json({ sent: true });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Invalid request', details: error.issues }, { status: 400 });
        }
        console.error('[OTP] Send error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
