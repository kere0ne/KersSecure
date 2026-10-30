# KersSecure — Script Control Plane

The KersSecure application is being upgraded from a static landing page to a server-rendered SaaS platform.

## Stack
- Next.js App Router + TypeScript
- PostgreSQL + Prisma data model
- Discord OAuth2 and signed HTTP-only sessions
- Private S3-compatible object storage (Cloudflare R2 supported)
- Upstash Redis rate limiting
- Render deployment blueprint

## Deployment requirement
GitHub Pages cannot host this product because API routes, OAuth callbacks, PostgreSQL access and private object storage require a Node.js server. GitHub is the source repository; deploy the application using the Render Blueprint in render.yaml.

## Local setup
1. Install Node.js 20+ and PostgreSQL 15+.
2. Copy .env.example to .env and fill the values.
3. Create a Discord application; add http://localhost:3000/api/auth/discord/callback as the OAuth redirect URI and enable identify + email scopes.
4. Set OWNER_DISCORD_ID to the owner's Discord user ID.
5. Create a private S3/R2 bucket and configure credentials. Never make the bucket public.
6. Run npm install, npx prisma generate, npx prisma db push, then npm run dev.

## Production
Create a Render Blueprint from render.yaml. Set APP_URL and DISCORD_REDIRECT_URI to the deployed HTTPS domain and register the same callback in Discord. Configure S3/R2 and Upstash Redis before exposing loader endpoints publicly.

## Data model
Prisma schema includes users, roles, projects, project memberships, scripts, immutable script versions, whitelist licenses, authentication logs, execution logs, subscriptions, audit logs and platform settings.

## Security notes
License keys must be HMAC-hashed at rest. Script storage must remain private. Rate limiting should be enabled in production. A client authorized to receive source can inspect it; no loader can guarantee that delivered code is impossible to extract.
