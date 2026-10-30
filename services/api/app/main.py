from datetime import datetime, timedelta, timezone
from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from .db import Base, engine, get_db
from .models import Account, AuditEvent, Device, License, Project, Script
from .security import hash_secret, new_license_key, require_service_token

app = FastAPI(title='KersSecure Core API', version='1.0.0')
Base.metadata.create_all(bind=engine)

class KeyCreate(BaseModel):
    project_id: str
    expires_in_days: int | None = Field(default=None, ge=1, le=3650)
    max_devices: int = Field(default=1, ge=1, le=20)
    discord_id: str | None = None
class KeyRedeem(BaseModel):
    key: str = Field(min_length=20, max_length=160)
    discord_id: str = Field(min_length=5, max_length=32)
    hwid: str = Field(min_length=8, max_length=256)
class KeyAction(BaseModel): status: str
class ScriptCreate(BaseModel):
    project_id: str
    name: str = Field(min_length=2, max_length=100)
    source: str = Field(min_length=1, max_length=2_000_000)
class ScriptToggle(BaseModel): enabled: bool
class BanInput(BaseModel): banned: bool

def audit(db: Session, actor: str, action: str, target: str | None = None, details: str | None = None):
    db.add(AuditEvent(actor=actor, action=action, target=target, details=details))

@app.get('/health')
def health():
    with engine.connect() as conn: conn.exec_driver_sql('SELECT 1')
    return {'ok': True, 'service': 'kerssecure-core'}

@app.post('/v1/keys', dependencies=[Depends(require_service_token)])
def create_key(body: KeyCreate, db: Session = Depends(get_db)):
    if not db.get(Project, body.project_id): raise HTTPException(404, 'Project not found')
    raw = new_license_key()
    expires = datetime.now(timezone.utc) + timedelta(days=body.expires_in_days) if body.expires_in_days else None
    row = License(project_id=body.project_id, key_hash=hash_secret(raw), key_prefix=raw[:12], expires_at=expires, max_devices=body.max_devices, discord_id=body.discord_id)
    db.add(row); db.flush(); audit(db, 'service', 'license.created', row.id); db.commit()
    return {'id': row.id, 'key': raw, 'prefix': row.key_prefix, 'expires_at': expires}

@app.post('/v1/keys/redeem')
def redeem_key(body: KeyRedeem, db: Session = Depends(get_db)):
    row = db.scalar(select(License).where(License.key_hash == hash_secret(body.key)))
    if not row or row.status != 'ACTIVE' or (row.expires_at and row.expires_at <= datetime.now(timezone.utc)): raise HTTPException(403, 'Key is invalid, inactive, or expired')
    if row.discord_id and row.discord_id != body.discord_id: raise HTTPException(403, 'Key is linked to another Discord account')
    fingerprint = hash_secret('hwid:' + body.hwid)
    device = db.scalar(select(Device).where(Device.license_id == row.id, Device.hwid_hash == fingerprint))
    if not device:
        count = len(db.scalars(select(Device).where(Device.license_id == row.id)).all())
        if count >= row.max_devices: raise HTTPException(403, 'Device limit reached')
        db.add(Device(license_id=row.id, hwid_hash=fingerprint))
    row.discord_id = body.discord_id; db.commit()
    return {'ok': True, 'license_id': row.id, 'project_id': row.project_id}

@app.get('/v1/keys/{key_id}', dependencies=[Depends(require_service_token)])
def key_info(key_id: str, db: Session = Depends(get_db)):
    row = db.get(License, key_id)
    if not row: raise HTTPException(404, 'Key not found')
    return {'id': row.id, 'prefix': row.key_prefix, 'status': row.status, 'expires_at': row.expires_at, 'discord_id': row.discord_id, 'max_devices': row.max_devices}

@app.patch('/v1/keys/{key_id}', dependencies=[Depends(require_service_token)])
def key_update(key_id: str, body: KeyAction, db: Session = Depends(get_db)):
    if body.status not in {'ACTIVE', 'SUSPENDED', 'REVOKED'}: raise HTTPException(400, 'Invalid status')
    row = db.get(License, key_id)
    if not row: raise HTTPException(404, 'Key not found')
    row.status = body.status; audit(db, 'service', 'license.status_changed', key_id, body.status); db.commit()
    return {'ok': True, 'status': row.status}

@app.post('/v1/keys/{key_id}/reset-hwid', dependencies=[Depends(require_service_token)])
def reset_hwid(key_id: str, db: Session = Depends(get_db)):
    row = db.get(License, key_id)
    if not row: raise HTTPException(404, 'Key not found')
    db.query(Device).filter(Device.license_id == key_id).delete(); audit(db, 'service', 'license.devices_reset', key_id); db.commit()
    return {'ok': True}

@app.post('/v1/scripts', dependencies=[Depends(require_service_token)])
def create_script(body: ScriptCreate, db: Session = Depends(get_db)):
    if not db.get(Project, body.project_id): raise HTTPException(404, 'Project not found')
    row = Script(project_id=body.project_id, name=body.name, source_blob=body.source); db.add(row); db.commit()
    return {'id': row.id, 'enabled': row.enabled}

@app.patch('/v1/scripts/{script_id}', dependencies=[Depends(require_service_token)])
def script_toggle(script_id: str, body: ScriptToggle, db: Session = Depends(get_db)):
    row = db.get(Script, script_id)
    if not row: raise HTTPException(404, 'Script not found')
    row.enabled = body.enabled; audit(db, 'service', 'script.toggled', script_id, str(body.enabled)); db.commit()
    return {'ok': True, 'enabled': row.enabled}

@app.get('/v1/scripts/{script_id}/loader')
def loader(script_id: str, key: str, hwid: str, db: Session = Depends(get_db)):
    script = db.get(Script, script_id)
    if not script or not script.enabled: raise HTTPException(404, 'Script unavailable')
    license = db.scalar(select(License).where(License.project_id == script.project_id, License.key_hash == hash_secret(key)))
    if not license or license.status != 'ACTIVE' or (license.expires_at and license.expires_at <= datetime.now(timezone.utc)): raise HTTPException(403, 'Not whitelisted')
    fingerprint = hash_secret('hwid:' + hwid)
    device = db.scalar(select(Device).where(Device.license_id == license.id, Device.hwid_hash == fingerprint))
    if not device: raise HTTPException(403, 'Device not registered; redeem the key first')
    return {'source': script.source_blob}

@app.post('/v1/accounts/{discord_id}/ban', dependencies=[Depends(require_service_token)])
def ban_account(discord_id: str, body: BanInput, db: Session = Depends(get_db)):
    row = db.scalar(select(Account).where(Account.discord_id == discord_id))
    if not row: raise HTTPException(404, 'Account not found')
    row.banned = body.banned; audit(db, 'service', 'account.ban_changed', discord_id, str(body.banned)); db.commit()
    return {'ok': True, 'banned': row.banned}
