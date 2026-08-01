import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_PREFIX = 'mb1';
const DEFAULT_EXPIRY_MINUTES = 15;

type ManageBookingTokenPayload = {
  v: 1;
  purpose: 'manage-booking';
  ref: string;
  iat: number;
  exp: number;
};

export type VerifiedManageBookingToken = {
  bookingReference: string;
  issuedAt: Date;
  expiresAt: Date;
};

export type VerifyManageBookingTokenResult =
  | { ok: true; value: VerifiedManageBookingToken }
  | { ok: false; reason: 'invalid' | 'expired' };

function getManageTokenSecret() {
  const secret = process.env.MANAGE_BOOKING_TOKEN_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error('Manage booking token secret is not configured');
  }

  return secret;
}

function toBase64Url(value: Buffer | string) {
  return Buffer.from(value).toString('base64url');
}

function fromBase64Url(value: string) {
  return Buffer.from(value, 'base64url');
}

function sign(payloadBase64: string) {
  return toBase64Url(createHmac('sha256', getManageTokenSecret()).update(payloadBase64).digest());
}

export function createManageBookingToken(bookingReference: string, expiresInMinutes = DEFAULT_EXPIRY_MINUTES) {
  const now = Date.now();
  const payload: ManageBookingTokenPayload = {
    v: 1,
    purpose: 'manage-booking',
    ref: bookingReference.trim().toUpperCase(),
    iat: now,
    exp: now + Math.max(1, expiresInMinutes) * 60 * 1000,
  };

  const payloadBase64 = toBase64Url(JSON.stringify(payload));
  const signature = sign(payloadBase64);

  return `${TOKEN_PREFIX}.${payloadBase64}.${signature}`;
}

function safeEqualBase64Url(left: string, right: string) {
  try {
    const leftBuffer = fromBase64Url(left);
    const rightBuffer = fromBase64Url(right);

    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

export function verifyManageBookingToken(token: string): VerifyManageBookingTokenResult {
  if (!token) {
    return { ok: false, reason: 'invalid' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { ok: false, reason: 'invalid' };
  }

  const [prefix, payloadBase64, signature] = parts;
  if (prefix !== TOKEN_PREFIX) {
    return { ok: false, reason: 'invalid' };
  }

  const expectedSignature = sign(payloadBase64);
  if (!safeEqualBase64Url(signature, expectedSignature)) {
    return { ok: false, reason: 'invalid' };
  }

  try {
    const payload = JSON.parse(fromBase64Url(payloadBase64).toString('utf8')) as Partial<ManageBookingTokenPayload>;

    if (
      payload.v !== 1 ||
      payload.purpose !== 'manage-booking' ||
      typeof payload.ref !== 'string' ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number'
    ) {
      return { ok: false, reason: 'invalid' };
    }

    if (payload.exp <= Date.now()) {
      return { ok: false, reason: 'expired' };
    }

    return {
      ok: true,
      value: {
        bookingReference: payload.ref,
        issuedAt: new Date(payload.iat),
        expiresAt: new Date(payload.exp),
      },
    };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}
