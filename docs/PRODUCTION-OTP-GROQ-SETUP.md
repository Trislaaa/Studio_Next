# Production setup — OTP delivery and GROQ chat

This document lists the minimal steps to enable production OTP email delivery (Resend) and configure GROQ for chat generation.

## Required environment variables
Set these in your production host (Vercel, Fly, Render, etc.)

- `CHAT_PROVIDER=groq`
- `GROQ_API_KEY` = your Groq API key
- `GROQ_BASE_URL` = (optional) override; default: `https://api.groq.com/openai/v1`

- `CHAT_OTP_DELIVERY_MODE=resend`
- `RESEND_API_KEY` = your Resend API key
- `OTP_FROM_EMAIL` = a verified sender email (e.g., `no-reply@yourdomain.com`)
- `CHAT_INCLUDE_DEBUG_OTP=false`

- `EMBEDDING_PROVIDER=none` (recommended if you do not want embeddings yet)

Other helpful variables (already in `.env.example`): `OTP_EXPIRY_MINUTES`, `OTP_MAX_ATTEMPTS`, `CHAT_RATE_LIMIT_PER_MINUTE`.

## Steps: Resend setup
1. Create a Resend account (https://resend.com) and add a verified sender email or domain.
2. Create an API key and copy it to `RESEND_API_KEY` in your production environment.
3. Set `OTP_FROM_EMAIL` to the verified sender.
4. Set `CHAT_OTP_DELIVERY_MODE=resend` and `CHAT_INCLUDE_DEBUG_OTP=false`.

## Steps: GROQ setup
1. Create a Groq account and obtain a service API key.
2. Set `GROQ_API_KEY` in production and redeploy.
3. Optionally set `GROQ_BASE_URL` if your provider requires a different endpoint.

## Redeploy
After updating environment variables, redeploy your site so the build/runtime picks them up.

## Quick tests (use staging / preview environment first)

1) Create a chat session and store cookies locally:

```bash
# create session and save cookie jar
curl -c cookies.txt -X POST https://your-domain.example/api/chat/session
```

Response will include a `session.sessionToken` and the response will set a `chat_session_token` cookie (saved in `cookies.txt`).

2) Send OTP (replace bookingReference and contact with a real booking in your DB):

```bash
curl -b cookies.txt -X POST https://your-domain.example/api/chat/verify-otp/send \
  -H 'Content-Type: application/json' \
  -d '{"bookingReference":"ABC123","contact":"guest@example.com"}'
```

- Expected: `success: true` and `channel: "email"` when Resend is configured properly.
- If you receive `Unable to deliver OTP right now`, check your `RESEND_API_KEY`, `OTP_FROM_EMAIL` and Resend logs.

3) Verify OTP (use the code you receive):

```bash
curl -b cookies.txt -X POST https://your-domain.example/api/chat/verify-otp/check \
  -H 'Content-Type: application/json' \
  -d '{"bookingReference":"ABC123","otp":"123456"}'
```

- Expected: `{ ok: true }`

4) Send a quick chat message to confirm GROQ replies (requires a valid session cookie):

```bash
curl -b cookies.txt -X POST https://your-domain.example/api/chat/message \
  -H 'Content-Type: application/json' \
  -d '{"message":"Hello, what are your check-in times?"}'
```

- Expected: assistant reply in JSON when `GROQ_API_KEY` is valid and chat provider is `groq`.

## Troubleshooting
- OTP not sending: check Resend dashboard for delivery logs and error messages. Ensure `OTP_FROM_EMAIL` is verified.
- GROQ errors: check your GROQ key and base URL. Watch server logs for error messages returned by the Groq/OpenAI client.
- Debug OTP locally: `CHAT_OTP_DELIVERY_MODE=console` or `NODE_ENV!=production` prints OTPs to server logs and returns `debugOtp` in responses (for testing only).

## Security notes
- Store secrets only in your host's secret manager (Vercel Environment variables), never commit them to Git.
- Rotate keys if accidentally exposed.
- Limit Resend keys to minimal privileges.

## Optional: add automated health checks
- Consider creating a simple endpoint and a scheduled job to assert `GROQ_API_KEY` valid and `RESEND_API_KEY` can send a test message to a safe test address.
