import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { chatConfig } from './config';

type ContactKind = 'email' | 'phone';

type ParsedContact = {
  kind: ContactKind;
  value: string;
};

type OtpDeliveryResult = {
  sent: boolean;
  channel: 'email' | 'console' | 'none';
  debugOtp?: string;
  reason?: 'sms_not_configured' | 'email_delivery_failed';
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeBookingReference(reference: string) {
  return reference.trim().toUpperCase();
}

function normalizePhone(phone: string) {
  const digitsOnly = phone.replace(/\D+/g, '');

  if (digitsOnly.length < 8) {
    return null;
  }

  return digitsOnly.length > 10 ? digitsOnly.slice(-10) : digitsOnly;
}

function parseContact(raw: string): ParsedContact | null {
  const value = raw.trim();

  if (!value) return null;

  if (EMAIL_REGEX.test(value)) {
    return { kind: 'email', value: value.toLowerCase() };
  }

  const normalizedPhone = normalizePhone(value);
  if (!normalizedPhone) {
    return null;
  }

  return { kind: 'phone', value: normalizedPhone };
}

export function maskContact(raw: string) {
  const contact = parseContact(raw);

  if (!contact) {
    return '***';
  }

  if (contact.kind === 'email') {
    const [localPart, domain] = contact.value.split('@');
    const visibleLocal = localPart.slice(0, Math.min(2, localPart.length));
    return `${visibleLocal}***@${domain}`;
  }

  return `******${contact.value.slice(-4)}`;
}

function generateOtpCode() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

async function sendOtpEmail(to: string, otp: string) {
  if (!chatConfig.resendApiKey || !chatConfig.otpFromEmail) {
    return false;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${chatConfig.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: chatConfig.otpFromEmail,
      to: [to],
      subject: 'Your STUDIO NEXT verification code',
      html: `<p>Hello,</p><p>Your STUDIO NEXT verification code is:</p><h2>${otp}</h2><p>This code expires in ${chatConfig.otpExpiryMinutes} minutes.</p>`,
    }),
  });

  if (response.ok) {
    return true;
  }

  const body = await response.text();
  console.error('OTP email delivery failed:', body);
  return false;
}

export async function deliverOtp(contactRaw: string, otp: string): Promise<OtpDeliveryResult> {
  const contact = parseContact(contactRaw);
  if (!contact) {
    return { sent: false, channel: 'none' };
  }

  const shouldUseConsoleFallback =
    chatConfig.otpDeliveryMode === 'console' ||
    (process.env.NODE_ENV !== 'production' && chatConfig.otpDeliveryMode !== 'email');

  if (contact.kind === 'email') {
    const delivered = await sendOtpEmail(contact.value, otp);
    if (delivered) {
      return { sent: true, channel: 'email' };
    }

    if (!shouldUseConsoleFallback) {
      return { sent: false, channel: 'none', reason: 'email_delivery_failed' };
    }
  }

  if (shouldUseConsoleFallback) {
    console.log(`[CHAT_OTP] ${contact.value} -> ${otp}`);
    return {
      sent: true,
      channel: 'console',
      debugOtp: chatConfig.includeDebugOtp ? otp : undefined,
    };
  }

  if (contact.kind === 'phone') {
    return { sent: false, channel: 'none', reason: 'sms_not_configured' };
  }

  return { sent: false, channel: 'none' };
}

export async function findBookingForContact(bookingReferenceRaw: string, contactRaw: string) {
  const bookingReference = normalizeBookingReference(bookingReferenceRaw);
  const contact = parseContact(contactRaw);

  if (!contact) {
    return null;
  }

  const booking = await prisma.booking.findUnique({
    where: { bookingReference },
    include: {
      guest: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  if (!booking) {
    return null;
  }

  const emailMatches = contact.kind === 'email' && booking.guest.email.toLowerCase() === contact.value;
  const guestPhoneNormalized = normalizePhone(booking.guest.phone);
  const phoneMatches = contact.kind === 'phone' && guestPhoneNormalized === contact.value;

  if (!emailMatches && !phoneMatches) {
    return null;
  }

  return booking;
}

export async function createVerificationAttempt(
  sessionId: string,
  bookingReferenceRaw: string,
  contactRaw: string
) {
  const bookingReference = normalizeBookingReference(bookingReferenceRaw);
  const contact = parseContact(contactRaw);

  if (!contact) {
    throw new Error('Invalid contact');
  }

  const otp = generateOtpCode();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + chatConfig.otpExpiryMinutes * 60 * 1000);

  await prisma.verificationAttempt.updateMany({
    where: {
      sessionId,
      bookingReference,
      isVerified: false,
    },
    data: {
      expiresAt: new Date(),
    },
  });

  const attempt = await prisma.verificationAttempt.create({
    data: {
      sessionId,
      bookingReference,
      contactEmail: contact.kind === 'email' ? contact.value : null,
      contactPhone: contact.kind === 'phone' ? contact.value : null,
      otpHash,
      maxAttempts: chatConfig.otpMaxAttempts,
      expiresAt,
    },
  });

  return {
    attempt,
    otp,
    expiresAt,
    maskedContact: maskContact(contactRaw),
  };
}

export async function verifyOtpAttempt(
  sessionId: string,
  bookingReferenceRaw: string,
  otp: string
): Promise<{ ok: true } | { ok: false; reason: 'not_found' | 'expired' | 'locked' | 'invalid' }> {
  const bookingReference = normalizeBookingReference(bookingReferenceRaw);

  const attempt = await prisma.verificationAttempt.findFirst({
    where: {
      sessionId,
      bookingReference,
      isVerified: false,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!attempt) {
    return { ok: false, reason: 'not_found' };
  }

  if (attempt.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: 'expired' };
  }

  if (attempt.otpAttempts >= attempt.maxAttempts) {
    return { ok: false, reason: 'locked' };
  }

  const isValidOtp = await bcrypt.compare(otp, attempt.otpHash);

  if (!isValidOtp) {
    await prisma.verificationAttempt.update({
      where: { id: attempt.id },
      data: {
        otpAttempts: {
          increment: 1,
        },
      },
    });

    return { ok: false, reason: 'invalid' };
  }

  await prisma.$transaction([
    prisma.verificationAttempt.update({
      where: { id: attempt.id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
      },
    }),
    prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        referenceNumber: bookingReference,
        emailOrPhone: attempt.contactEmail ?? attempt.contactPhone ?? null,
      },
    }),
  ]);

  return { ok: true };
}
