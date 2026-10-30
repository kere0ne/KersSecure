# Kers Secure

Kers Secure is a multi-service Lua/Luau script management and licensing platform. The repository contains the Next.js website, a PostgreSQL-backed service API, a Python Lua build service, a persistent Discord bot, and a standalone C# Lua validation/minification CLI.

## Current implementation status

- Website: existing Next.js dashboard, project/script upload and license management screens.
- Web authentication: Discord OAuth2 callback with state cookie and signed HTTP-only session. Configure OWNER_DISCORD_ID to assign the owner role.
- Core API: FastAPI service with PostgreSQL models and authenticated internal key/script endpoints.
- Python obfuscator: Lua parser-backed validation, source transformations and output re-validation. Luau syntax is not supported by the current luaparser dependency.
- Discord bot: persistent discord.py service currently implements /generate, /keyinfo, /revoke and /reset-hwid.
- C# engine: standalone .NET 8 CLI using MoonSharp parser validation and syntax-preserving minification. It is not a VM obfuscator.

The Python API currently has its own PostgreSQL schema and is not yet wired to the web application's Cloudflare D1 database. Do not assume website and bot data are synchronized in production until the database migration and integration phase is complete.

## Local services

1. Install Docker and Docker Compose.
2. Copy services/api/.env.example to services/api/.env and services/discord-bot/.env.example to services/discord-bot/.env.
3. Set a strong POSTGRES_PASSWORD in your environment and set the same credentials in services/api/.env.
4. Start the services with docker compose up --build.
5. API health: http://localhost:8000/health
6. Obfuscator health: http://localhost:8100/health

## Website environment

Copy .env.example to .env. Set DATABASE_URL, SESSION_SECRET, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI, OWNER_DISCORD_ID, LICENSE_HASH_SECRET and private R2/S3 credentials. The Discord redirect URI must exactly match the URL registered in the Discord Developer Portal.

## Security notes

Never commit secrets. Keep Discord bot tokens, internal service tokens, database credentials and storage credentials server-side. The current internal API token is a service-to-service credential, not a user login key. Configure rate limiting, audit retention, backups and TLS before public production use.
