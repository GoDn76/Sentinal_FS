import os
import json
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import redis.asyncio as aioredis

from backend.database.connection import get_db
from backend.database.models import User
from backend.dependencies import get_current_user_claims, create_scope_access_token
from backend.core.config import settings

router = APIRouter(prefix="/claim", tags=["claim"])

# In-memory rate limiting for polling status endpoint: 120 req/min per IP
ip_rate_limit: dict[str, list[float]] = defaultdict(list)

def check_rate_limit(request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    now = datetime.now().timestamp()
    timestamps = [t for t in ip_rate_limit[client_ip] if now - t < 60]
    if len(timestamps) >= 120:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error": "RATE_LIMIT_EXCEEDED", "detail": "Maximum 120 requests per minute"},
        )
    timestamps.append(now)
    ip_rate_limit[client_ip] = timestamps

class RegisterClaimRequest(BaseModel):
    token: str
    device_info: str | None = "local-agent"

class ClaimStatusResponse(BaseModel):
    status: str  # pending | claimed | not_found | expired
    claimed_by: str | None = None
    platform_jwt: str | None = None
    device_info: str | None = None

class RedeemResponse(BaseModel):
    message: str

@router.post("/register", status_code=200)
async def register_claim_token(req: RegisterClaimRequest):
    """
    Registers a claim token ephemerally in Redis with a 900-second (15 min) TTL.
    Only authenticates the device (decoupled from Case creation).
    """
    redis = aioredis.from_url(settings.REDIS_URL, protocol=2)
    try:
        key = f"claim:{req.token}"
        data = {
            "status": "pending",
            "device_info": req.device_info or "local-agent",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await redis.set(key, json.dumps(data), ex=900)
        return {"registered": True, "token": req.token, "ttl": 900}
    finally:
        await redis.aclose()

@router.get("/{token}/status", response_model=ClaimStatusResponse)
async def get_claim_status(token: str, request: Request):
    """
    Polls the ephemeral claim token status from Redis.
    If key does not exist or expired, returns 404.
    """
    check_rate_limit(request)

    redis = aioredis.from_url(settings.REDIS_URL, protocol=2)
    try:
        val = await redis.get(f"claim:{token}")
        if not val:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "TOKEN_NOT_FOUND", "detail": "Claim token not found or expired"},
            )

        data = json.loads(val)
        if data.get("status") == "claimed":
            return ClaimStatusResponse(
                status="claimed",
                claimed_by=data.get("claimed_by", "Investigator Account"),
                platform_jwt=data.get("platform_jwt"),
                device_info=data.get("device_info"),
            )

        return ClaimStatusResponse(
            status=data.get("status", "pending"),
            device_info=data.get("device_info"),
        )
    finally:
        await redis.aclose()

@router.post("/{token}/quick-redeem", response_model=RedeemResponse)
async def quick_redeem_claim_token(
    token: str,
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(get_current_user_claims)
):
    """
    Web Dashboard device authorization endpoint.
    Fetches claim token from Redis, validates pending state, and updates Redis
    state to 'claimed' with scoped device JWT.
    ABSOLUTELY NO Case creation or PostgreSQL Case database interactions occur here.
    """
    redis = aioredis.from_url(settings.REDIS_URL, protocol=2)
    try:
        raw_val = await redis.get(f"claim:{token}")
        if not raw_val:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "TOKEN_NOT_FOUND", "detail": "Claim link token does not exist or expired"},
            )

        data = json.loads(raw_val)
        if data.get("status") == "claimed":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error": "ALREADY_CLAIMED", "detail": "Token has already been redeemed"},
            )

        user_id = user_payload.get("sub")
        user_query = select(User).where(User.id == user_id)
        u_res = await db.execute(user_query)
        user = u_res.scalar_one_or_none()
        username = user.username if user else "Investigator Account"

        # Generate device-paired JWT without case scope
        device_jwt = create_scope_access_token(
            data={
                "sub": str(user_id),
                "scope": "device_paired",
            },
            expires_delta=timedelta(days=7),
        )

        # Update Redis status to claimed for desktop agent polling
        data["status"] = "claimed"
        data["claimed_by"] = username
        data["platform_jwt"] = device_jwt
        await redis.set(f"claim:{token}", json.dumps(data), ex=900)

        return RedeemResponse(message="Device paired successfully")
    finally:
        await redis.aclose()


