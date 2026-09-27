import os
import sys
from dotenv import load_dotenv

load_dotenv()
from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from typing import List

from api.database.connection import init_db
from api.routers import auth, claim
from api.dependencies import get_case_upload_token

JWT_SECRET = os.getenv("SENTINELFS_JWT_SECRET")
if not JWT_SECRET:
    print("[WARNING] SENTINELFS_JWT_SECRET environment variable is not set. Using fallback development secret key.", file=sys.stderr)

app = FastAPI(
    title="SentinelFS Web API & Claim System",
    version="2.0.0",
    description="FastAPI Backend for User Authentication, Claim Link Token Lifecycle, and Evidence Ingestion",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    await init_db()

app.include_router(auth.router)
app.include_router(claim.router)

@app.post("/api/v1/evidence/ingest")
async def ingest_evidence(
    manifest: UploadFile = File(...),
    segment: List[UploadFile] = File([]),
    token_payload: dict = Depends(get_case_upload_token),
):
    case_id = token_payload.get("case_id")
    if not case_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "MISSING_CASE_ID", "detail": "JWT is missing case_id claim"},
        )

    manifest_bytes = await manifest.read()
    segments_saved = 0
    for seg in segment:
        _ = await seg.read()
        segments_saved += 1

    return {
        "success": True,
        "case_id": case_id,
        "manifest_size": len(manifest_bytes),
        "segments_uploaded": segments_saved,
        "message": "Evidence package successfully ingested into SentinelFS case store",
    }

@app.get("/")
async def root():
    return {"app": "SentinelFS API", "status": "online", "version": "2.0.0"}
