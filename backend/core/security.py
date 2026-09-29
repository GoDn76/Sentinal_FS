from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Union
import hashlib
import bcrypt
import jwt
from backend.core.config import settings

def _hash_password_bytes(password: str) -> bytes:
    # Hash password with SHA-256 first to ensure it's fixed length (64 hex chars = 64 bytes)
    digest = hashlib.sha256(password.encode('utf-8')).hexdigest().encode('utf-8')
    return digest

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        pw_bytes = _hash_password_bytes(plain_password)
        return bcrypt.checkpw(pw_bytes, hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    pw_bytes = _hash_password_bytes(password)
    salt = bcrypt.gensalt(12)
    hashed = bcrypt.hashpw(pw_bytes, salt)
    return hashed.decode('utf-8')

def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None
