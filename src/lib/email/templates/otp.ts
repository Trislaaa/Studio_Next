import { buildEmailLayout } from './layout';
import { sendEmail, EmailResult } from '../client';

export interface OtpEmailData {
    guestName: string;
    guestEmail: string;
    otp: string;
    expiresInMinutes?: number;
}

export function buildOtpEmail(data: OtpEmailData): string {
    const expiresIn = data.expiresInMinutes ?? 10;
    const digits = data.otp.split('');

    const digitBoxes = digits
        .map(
            (d) =>
                `<td style="padding:0 4px;"><span style="display:inline-block;width:42px;height:54px;line-height:54px;text-align:center;background:#1e2f27;color:#C9A66B;font-size:26px;font-weight:bold;font-family:Courier New,monospace;border-radius:6px;letter-spacing:0;">${d}</span></td>`
        )
        .join('');

    const contentHtml = `
    <h1 style="font-family:Georgia,serif;font-size:26px;color:#1e2f27;margin:0 0 6px;">
      Verify Your Email
    </h1>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#888;margin:0 0 24px;">
      One-Time Password for your booking
    </p>

    <p style="font-family:Arial,sans-serif;font-size:15px;color:#444;line-height:1.7;margin:0 0 28px;">
      Dear <strong>${data.guestName}</strong>,<br/>
      Use the code below to verify your email address and proceed with your booking at <strong>STUDIO NEXT</strong>.
    </p>

    <!-- OTP Box -->
    <div style="text-align:center;margin:32px 0;">
      <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr>${digitBoxes}</tr>
      </table>
      <p style="font-family:Arial,sans-serif;font-size:12px;color:#999;margin:14px 0 0;letter-spacing:1px;">
        VALID FOR ${expiresIn} MINUTES · DO NOT SHARE
      </p>
    </div>

    <hr style="height:1px;background:#e8e0d0;border:none;margin:28px 0;"/>

    <div style="background:#fff8ee;border-left:3px solid #C9A66B;padding:16px 20px;border-radius:0 4px 4px 0;">
      <p style="font-family:Arial,sans-serif;font-size:13px;color:#7a6030;margin:0;line-height:1.6;">
        <strong>⚠️ Security Notice:</strong> Never share this code with anyone.
        STUDIO NEXT staff will never ask for your OTP. If you did not request this,
        you can safely ignore this email.
      </p>
    </div>

    <p style="font-family:Arial,sans-serif;font-size:13px;color:#999;line-height:1.6;margin:24px 0 0;text-align:center;">
      This code expires in <strong>${expiresIn} minutes</strong>.<br/>
      Having trouble? Call us at <strong>8928584198</strong>
    </p>
  `;

    return buildEmailLayout(
        contentHtml,
        `Your STUDIO NEXT verification code: ${data.otp} (expires in ${expiresIn} min)`
    );
}

export async function sendOtpEmail(data: OtpEmailData): Promise<EmailResult> {
    return sendEmail({
        to: data.guestEmail,
        subject: `${data.otp} — Verify your email for STUDIO NEXT booking`,
        html: buildOtpEmail(data),
    });
}
