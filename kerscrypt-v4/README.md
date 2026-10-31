# KersCrypt v4 website overlay

This directory contains the KersCrypt web UI overlay for the open-source [Prometheus Lua obfuscator](https://github.com/prometheus-lua/Prometheus), pinned to upstream commit `0d3e287c2fd9ef927e210268ea0a8bb1e7a4d581`.

To build, clone the upstream Prometheus repository at that commit, extract `ui-patch.tar.gz` into the repository root, then run `cd web && npm install && npm run build`. This replaces only the website UI, Vite config, and a Wasmoon Node test-path fix, leaving the underlying Prometheus obfuscation engine intact.

Browser source code stays local. The original Prometheus license and acknowledgements remain applicable. The generated site can be deployed from `web/dist`.

SHA-256 patch: `24e67f6ec67948706bfc7a5bae6ff9cf1d3425ebffaafe1d92c09db0e748bbea`.
