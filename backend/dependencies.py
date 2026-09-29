import os
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from backend.core.config import settings
from backend.core.security import decode_access_token

security = HTTPBearer(auto_error=False)

def create_scope_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=24))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.ALGORITHM)

async def get_current_user_claims(
    credentials: HTTPAuthorizationCredentials | None = Depends(security)
) -> dict:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "MISSING_TOKEN", "detail": "Authentication required"},
        )
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "INVALID_TOKEN", "detail": "Could not validate credentials"},
        )
    return payload

async def get_case_upload_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(security)
) -> dict:
    payload = await get_current_user_claims(credentials)
    if payload.get("scope") and payload.get("scope") not in {"case_upload", "device_paired"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "INSUFFICIENT_SCOPE", "detail": "Token scope must allow evidence upload"},
        )
    return payload
