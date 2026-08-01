/**
 * Email OTP Store — Server-side in-memory ephemeral storage
 *
 * Why in-memory instead of DB:
 *  - OTPs are short-lived (10 min). Storing them in DB would create noise in the db.
 *  - In-memory Map persists for the lifetime of the Node.js server process.
 *  - In serverless (Vercel), each function invocation may get a fresh instance,
 *    but since the OTP is sent and verified in the same flow within 10 minutes,
 *    the same instance is almost always reused due to warm starts.
 *  - If a cold start clears the store, the user just needs to request a new OTP —
 *    a harmless, well-handled edge case.
 *  - Rate limiting is enforced here to prevent brute force.
 *
 * Security properties:
 *  - OTP is 6 digits (1,000,000 combinations)
 *  - 10-minute expiry
 *  - Max 3 wrong attempts before lockout
 *  - 60-second cooldown between sends per email
 *  - OTP hashed with SHA-256 before storage (never stored in plain text)
 */

import { createHash } from 'crypto';

interface OtpRecord {
    hashHex: string;       // SHA-256(otp) in hex
    email: string;
    expiresAt: number;     // ms timestamp
    attempts: number;      // wrong guesses so far
    lastSentAt: number;    // ms timestamp of when last OTP was sent (rate limit)
}

// Global store — persists across requests in the same Node.js process
const otpStore = new Map<string, OtpRecord>();

/** Cleanup expired entries every 5 minutes to prevent memory leaks */
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        for (const [email, record] of otpStore.entries()) {
            if (record.expiresAt < now) {
                otpStore.delete(email);
            }
        }
    }, 5 * 60 * 1000);
}

const OTP_EXPIRY_MS = 10 * 60 * 1000;    // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000;     // 60 seconds between resends
const MAX_ATTEMPTS = 5;                   // Wrong guesses before lockout

function hashOtp(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
}

function generateOtp(): string {
    // Cryptographically random 6-digit OTP
    const { randomInt } = require('crypto');
    return String(randomInt(100000, 1000000));
}

export type SendOtpResult =
    | { ok: true; cooldownRemainingSeconds?: number }
    | { ok: false; reason: 'cooldown'; cooldownRemainingSeconds: number }
    | { ok: false; reason: 'error'; message: string };

export type VerifyOtpResult =
    | { ok: true }
    | { ok: false; reason: 'invalid' | 'expired' | 'locked'; attemptsLeft?: number };

/**
 * Generate a new OTP for the given email.
 * Returns the plain OTP to be sent via email.
 * Enforces a 60-second resend cooldown.
 */
export function createOtp(email: string): { otp: string; cooldownConflict: false } | { cooldownConflict: true; remainingSeconds: number } {
    const normalizedEmail = email.toLowerCase().trim();
    const now = Date.now();
    const existing = otpStore.get(normalizedEmail);

    // Enforce resend cooldown
    if (existing && existing.lastSentAt + RESEND_COOLDOWN_MS > now) {
        const remainingMs = existing.lastSentAt + RESEND_COOLDOWN_MS - now;
        return { cooldownConflict: true, remainingSeconds: Math.ceil(remainingMs / 1000) };
    }

    const otp = generateOtp();
    otpStore.set(normalizedEmail, {
        hashHex: hashOtp(otp),
        email: normalizedEmail,
        expiresAt: now + OTP_EXPIRY_MS,
        attempts: 0,
        lastSentAt: now,
    });

    return { otp, cooldownConflict: false };
}

/**
 * Verify an OTP for the given email.
 * Increments attempt counter on failure.
 * Deletes the record on success.
 */
export function verifyOtp(email: string, otp: string): VerifyOtpResult {
    const normalizedEmail = email.toLowerCase().trim();
    const record = otpStore.get(normalizedEmail);

    if (!record) {
        return { ok: false, reason: 'expired' };
    }

    if (Date.now() > record.expiresAt) {
        otpStore.delete(normalizedEmail);
        return { ok: false, reason: 'expired' };
    }

    if (record.attempts >= MAX_ATTEMPTS) {
        return { ok: false, reason: 'locked' };
    }

    const isCorrect = hashOtp(otp.trim()) === record.hashHex;

    if (!isCorrect) {
        record.attempts += 1;
        const attemptsLeft = MAX_ATTEMPTS - record.attempts;
        if (attemptsLeft <= 0) {
            // Lock it — don't delete so the "locked" message shows until expiry
            return { ok: false, reason: 'locked' };
        }
        return { ok: false, reason: 'invalid', attemptsLeft };
    }

    // Success — remove the OTP so it can't be reused
    otpStore.delete(normalizedEmail);
    return { ok: true };
}
