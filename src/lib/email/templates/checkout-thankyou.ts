import { buildEmailLayout, formatDate, formatInr, detailRow } from './layout';
import { sendEmail, EmailResult } from '../client';

export interface CheckoutThankyouData {
  guestName: string;
  guestEmail: string;
  bookingReference: string;
  roomType: string;
  checkIn: Date | string;
  checkOut: Date | string;
  numberOfNights: number;
  totalAmount: number;
  taxAmount: number;
  paymentMethod: string;
}

export function buildCheckoutThankyouEmail(data: CheckoutThankyouData): string {
  const baseAmount = data.totalAmount - data.taxAmount;

  const contentHtml = `
    <h1 style="font-family:Georgia,serif;font-size:28px;color:#1e2f27;margin:0 0 6px;">
      Thank You for Staying With Us
    </h1>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#888;margin:0 0 24px;letter-spacing:1px;text-transform:uppercase;">
      We hope to see you again
    </p>

    <p style="font-family:Arial,sans-serif;font-size:15px;color:#444;line-height:1.7;margin:0 0 24px;">
      Dear <strong>${data.guestName}</strong>,<br/>
      Thank you for choosing <strong>STUDIO NEXT</strong> for your retreat to Mahabaleshwar.
      It was a pleasure hosting you. We hope you enjoyed every moment and will carry
      the warmth of the hills in your heart.
    </p>

    <hr style="height:1px;background:#C9A66B;border:none;margin:28px 0;"/>

    <!-- Receipt Summary -->
    <p style="font-family:Arial,sans-serif;font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#888;margin:0 0 16px;">
      Your Receipt
    </p>
    <div style="background:#faf8f5;border:1px solid #e8e0d0;border-radius:8px;padding:24px;margin:0 0 24px;">
      ${detailRow('Booking Reference', data.bookingReference)}
      ${detailRow('Room Type', data.roomType)}
      ${detailRow('Check-In', formatDate(data.checkIn))}
      ${detailRow('Check-Out', formatDate(data.checkOut))}
      ${detailRow('Duration', `${data.numberOfNights} night${data.numberOfNights !== 1 ? 's' : ''}`)}
      ${detailRow('Room Charges', formatInr(baseAmount))}
      ${detailRow('GST & Taxes', formatInr(data.taxAmount))}
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 0;border-top:2px solid #C9A66B;padding-top:12px;">
        <tr>
          <td style="font-family:Georgia,serif;font-size:16px;color:#1e2f27;font-weight:bold;padding:8px 0;">Total Paid</td>
          <td style="font-family:Georgia,serif;font-size:16px;color:#1e2f27;font-weight:bold;padding:8px 0;text-align:right;">${formatInr(data.totalAmount)}</td>
        </tr>
      </table>
    </div>

    <!-- Share your experience -->
    <div style="text-align:center;padding:32px 20px;background:#faf8f5;border-radius:8px;margin:24px 0;">
      <p style="font-family:Georgia,serif;font-size:20px;color:#1e2f27;margin:0 0 12px;">
        How was your stay?
      </p>
      <p style="font-family:Arial,sans-serif;font-size:14px;color:#888;line-height:1.7;margin:0 0 20px;">
        Your review helps other travellers find the peace of Mahabaleshwar.
      </p>
      <a href="https://g.page/r/Studio nexthotel/review"
         style="display:inline-block;background-color:#C9A66B;color:#1e2f27;text-decoration:none;padding:12px 28px;font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;border-radius:2px;">
        Leave a Review ★
      </a>
    </div>

    <p style="text-align:center;">
      <a href="${process.env.NEXTAUTH_URL || 'https://Studio next-hotel1.vercel.app'}/book"
         style="display:inline-block;background-color:#1e2f27;color:#ffffff;text-decoration:none;padding:14px 36px;font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;border-radius:2px;">
        Plan Your Next Visit
      </a>
    </p>

    <p style="font-family:Arial,sans-serif;font-size:13px;color:#aaa;line-height:1.7;margin:24px 0 0;text-align:center;">
      Keep this email as your receipt. For any billing queries, please quote
      <strong>${data.bookingReference}</strong> and contact us at Studio nexthotel2026@gmail.com.
    </p>
  `;

  return buildEmailLayout(contentHtml, `Thank you for staying at STUDIO NEXT — Your receipt for ${data.bookingReference}`);
}

export async function sendCheckoutThankyou(data: CheckoutThankyouData): Promise<EmailResult> {
  return sendEmail({
    to: data.guestEmail,
    subject: `Thank You for Staying! Receipt — ${data.bookingReference} | STUDIO NEXT`,
    html: buildCheckoutThankyouEmail(data),
  });
}
