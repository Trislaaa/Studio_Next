import { buildEmailLayout, formatDate, formatInr, detailRow } from './layout';
import { sendEmail, EmailResult } from '../client';

export interface BookingCancellationData {
  guestName: string;
  guestEmail: string;
  bookingReference: string;
  roomType: string;
  checkIn: Date | string;
  checkOut: Date | string;
  totalAmount: number;
  refundAmount: number;
  platformFeeAmount?: number;
  cancellationReason?: string;
}

export function buildCancellationEmail(data: BookingCancellationData): string {
  const penaltyAmount = data.totalAmount - data.refundAmount;
  const platformFee = data.platformFeeAmount ?? 0;
  const isFullRefund = data.refundAmount > 0 && platformFee > 0 && penaltyAmount === platformFee;
  const isNoRefund = data.refundAmount === 0;
  const isPartialRefund = !isFullRefund && !isNoRefund && data.refundAmount > 0;

  const refundBannerHtml = isNoRefund
    ? `<div style="background:#fff0f0;border-left:3px solid #e53e3e;padding:16px 20px;margin:24px 0;border-radius:0 4px 4px 0;">
        <p style="font-family:Arial,sans-serif;font-size:13px;color:#c53030;margin:0;line-height:1.6;">
          <strong>No Refund:</strong> Cancellation within 24 hours of check-in. Per our policy, no refund is applicable.
        </p>
      </div>`
    : isFullRefund
    ? `<div style="background:#f0fff4;border-left:3px solid #38a169;padding:16px 20px;margin:24px 0;border-radius:0 4px 4px 0;">
        <p style="font-family:Arial,sans-serif;font-size:13px;color:#276749;margin:0;line-height:1.6;">
          <strong>Refund of ${formatInr(data.refundAmount)}</strong> will be processed to your original payment method within 5-7 business days.
          A non-refundable platform fee of ${formatInr(platformFee)} (5%) has been deducted to cover payment gateway processing charges.
        </p>
      </div>`
    : `<div style="background:#fffbeb;border-left:3px solid #C9A66B;padding:16px 20px;margin:24px 0;border-radius:0 4px 4px 0;">
        <p style="font-family:Arial,sans-serif;font-size:13px;color:#7a6030;margin:0;line-height:1.6;">
          <strong>Partial Refund:</strong> ${formatInr(data.refundAmount)} will be returned to your original payment method within 5-7 business days.
          A cancellation charge of ${formatInr(penaltyAmount)} applies per our policy.
        </p>
      </div>`;

  const reasonHtml = data.cancellationReason
    ? `<p style="font-family:Arial,sans-serif;font-size:13px;color:#888;margin:0 0 16px;">
        <strong>Reason noted:</strong> ${data.cancellationReason}
      </p>`
    : '';

  const contentHtml = `
    <h1 style="font-family:Georgia,serif;font-size:28px;color:#1e2f27;margin:0 0 6px;">
      Booking Cancelled
    </h1>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#888;margin:0 0 24px;letter-spacing:1px;text-transform:uppercase;">
      ${data.bookingReference}
    </p>

    <p style="font-family:Arial,sans-serif;font-size:15px;color:#444;line-height:1.7;margin:0 0 24px;">
      Dear <strong>${data.guestName}</strong>,<br/>
      Your reservation at <strong>STUDIO NEXT</strong> has been cancelled.
      We are sorry to see you go, and hope to welcome you to Mahabaleshwar another time.
    </p>

    ${reasonHtml}

    <hr style="height:1px;background:#e8e0d0;border:none;margin:20px 0;"/>

    <div style="background:#faf8f5;border:1px solid #e8e0d0;border-radius:8px;padding:24px;margin:0 0 24px;">
      ${detailRow('Room', data.roomType)}
      ${detailRow('Check-In', formatDate(data.checkIn))}
      ${detailRow('Check-Out', formatDate(data.checkOut))}
      ${detailRow('Original Total', formatInr(data.totalAmount))}
      ${platformFee > 0 ? detailRow('Platform Fee (5%)', formatInr(platformFee)) : ''}
      ${isPartialRefund ? detailRow('Cancellation Charge', formatInr(penaltyAmount)) : ''}
      ${detailRow('Refund Amount', isNoRefund ? 'No refund' : formatInr(data.refundAmount))}
    </div>

    ${refundBannerHtml}

    <p style="text-align:center;">
      <a href="${process.env.NEXTAUTH_URL || 'https://Studio next-hotel1.vercel.app'}/book"
         style="display:inline-block;background-color:#1e2f27;color:#ffffff;text-decoration:none;padding:14px 36px;font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;border-radius:2px;">
        Book Again
      </a>
    </p>

    <p style="font-family:Arial,sans-serif;font-size:14px;color:#888;line-height:1.7;margin:24px 0 0;text-align:center;">
      Questions? Reply to this email or call <strong>8928584198</strong>
    </p>
  `;

  return buildEmailLayout(contentHtml, `Cancellation confirmed — ${data.bookingReference}`);
}

export async function sendBookingCancellation(data: BookingCancellationData): Promise<EmailResult> {
  return sendEmail({
    to: data.guestEmail,
    subject: `Booking Cancelled — ${data.bookingReference} | STUDIO NEXT`,
    html: buildCancellationEmail(data),
  });
}
