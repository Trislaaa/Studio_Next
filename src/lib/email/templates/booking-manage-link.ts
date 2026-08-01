import { buildEmailLayout, detailRow } from './layout';
import { sendEmail, type EmailResult } from '../client';

export interface BookingManageLinkData {
  guestEmail: string;
  bookingReference: string;
  token: string;
  expiresInMinutes?: number;
}

function getManageBookingUrl(token: string) {
  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `${baseUrl.replace(/\/$/, '')}/manage/${token}`;
}

function resolveExpiryMinutes(expiry?: number) {
  if (typeof expiry === 'number' && Number.isFinite(expiry) && expiry > 0) {
    return Math.floor(expiry);
  }

  const parsed = Number.parseInt(process.env.MANAGE_BOOKING_LINK_EXPIRY_MINUTES ?? '15', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
}

export function buildManageBookingLinkEmail(data: BookingManageLinkData): string {
  const expiresInMinutes = resolveExpiryMinutes(data.expiresInMinutes);
  const manageUrl = getManageBookingUrl(data.token);

  const contentHtml = `
    <h1 style="font-family:Georgia,serif;font-size:28px;color:#1e2f27;margin:0 0 8px;">Manage Your Booking</h1>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#666;margin:0 0 24px;">
      Use the secure link below to review your booking and proceed with cancellation if needed.
    </p>

    <div style="background:#faf8f5;border:1px solid #e8e0d0;border-radius:8px;padding:20px;margin:0 0 24px;">
      ${detailRow('Booking Reference', data.bookingReference)}
      ${detailRow('Link Expires In', `${expiresInMinutes} minutes`)}
    </div>

    <p style="text-align:center;margin:0 0 20px;">
      <a href="${manageUrl}" style="display:inline-block;background-color:#1e2f27;color:#ffffff;text-decoration:none;padding:14px 28px;font-family:Arial,sans-serif;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;font-weight:bold;border-radius:2px;">
        Open Manage Booking
      </a>
    </p>

    <p style="font-family:Arial,sans-serif;font-size:13px;color:#666;line-height:1.6;margin:0;">
      For your security, this link is time-limited and should not be shared.
      If you did not request this, you can safely ignore this email.
    </p>
  `;

  return buildEmailLayout(contentHtml, `Secure manage booking link for ${data.bookingReference}`);
}

export async function sendManageBookingLink(
  guestEmail: string,
  bookingReference: string,
  token: string,
  expiresInMinutes?: number
): Promise<EmailResult> {
  return sendEmail({
    to: guestEmail,
    subject: `Manage Booking — ${bookingReference} | STUDIO NEXT`,
    html: buildManageBookingLinkEmail({
      guestEmail,
      bookingReference,
      token,
      expiresInMinutes,
    }),
  });
}
