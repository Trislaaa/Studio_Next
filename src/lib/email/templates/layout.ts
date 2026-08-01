/**
 * Shared HTML email layout for all STUDIO NEXT transactional emails.
 * Wraps content in a branded, mobile-responsive shell.
 */

const BRAND_GREEN = '#1e2f27';
const BRAND_GOLD = '#C9A66B';
const HOTEL_NAME = 'STUDIO NEXT';
const HOTEL_TAGLINE = 'Concept to creation';
const HOTEL_ADDRESS = 'Panchgani - Mahabaleshwar Rd, Bhose, Maharashtra 412805.';
const HOTEL_PHONE = '8928584198';
const HOTEL_EMAIL = 'Studio nexthotel2026@gmail.com';
const HOTEL_WEBSITE = process.env.NEXTAUTH_URL || 'https://Studio next-hotel1.vercel.app';

/**
 * Wraps any HTML content block in the standard STUDIO NEXT email shell.
 */
export function buildEmailLayout(contentHtml: string, previewText = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <title>${HOTEL_NAME}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    body { margin: 0; padding: 0; background-color: #f5f1eb; font-family: Georgia, 'Times New Roman', serif; }
    table { border-spacing: 0; }
    td { padding: 0; }
    img { border: 0; display: block; }
    .wrapper { width: 100%; background-color: #f5f1eb; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background-color: ${BRAND_GREEN}; padding: 32px 40px; text-align: center; }
    .hotel-name { color: ${BRAND_GOLD}; font-size: 26px; letter-spacing: 4px; text-transform: uppercase; margin: 0; font-family: Georgia, serif; }
    .hotel-tagline { color: rgba(201,166,107,0.6); font-size: 9px; letter-spacing: 4px; text-transform: uppercase; margin: 8px 0 0; font-family: Arial, sans-serif; }
    .content { background-color: #ffffff; padding: 40px; }
    .gold-divider { height: 2px; background: linear-gradient(to right, transparent, ${BRAND_GOLD}, transparent); margin: 28px 0; border: none; }
    .booking-card { background-color: #faf8f5; border: 1px solid #e8e0d0; border-radius: 8px; padding: 24px; margin: 24px 0; }
    .booking-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #e8e0d0; font-family: Arial, sans-serif; font-size: 14px; }
    .booking-row:last-child { border-bottom: none; }
    .label { color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
    .value { color: ${BRAND_GREEN}; font-weight: bold; }
    .btn { display: inline-block; background-color: ${BRAND_GREEN}; color: #ffffff !important; text-decoration: none; padding: 14px 36px; font-family: Arial, sans-serif; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; font-weight: bold; border-radius: 2px; margin: 24px 0; }
    .footer { background-color: ${BRAND_GREEN}; padding: 32px 40px; text-align: center; }
    .footer p { color: rgba(255,255,255,0.5); font-size: 12px; font-family: Arial, sans-serif; margin: 6px 0; line-height: 1.6; }
    .footer a { color: ${BRAND_GOLD}; text-decoration: none; }
    @media screen and (max-width: 600px) {
      .content { padding: 24px 20px !important; }
      .header { padding: 24px 20px !important; }
      .booking-row { flex-direction: column; gap: 4px; }
    }
  </style>
</head>
<body>
  ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;">${previewText}&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>` : ''}
  <div class="wrapper">
    <div class="container">
      <!-- Header -->
      <div class="header">
        <p class="hotel-name">${HOTEL_NAME}</p>
        <p class="hotel-tagline">${HOTEL_TAGLINE}</p>
      </div>
      <!-- Content -->
      <div class="content">
        ${contentHtml}
      </div>
      <!-- Footer -->
      <div class="footer">
        <p>${HOTEL_ADDRESS}</p>
        <p>
          <a href="tel:${HOTEL_PHONE}">${HOTEL_PHONE}</a> &nbsp;·&nbsp;
          <a href="mailto:${HOTEL_EMAIL}">${HOTEL_EMAIL}</a>
        </p>
        <p style="margin-top:16px;">
          <a href="${HOTEL_WEBSITE}/book">Book Again</a> &nbsp;·&nbsp;
          <a href="${HOTEL_WEBSITE}">Visit Website</a>
        </p>
        <p style="margin-top:20px;font-size:10px;color:rgba(255,255,255,0.3);">
          © ${new Date().getFullYear()} ${HOTEL_NAME}. All rights reserved.<br/>
          This is a transactional email related to your booking.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/** Formats a date as "Mon, 04 Apr 2026" */
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

/** Formats a number as INR */
export function formatInr(amount: number | string): string {
  return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/** Renders one row of the booking details card */
export function detailRow(label: string, value: string): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0;border-bottom:1px dashed #e8e0d0;">
    <tr>
      <td style="font-family:Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888;padding:8px 0;">${label}</td>
      <td style="font-family:Arial,sans-serif;font-size:14px;color:#1e2f27;font-weight:bold;padding:8px 0;text-align:right;">${value}</td>
    </tr>
  </table>`;
}
