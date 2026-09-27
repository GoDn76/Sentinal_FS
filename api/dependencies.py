import os
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import passlib.context

JWT_SECRET = os.getenv("SENTINELFS_JWT_SECRET", "sentinelfs_dev_jwt_secret_key_change_in_prod")
JWT_ALGORITHM = "HS256"

pwd_context = passlib.context.CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=24))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "TOKEN_EXPIRED", "detail": "Token has expired"},
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "INVALID_TOKEN", "detail": "Could not validate credentials"},
        )

async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security)
) -> dict:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "MISSING_TOKEN", "detail": "Authentication required"},
        )
    return decode_token(credentials.credentials)

async def get_case_upload_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(security)
) -> dict:
    payload = await get_current_user(credentials)
    if payload.get("scope") != "case_upload":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "INSUFFICIENT_SCOPE", "detail": "Token scope must be case_upload"},
        )
    return payload
