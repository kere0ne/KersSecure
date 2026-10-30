# Kers Secure — Script Control Plane

Kers Secure is a Next.js application for private Lua/Luau script hosting, project management and license validation.

## Stack
- Next.js App Router + TypeScript
- Prisma database
- Private owner API-key authentication with signed HTTP-only sessions
- Private S3-compatible object storage (Cloudflare R2 supported)
- Cloudflare Workers deployment via OpenNext

## Owner sign-in
The dashboard uses **one private owner API key**. Discord OAuth and public account registration are not used.

1. Generate a high-entropy key (use the owner key provided for this deployment, or generate a new 64-byte random hex value).
2. Add it as the Cloudflare Worker secret named `OWNER_API_KEY`.
3. Set `SESSION_SECRET` to a separate random value of at least 32 characters.
4. Set `DATABASE_URL` and the required storage and license secrets.
5. Open `/login` and paste the owner key. The server validates it and issues a signed, HTTP-only session cookie.

Never put `OWNER_API_KEY` in source code, a `.env.example` file, client-side JavaScript, or a GitHub commit. If it is exposed, rotate it immediately.

## Local setup
1. Install Node.js 20+.
2. Copy `.env.example` to `.env` and configure the required variables.
3. Run `npm install`, `npx prisma generate`, `npx prisma db push`, then `npm run dev`.

## Cloudflare deployment
GitHub is the source repository; Cloudflare Workers hosts the application. Configure runtime secrets in the Worker dashboard and GitHub Actions deployment credentials in repository Actions secrets. Runtime secrets and GitHub Actions secrets are separate stores.

## Required runtime secrets
- `OWNER_API_KEY`
- `SESSION_SECRET`
- `LICENSE_HASH_SECRET`
- `DATABASE_URL`
- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_REGION`

## Security
The owner key is compared server-side using a SHA-256 digest comparison and is never returned to the browser. Script storage must remain private. Enable Cloudflare rate limiting on `/api/auth/key`. Rotate any key that has been shared or exposed. A client authorized to receive source can inspect it; no loader can guarantee that delivered code is impossible to extract.
