import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyOtp } from '@/lib/otp-store';

const schema = z.object({
    email: z.string().email('Invalid email address'),
    otp: z.string().length(6, 'OTP must be exactly 6 digits').regex(/^\d{6}$/, 'OTP must be numeric'),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, otp } = schema.parse(body);

        const result = verifyOtp(email, otp);

        if (result.ok) {
            return NextResponse.json({ verified: true });
        }

        if (result.reason === 'expired') {
            return NextResponse.json(
                { error: 'This code has expired. Please request a new one.', reason: 'expired' },
                { status: 410 }
            );
        }

        if (result.reason === 'locked') {
            return NextResponse.json(
                { error: 'Too many wrong attempts. Please request a new code.', reason: 'locked' },
                { status: 423 }
            );
        }

        // Invalid OTP
        return NextResponse.json(
            {
                error: `Incorrect code. ${result.attemptsLeft ?? 0} attempt${result.attemptsLeft === 1 ? '' : 's'} remaining.`,
                reason: 'invalid',
                attemptsLeft: result.attemptsLeft,
            },
            { status: 400 }
        );
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Invalid request', details: error.issues }, { status: 400 });
        }
        console.error('[OTP] Verify error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
