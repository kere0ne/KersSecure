# LW Obfuscator

Rebranded Prometheus-powered Lua/Luau obfuscator with optional experimental anti-tamper guard. Overlay includes the UI, Vite base configuration and browser worker compatibility patch. It does not execute the uploaded anti-tamper script directly because its bitwise syntax and invasive global changes are incompatible with standard Lua 5.1/Luau. The original upload is included separately in the downloadable project archive.

Extract this overlay into upstream Prometheus commit `0d3e287c2fd9ef927e210268ea0a8bb1e7a4d581`, then `cd web && npm install && npm run build`. Retain upstream licensing.

SHA-256: `2f34af521c37d99f6b71d00dc3f660d7edbc67e3783fcb1074633192d005d59f`.
