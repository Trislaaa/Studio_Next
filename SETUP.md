# Project Setup

## Environment Variables

Set the following environment variables in your `.env` (or Vercel project settings):

- DATABASE_URL – PostgreSQL connection string
- PUSHER_APP_ID – Pusher app id (server)
- PUSHER_KEY – Pusher key (server)
- PUSHER_SECRET – Pusher secret (server)
- PUSHER_CLUSTER – Pusher cluster, e.g. `ap2`
- NEXT_PUBLIC_PUSHER_KEY – Same as `PUSHER_KEY` but exposed to client
- NEXT_PUBLIC_PUSHER_CLUSTER – Same cluster, exposed to client

Cloudinary (required for room/gallery image upload):

- Either set `CLOUDINARY_URL`
- Or set all three:
	- `CLOUDINARY_CLOUD_NAME`
	- `CLOUDINARY_API_KEY`
	- `CLOUDINARY_API_SECRET`

If uploads fail with a Cloudinary configuration error:

- Local: verify values in `.env.local` and restart the Next.js dev server.
- Vercel: add variables in Project Settings -> Environment Variables and redeploy.

## Prisma

Run migrations and generate Prisma client:

```bash
npx prisma migrate dev
npx prisma generate
```

## Realtime (optional)

To enable realtime availability updates:

1. Create a Pusher app and copy credentials.
2. Set the env vars listed above.
3. Deploy with these variables configured.
yrtutvgbh nmcyvgkjh nmrcygvhjb nruytvgkhj n