KersSecure services

This repository separates the persistent Discord bot, PostgreSQL-backed core API, and Python Lua obfuscation service from the Next.js website.

- api: authenticated service API and PostgreSQL models for accounts, projects, scripts, licenses, devices and audit events.
- obfuscator: Lua parser-validated build service. It fails builds when parsing or output validation fails; it does not pretend to offer VM protection.
- discord-bot: persistent discord.py application using the same API for key generation, lookup, revocation and HWID reset.
- engine-csharp: standalone .NET 8 Lua parser/validator and syntax-preserving minifier.

The web app's existing Cloudflare D1 data layer is not yet migrated to this PostgreSQL service. Do not enable cross-service production writes until the web app and API use the same database and authentication model.
