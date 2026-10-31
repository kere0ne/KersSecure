# LW Obfuscator — Prometheus-powered Lua & Luau protection

This update rebrands the KersCrypt website as **LW Obfuscator** and adds an optional **Anti-tamper (Beta)** switch to the coding studio. Prometheus remains the underlying engine, pinned to upstream commit `0d3e287c2fd9ef927e210268ea0a8bb1e7a4d581`.

## Integration

The supplied `antiTamperPromFork-original.lua.txt` is retained unchanged for reference. It cannot be used verbatim with Lua 5.1/Roblox Luau because it uses Lua 5.3-only bitwise `~`, unavailable debug functions, and global metatable modifications likely to break normal scripts. The site therefore uses `web/src/antiTamper.ts`, a compatible subset that validates selected runtime functions and a randomized per-build sentinel. The guard wraps Prometheus's final output, instead of being transformed by Strong (which failed integration tests).

**This is not cryptographic integrity verification of the complete source code.** It is an experimental tripwire, not a guarantee against reverse-engineering or tampering. The toggle is enabled by default but can be switched off.

## Rebuild

1. Clone `https://github.com/prometheus-lua/Prometheus` at commit `0d3e287c2fd9ef927e210268ea0a8bb1e7a4d581`.
2. Extract `ui-patch.tar.gz` over its root.
3. Run `cd web && npm install && npm test && npm run build`.
4. Deploy the generated `web/dist` directory.

SHA-256 of the patch archive:
`f2132ba36f8fe45cc921765ad8b9e08b6fa3c4f1b1031dbffa6fd0c2197d1fab`.

The Prometheus source retains its upstream license. All obfuscation remains in the browser. 
