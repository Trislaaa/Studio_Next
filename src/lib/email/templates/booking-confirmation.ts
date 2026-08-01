import { buildEmailLayout, formatDate, formatInr, detailRow } from './layout';
import { sendEmail, EmailResult } from '../client';

export interface BookingConfirmationData {
  guestName: string;
  guestEmail: string;
  bookingReference: string;
  roomType: string;
  roomNumber: string;
  checkIn: Date | string;
  checkOut: Date | string;
  numberOfGuests: number;
  numberOfNights: number;
  totalAmount: number;
  taxAmount: number;
  paymentMethod: string;
  specialRequests?: string;
  addons?: string[];
}

export function buildConfirmationEmail(data: BookingConfirmationData): string {
  const baseAmount = data.totalAmount - data.taxAmount;
  const addonsHtml = data.addons && data.addons.length > 0
    ? `<p style="font-family:Arial,sans-serif;font-size:13px;color:#666;margin:16px 0 4px;">
        <strong>Add-ons:</strong> ${data.addons.join(', ')}
      </p>`
    : '';

  const specialReqHtml = data.specialRequests
    ? `<p style="font-family:Arial,sans-serif;font-size:13px;color:#666;margin:8px 0 4px;">
        <strong>Special requests:</strong> ${data.specialRequests}
      </p>`
    : '';

  const contentHtml = `
    <h1 style="font-family:Georgia,serif;font-size:28px;color:#1e2f27;margin:0 0 6px;">
      Booking Confirmed
    </h1>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#888;margin:0 0 24px;letter-spacing:1px;text-transform:uppercase;">
      ${data.bookingReference}
    </p>

    <p style="font-family:Arial,sans-serif;font-size:15px;color:#444;line-height:1.7;margin:0 0 24px;">
      Dear <strong>${data.guestName}</strong>,<br/>
      Your reservation at <strong>STUDIO NEXT</strong> has been confirmed.
      We look forward to welcoming you to Concept to creation.
    </p>

    <hr class="gold-divider" style="height:1px;background:#C9A66B;border:none;margin:28px 0;"/>

    <!-- Booking Details -->
    <div style="background:#faf8f5;border:1px solid #e8e0d0;border-radius:8px;padding:24px;margin:0 0 24px;">
      ${detailRow('Room', `${data.roomType} — Room ${data.roomNumber}`)}
      ${detailRow('Check-In', `${formatDate(data.checkIn)} <span style="color:#888;font-weight:normal;font-size:12px;">(from 11:00 AM)</span>`)}
      ${detailRow('Check-Out', `${formatDate(data.checkOut)} <span style="color:#888;font-weight:normal;font-size:12px;">(by 10:00 AM)</span>`)}
      ${detailRow('Duration', `${data.numberOfNights} night${data.numberOfNights !== 1 ? 's' : ''} · ${data.numberOfGuests} guest${data.numberOfGuests !== 1 ? 's' : ''}`)}
      ${detailRow('Room Total', formatInr(baseAmount))}
      ${detailRow('GST & Taxes', formatInr(data.taxAmount))}
      ${detailRow('Total Paid', formatInr(data.totalAmount))}
      ${detailRow('Payment', data.paymentMethod)}
    </div>

    ${addonsHtml}
    ${specialReqHtml}

    <!-- Policy Reminder -->
    <div style="background:#fff8ee;border-left:3px solid #C9A66B;padding:16px 20px;margin:24px 0;border-radius:0 4px 4px 0;">
      <p style="font-family:Arial,sans-serif;font-size:13px;color:#7a6030;margin:0;line-height:1.6;">
        <strong>Cancellation Policy:</strong> 95% refund if cancelled more than 48 hours before check-in (5% platform fee applies to cover payment gateway charges).
        50% refund for cancellations within 24-48 hours. No refund within 24 hours.
      </p>
    </div>

    <p style="text-align:center;">
      <a href="${process.env.NEXTAUTH_URL || 'https://Studio next-hotel1.vercel.app'}/book/confirmation?bookingRef=${data.bookingReference}"
         style="display:inline-block;background-color:#1e2f27;color:#ffffff;text-decoration:none;padding:14px 36px;font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;border-radius:2px;">
        View Booking
      </a>
    </p>

    <p style="text-align:center;margin-top:12px;">
      <a href="${process.env.NEXTAUTH_URL || 'https://Studio next-hotel1.vercel.app'}/manage?reference=${data.bookingReference}"
         style="display:inline-block;background-color:#ffffff;color:#1e2f27;text-decoration:none;padding:12px 30px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;font-weight:bold;border-radius:2px;border:1px solid #1e2f27;">
        Manage or Cancel Booking
      </a>
    </p>

    <p style="font-family:Arial,sans-serif;font-size:14px;color:#888;line-height:1.7;margin:24px 0 0;text-align:center;">
      Need help? Reply to this email or call us at <strong>8928584198</strong>
    </p>
  `;

  return buildEmailLayout(contentHtml, `Your booking ${data.bookingReference} is confirmed — ${data.roomType} from ${formatDate(data.checkIn)}`);
}

export async function sendBookingConfirmation(data: BookingConfirmationData): Promise<EmailResult> {
  return sendEmail({
    to: data.guestEmail,
    subject: `Booking Confirmed — ${data.bookingReference} | STUDIO NEXT`,
    html: buildConfirmationEmail(data),
  });
}
