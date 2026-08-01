import { buildEmailLayout, formatDate, detailRow } from './layout';
import { sendEmail, EmailResult } from '../client';

export interface CheckInReminderData {
  guestName: string;
  guestEmail: string;
  bookingReference: string;
  roomType: string;
  roomNumber: string;
  checkIn: Date | string;
  checkOut: Date | string;
  numberOfGuests: number;
  numberOfNights: number;
  specialRequests?: string;
}

export function buildCheckInReminderEmail(data: CheckInReminderData): string {
  const specialReqHtml = data.specialRequests
    ? `<div style="background:#fff8ee;border-left:3px solid #C9A66B;padding:16px 20px;margin:24px 0;border-radius:0 4px 4px 0;">
        <p style="font-family:Arial,sans-serif;font-size:13px;color:#7a6030;margin:0;line-height:1.6;">
          <strong>Your special requests on file:</strong> ${data.specialRequests}
        </p>
      </div>`
    : '';

  const contentHtml = `
    <h1 style="font-family:Georgia,serif;font-size:28px;color:#1e2f27;margin:0 0 6px;">
      Your Stay Begins Tomorrow
    </h1>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#888;margin:0 0 24px;letter-spacing:1px;text-transform:uppercase;">
      We can't wait to welcome you
    </p>

    <p style="font-family:Arial,sans-serif;font-size:15px;color:#444;line-height:1.7;margin:0 0 24px;">
      Dear <strong>${data.guestName}</strong>,<br/>
      Your escape to the hills is just one day away! Here is a quick summary
      of your upcoming stay at <strong>STUDIO NEXT</strong>.
    </p>

    <div style="background:#faf8f5;border:1px solid #e8e0d0;border-radius:8px;padding:24px;margin:0 0 24px;">
      ${detailRow('Booking Ref', data.bookingReference)}
      ${detailRow('Room', `${data.roomType} — Room ${data.roomNumber}`)}
      ${detailRow('Check-In', `${formatDate(data.checkIn)}`)}
      ${detailRow('Check-Out', `${formatDate(data.checkOut)}`)}
      ${detailRow('Duration', `${data.numberOfNights} night${data.numberOfNights !== 1 ? 's' : ''} · ${data.numberOfGuests} guest${data.numberOfGuests !== 1 ? 's' : ''}`)}
    </div>

    <!-- Arrival Info -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td width="50%" style="padding-right:12px;vertical-align:top;">
          <div style="background:#f0fff4;border:1px solid #c6f6d5;border-radius:8px;padding:20px;text-align:center;">
            <p style="font-family:Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#276749;margin:0 0 8px;">Check-In From</p>
            <p style="font-family:Georgia,serif;font-size:24px;color:#1e2f27;margin:0;font-weight:bold;">11:00 AM</p>
          </div>
        </td>
        <td width="50%" style="padding-left:12px;vertical-align:top;">
          <div style="background:#fff8ee;border:1px solid #feebc8;border-radius:8px;padding:20px;text-align:center;">
            <p style="font-family:Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#7a6030;margin:0 0 8px;">Check-Out By</p>
            <p style="font-family:Georgia,serif;font-size:24px;color:#1e2f27;margin:0;font-weight:bold;">10:00 AM</p>
          </div>
        </td>
      </tr>
    </table>

    ${specialReqHtml}

    <!-- What to bring -->
    <div style="border:1px solid #e8e0d0;border-radius:8px;padding:20px 24px;margin:16px 0;">
      <p style="font-family:Arial,sans-serif;font-size:13px;font-weight:bold;color:#1e2f27;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">
        Please bring for check-in:
      </p>
      <ul style="font-family:Arial,sans-serif;font-size:14px;color:#555;line-height:2;margin:0;padding:0 0 0 20px;">
        <li>This booking reference: <strong>${data.bookingReference}</strong></li>
        <li>A valid government-issued photo ID</li>
        <li>Original payment card (if paid by card)</li>
      </ul>
    </div>

    <!-- Directions blurb -->
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#888;line-height:1.7;margin:24px 0;">
      We are located in <strong>Panchgani - Mahabaleshwar Rd, Bhose, Maharashtra 412805.</strong>
      Our reception team is available 24/7 — call <strong>8928584198</strong> if you need directions.
    </p>

    <p style="text-align:center;">
      <a href="https://www.google.com/travel/search?ts=CAESCgoCCAMKAggDEAAaHBIaEhQKBwjqDxAEGAsSBwjqDxAEGAwYATICEAAqBwoFOgNJTlI&qs=CAEyFENnc0lzb3VJeGFpcG04X2tBUkFCOApCCRF6hSuR36_zo0IJEbcLnkEqlcsFQgkRluLAyM7nX3NaVjJUqgFREAEyHxABIhu4xWeKCe6MMb55wVV4GFRwIIoofLeifmqZM3YyLBACIihvbWthciBob3RlbCBwYW5jaGdhbmkgbWFoYWJhbGVzaHdhciByb2Fk&utm_campaign=sharing&utm_medium=link_btn&utm_source=htls"
         style="display:inline-block;background-color:#1e2f27;color:#ffffff;text-decoration:none;padding:14px 36px;font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;border-radius:2px;">
        Get Directions
      </a>
    </p>
  `;

  return buildEmailLayout(contentHtml, `Your STUDIO NEXT stay begins tomorrow — Room ${data.roomNumber} awaits!`);
}

export async function sendCheckInReminder(data: CheckInReminderData): Promise<EmailResult> {
  return sendEmail({
    to: data.guestEmail,
    subject: `See You Tomorrow! — ${data.bookingReference} | STUDIO NEXT`,
    html: buildCheckInReminderEmail(data),
  });
}
