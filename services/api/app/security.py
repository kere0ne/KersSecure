import hashlib, hmac, secrets
from fastapi import Header, HTTPException
from .config import settings

def hash_secret(value: str) -> str:
    return hmac.new(settings.license_hash_secret.encode(), value.encode(), hashlib.sha256).hexdigest()

def new_license_key() -> str: return 'KERS-' + secrets.token_urlsafe(32)

def require_service_token(x_service_token: str = Header(default='')):
    expected = settings.service_api_token
    if not expected or not hmac.compare_digest(hashlib.sha256(x_service_token.encode()).digest(), hashlib.sha256(expected.encode()).digest()):
        raise HTTPException(status_code=401, detail='Invalid service credentials')
    return True
