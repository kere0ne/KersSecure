import os
from flask import Flask, jsonify, render_template_string

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY", "replace-this-secret-before-production")

HTML = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KersSecure</title><style>
:root{color-scheme:dark;--bg:#08090c;--panel:#12151c;--line:#282d37;--muted:#9aa3b2;--accent:#e8c547}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 50% -20%,#28251a,transparent 48%),var(--bg);color:#f6f7f9;font:15px/1.6 system-ui,sans-serif}nav{height:76px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 6vw}.brand{font-weight:900;letter-spacing:.13em}.brand span,h1 span{color:var(--accent)}main{max-width:1100px;margin:90px auto;padding:0 24px}.eyebrow{color:var(--accent);font-size:11px;letter-spacing:.2em;font-weight:800}h1{font-size:clamp(44px,7vw,78px);line-height:1.02;letter-spacing:-.055em;margin:20px 0}p{color:var(--muted);max-width:650px}.actions{display:flex;gap:12px;flex-wrap:wrap;margin:30px 0 58px}.btn{display:inline-block;padding:12px 18px;border:1px solid var(--line);border-radius:9px;color:#fff;text-decoration:none;font-weight:700}.primary{background:var(--accent);color:#111;border-color:var(--accent)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.card{background:linear-gradient(145deg,#171b24,#0e1116);border:1px solid var(--line);border-radius:14px;padding:22px}.card h3{margin:0 0 8px}.card p{font-size:13px;margin:0}.status{color:#a7e2b5;font-size:12px}footer{margin-top:80px;border-top:1px solid var(--line);padding:24px 6vw;color:#737d8c;font-size:12px}</style></head><body><nav><div class="brand">KERS<span>SECURE</span></div><div class="status">● Service online</div></nav><main><div class="eyebrow">SCRIPT CONTROL PLANE · PRIVATE BY DESIGN</div><h1>Your scripts.<br><span>Your rules.</span></h1><p>KersSecure is the foundation for private Lua/Luau hosting, license management, controlled script delivery, and authorization auditing.</p><div class="actions"><a class="btn primary" href="/health">Service health →</a><a class="btn" href="https://github.com/kere0ne/KersSecure">Source repository</a></div><section class="grid"><div class="card"><h3>Private script hosting</h3><p>Versioned script delivery will use private storage. Configure storage before accepting production uploads.</p></div><div class="card"><h3>License control</h3><p>Server-side whitelist and device authorization are planned; no client-side bypass switch is used.</p></div><div class="card"><h3>Audit visibility</h3><p>Authentication and authorization events require the database and identity provider to be configured.</p></div></section></main><footer>Deployment preview. Do not use for production script delivery until authentication, storage, and database configuration are complete.</footer></body></html>"""

@app.get("/")
def home():
    return render_template_string(HTML)

@app.get("/health")
def health():
    return jsonify(status="ok", service="kerssecure", hosting="pythonanywhere")

@app.get("/api/me")
def me():
    return jsonify(authenticated=False, message="Discord OAuth is not configured yet"), 503

if __name__ == "__main__":
    app.run()
