/**
 * Resend email client for STUDIO NEXT
 *
 * Works with a custom domain once it is verified in Resend.
 *
 * To upgrade to a custom domain later:
 *   1. Add your domain in Resend dashboard → Domains
 *   2. Update EMAIL_FROM in .env to e.g. support@Studio nexthotel.com
 *   That's it — no code changes needed.
 */

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Send an email via Resend API.
 * Falls back to console logging in development if RESEND_API_KEY is missing.
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  // ── Development / no-key fallback ──────────────────────────────────────────
  if (!apiKey) {
    console.log('[Email] No RESEND_API_KEY — email would have been sent:');
    console.log(`  To:      ${Array.isArray(payload.to) ? payload.to.join(', ') : payload.to}`);
    console.log(`  Subject: ${payload.subject}`);
    return { success: true, id: 'dev-console' };
  }

  // ── From address: custom domain (preferred) ───────────────────────────────
  // Set EMAIL_FROM in .env to override the default sender address.
  const from =
    process.env.EMAIL_FROM || 'STUDIO NEXT <support@Studio nexthotel.com>';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(payload.to) ? payload.to : [payload.to],
        subject: payload.subject,
        html: payload.html,
        ...(payload.replyTo && { reply_to: payload.replyTo }),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[Email] Resend API error:', response.status, body);
      return { success: false, error: `Resend error ${response.status}: ${body}` };
    }

    const data = await response.json() as { id: string };
    return { success: true, id: data.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Email] Network error:', message);
    return { success: false, error: message };
  }
}
