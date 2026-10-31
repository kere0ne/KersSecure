# LW Obfuscator website

The LW Obfuscator redesign uses the open-source [Prometheus Lua Obfuscator](https://github.com/prometheus-lua/Prometheus), pinned to upstream commit `0d3e287c2fd9ef927e210268ea0a8bb1e7a4d581`.

This overlay updates branding and adds an optional **LW Anti-Tamper (experimental)** toggle. Its compatible guard checks selected global function references at startup. This is not cryptographic integrity protection. The uploaded anti-tamper source is not executed directly because it uses incompatible syntax and invasive global/metatable changes. The original upload is available separately in the project download archive.

To build, clone Prometheus at the pinned commit, extract `ui-overlay.tar.gz` into its root, then run `cd web && npm install && npm run build`. The Prometheus engine and licensing are preserved.

Overlay SHA-256: `1af2c43fb10b1f27694edff2fafb3ebfa0a2d2826f1c18ba13963e4f910e549f`.
