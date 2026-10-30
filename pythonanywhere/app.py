import hashlib, os, secrets
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path

from authlib.integrations.flask_client import OAuth
from dotenv import load_dotenv
from flask import Flask, abort, flash, redirect, render_template, request, session, url_for
from flask_sqlalchemy import SQLAlchemy
from werkzeug.utils import secure_filename

BASE = Path(__file__).resolve().parent
load_dotenv(BASE / ".env")
app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY") or secrets.token_hex(32)
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///kerssecure.sqlite3")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["MAX_CONTENT_LENGTH"] = int(os.getenv("MAX_UPLOAD_BYTES", "1048576"))
app.config["UPLOAD_FOLDER"] = str(BASE / "private_scripts")
Path(app.config["UPLOAD_FOLDER"]).mkdir(exist_ok=True)
db = SQLAlchemy(app)
oauth = OAuth(app)
if os.getenv("DISCORD_CLIENT_ID") and os.getenv("DISCORD_CLIENT_SECRET"):
    oauth.register(name="discord", client_id=os.getenv("DISCORD_CLIENT_ID"),
        client_secret=os.getenv("DISCORD_CLIENT_SECRET"),
        access_token_url="https://discord.com/api/oauth2/token",
        authorize_url="https://discord.com/api/oauth2/authorize",
        api_base_url="https://discord.com/api/",
        client_kwargs={"scope": "identify"})

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    discord_id = db.Column(db.String(32), unique=True, nullable=False)
    username = db.Column(db.String(100), nullable=False)
    is_owner = db.Column(db.Boolean, default=False, nullable=False)

class Script(db.Model):
    id = db.Column(db.String(24), primary_key=True, default=lambda: secrets.token_urlsafe(12))
    name = db.Column(db.String(100), nullable=False)
    filename = db.Column(db.String(180), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

class License(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    key_hash = db.Column(db.String(64), unique=True, nullable=False)
    key_prefix = db.Column(db.String(12), nullable=False)
    script_id = db.Column(db.String(24), db.ForeignKey("script.id"), nullable=False)
    label = db.Column(db.String(100), default="Customer")
    active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()

def signed_in(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        if not session.get("user_id"):
            return redirect(url_for("home"))
        return fn(*args, **kwargs)
    return wrapped

@app.get("/")
def home():
    user = db.session.get(User, session.get("user_id")) if session.get("user_id") else None
    return render_template("home.html", user=user, configured=oauth.create_client("discord") is not None)

@app.get("/auth/discord")
def discord_login():
    client = oauth.create_client("discord")
    if client is None:
        flash("Discord OAuth is not configured yet. Add the credentials in your .env file.")
        return redirect(url_for("home"))
    return client.authorize_redirect(os.getenv("DISCORD_REDIRECT_URI") or url_for("discord_callback", _external=True))

@app.get("/auth/discord/callback")
def discord_callback():
    client = oauth.create_client("discord")
    if client is None:
        abort(503)
    token = client.authorize_access_token()
    profile = client.get("users/@me", token=token).json()
    discord_id = str(profile["id"])
    user = User.query.filter_by(discord_id=discord_id).first()
    if user is None:
        user = User(discord_id=discord_id, username=profile.get("global_name") or profile["username"])
        db.session.add(user)
    user.username = profile.get("global_name") or profile["username"]
    user.is_owner = discord_id == os.getenv("OWNER_DISCORD_ID")
    db.session.commit()
    session.clear()
    session["user_id"] = user.id
    return redirect(url_for("dashboard"))

@app.post("/logout")
def logout():
    session.clear()
    return redirect(url_for("home"))

@app.get("/dashboard")
@signed_in
def dashboard():
    user = db.session.get(User, session["user_id"])
    scripts = Script.query.filter_by(owner_id=user.id).order_by(Script.created_at.desc()).all()
    return render_template("dashboard.html", user=user, scripts=scripts)

@app.post("/scripts")
@signed_in
def upload_script():
    user = db.session.get(User, session["user_id"])
    uploaded = request.files.get("script")
    name = (request.form.get("name") or "").strip()[:100]
    if not uploaded or not uploaded.filename or not name:
        flash("Choose a script file and enter a name.")
        return redirect(url_for("dashboard"))
    filename = secure_filename(uploaded.filename)
    if not filename.lower().endswith((".lua", ".luau", ".txt")):
        flash("Only .lua, .luau and .txt files are accepted.")
        return redirect(url_for("dashboard"))
    script = Script(name=name, filename=filename, owner_id=user.id)
    db.session.add(script)
    db.session.flush()
    stored = Path(app.config["UPLOAD_FOLDER"]) / (script.id + ".blob")
    uploaded.save(stored)
    db.session.commit()
    flash("Script uploaded privately.")
    return redirect(url_for("dashboard"))

@app.post("/scripts/<script_id>/licenses")
@signed_in
def create_license(script_id):
    user = db.session.get(User, session["user_id"])
    script = Script.query.filter_by(id=script_id, owner_id=user.id).first_or_404()
    raw = "KERS-" + secrets.token_urlsafe(24)
    db.session.add(License(key_hash=digest(raw), key_prefix=raw[:12], script_id=script.id))
    db.session.commit()
    session["new_license_key"] = raw
    flash("New license created. Copy it now; it is only shown once.")
    return redirect(url_for("dashboard"))

@app.get("/loader/<script_id>")
def loader(script_id):
    key = request.args.get("key", "")
    license = License.query.filter_by(script_id=script_id, key_hash=digest(key), active=True).first()
    if not license:
        abort(403)
    path = Path(app.config["UPLOAD_FOLDER"]) / (script_id + ".blob")
    if not path.is_file():
        abort(404)
    return app.response_class(path.read_text(encoding="utf-8"), mimetype="text/plain")

@app.get("/health")
def health():
    return {"status": "ok", "service": "KersSecure"}

with app.app_context():
    db.create_all()

if __name__ == "__main__":
    app.run(debug=True)
