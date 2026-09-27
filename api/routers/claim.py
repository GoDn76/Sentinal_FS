import os
import uuid
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from api.database.connection import get_db
from api.database.models import ClaimToken, Case, User
from api.dependencies import get_current_user, create_access_token

router = APIRouter(prefix="/api/v1/claim", tags=["claim"])

# In-memory rate limiting for polling status endpoint: 20 req/min per IP
ip_rate_limit: dict[str, list[float]] = defaultdict(list)

def check_rate_limit(request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    now = datetime.now().timestamp()
    timestamps = [t for t in ip_rate_limit[client_ip] if now - t < 60]
    if len(timestamps) >= 20:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error": "RATE_LIMIT_EXCEEDED", "detail": "Maximum 20 requests per minute"},
        )
    timestamps.append(now)
    ip_rate_limit[client_ip] = timestamps

class RegisterClaimRequest(BaseModel):
    token: str
    case_id: str
    operator_name: str
    case_reference: str

class ClaimStatusResponse(BaseModel):
    status: str  # pending | claimed | not_found | expired
    claimed_by: str | None = None
    platform_jwt: str | None = None

class RedeemResponse(BaseModel):
    case_id: str
    case_url: str
    case_jwt: str

@router.post("/register", status_code=200)
async def register_claim_token(req: RegisterClaimRequest, db: AsyncSession = Depends(get_db)):
    query = select(ClaimToken).where(ClaimToken.token == req.token)
    result = await db.execute(query)
    claim = result.scalar_one_or_none()

    if not claim:
        claim = ClaimToken(
            token=req.token,
            case_id=req.case_id,
            operator_name=req.operator_name,
            case_reference=req.case_reference,
            status="pending",
        )
        db.add(claim)
    else:
        claim.case_id = req.case_id
        claim.operator_name = req.operator_name
        claim.case_reference = req.case_reference

    await db.commit()
    return {"registered": True}

@router.get("/{token}/status", response_model=ClaimStatusResponse)
async def get_claim_status(token: str, request: Request, db: AsyncSession = Depends(get_db)):
    check_rate_limit(request)

    query = select(ClaimToken).where(ClaimToken.token == token)
    result = await db.execute(query)
    claim = result.scalar_one_or_none()

    if not claim:
        return ClaimStatusResponse(status="not_found")

    # Check expiration
    if claim.expires_at and (datetime.now(timezone.utc) > claim.expires_at.replace(tzinfo=timezone.utc) if claim.expires_at.tzinfo is None else claim.expires_at):
        return ClaimStatusResponse(status="expired")

    if claim.status == "claimed":
        # Lookup user username
        user_query = select(User).where(User.id == claim.claimed_by)
        u_res = await db.execute(user_query)
        user = u_res.scalar_one_or_none()
        username = user.username if user else "Unknown"

        # Issue/re-issue case scoped JWT for desktop agent
        case_jwt = create_access_token(
            data={
                "sub": str(claim.claimed_by),
                "case_id": claim.case_id,
                "scope": "case_upload",
            },
            expires_delta=timedelta(days=7),
        )
        return ClaimStatusResponse(
            status="claimed",
            claimed_by=username,
            platform_jwt=case_jwt,
        )

    return ClaimStatusResponse(status="pending")

@router.post("/{token}/redeem", response_model=RedeemResponse)
async def redeem_claim_token(
    token: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id_str = current_user["sub"]
    user_id_uuid = uuid.UUID(user_id_str)

    query = select(ClaimToken).where(ClaimToken.token == token)
    result = await db.execute(query)
    claim = result.scalar_one_or_none()

    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "CLAIM_TOKEN_NOT_FOUND", "detail": "Token does not exist"},
        )

    platform_url = os.getenv("SENTINELFS_PLATFORM_URL", "https://sentinelfs.app")
    case_url = f"{platform_url}/cases/{claim.case_id}"

    if claim.status == "claimed":
        if str(claim.claimed_by) == user_id_str:
            # Already claimed by this user -> re-issue token and return
            case_jwt = create_access_token(
                data={
                    "sub": user_id_str,
                    "case_id": claim.case_id,
                    "scope": "case_upload",
                },
                expires_delta=timedelta(days=7),
            )
            return RedeemResponse(case_id=claim.case_id, case_url=case_url, case_jwt=case_jwt)
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "CLAIM_ALREADY_REDEEMED",
                    "detail": "This claim token was already redeemed by another user",
                },
            )

    # Check expiration
    now = datetime.now(timezone.utc)
    exp = claim.expires_at.replace(tzinfo=timezone.utc) if claim.expires_at and claim.expires_at.tzinfo is None else claim.expires_at
    if exp and now > exp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "CLAIM_TOKEN_EXPIRED", "detail": "This claim token has expired"},
        )

    # Redeem token
    claim.status = "claimed"
    claim.claimed_by = user_id_uuid
    claim.claimed_at = now

    # Create Case row
    case_id_uuid = uuid.UUID(claim.case_id) if len(claim.case_id) == 36 else uuid.uuid4()
    new_case = Case(
        id=case_id_uuid,
        case_reference=claim.case_reference,
        operator_name=claim.operator_name,
        owner_id=user_id_uuid,
        claim_token=token,
    )
    db.add(new_case)
    await db.commit()

    case_jwt = create_access_token(
        data={
            "sub": user_id_str,
            "case_id": claim.case_id,
            "scope": "case_upload",
        },
        expires_delta=timedelta(days=7),
    )

    return RedeemResponse(case_id=claim.case_id, case_url=case_url, case_jwt=case_jwt)
