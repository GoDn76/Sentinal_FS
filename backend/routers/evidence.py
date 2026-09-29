import os
import hashlib
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from backend.database.connection import get_db
from backend.core.media import create_playback_copy
from backend.database.models import Evidence, Case, User, AuditLog
from backend.schemas.schemas import EvidenceResponse
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/evidence", tags=["evidence"])


@router.get("/{case_id}", response_model=List[EvidenceResponse])
async def list_case_evidence(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Evidence).where(Evidence.case_id == case_id))
    return result.scalars().all()

@router.post("/upload", response_model=EvidenceResponse, status_code=status.HTTP_201_CREATED)
async def upload_evidence_file(
    case_id: str = Form(...),
    file_type: str = Form("raw_disk"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalars().first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    upload_dir = os.path.abspath(f"./evidence_vault/{case_id}")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, file.filename)

    sha256_hash = hashlib.sha256()
    md5_hash = hashlib.md5()
    size_bytes = 0

    with open(file_path, "wb") as out_file:
        while chunk := await file.read(1 << 20):
            out_file.write(chunk)
            sha256_hash.update(chunk)
            md5_hash.update(chunk)
            size_bytes += len(chunk)

    raw_sha = sha256_hash.hexdigest()
    raw_md5 = md5_hash.hexdigest()
    playback = create_playback_copy(file_path)
    evidence_metadata = {"playback_status": "ready" if playback else "unavailable"}
    if playback:
        evidence_metadata["playback_file_name"] = playback["file_name"]
        evidence_metadata["playback_sha256"] = playback["sha256"]
        evidence_metadata["playback_size_bytes"] = playback["size_bytes"]

    evidence = Evidence(
        case_id=case_id,
        file_name=file.filename,
        file_path=file_path,
        file_type=file_type,
        raw_sha256=raw_sha,
        raw_md5=raw_md5,
        verified_sha256=raw_sha,
        verified_md5=raw_md5,
        integrity_status="verified",
        file_size_bytes=size_bytes,
        metadata_json=evidence_metadata,
    )
    db.add(evidence)

    audit = AuditLog(
        case_id=case_id,
        phase="ingestion",
        action="upload_evidence",
        status="SUCCESS",
        details={"file_name": file.filename, "sha256": raw_sha, "md5": raw_md5, "playback_status": evidence_metadata["playback_status"]}
    )
    db.add(audit)

    await db.commit()
    await db.refresh(evidence)
    return evidence

@router.post("/{evidence_id}/verify-hash")
async def verify_evidence_integrity(
    evidence_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Instantly re-computes SHA-256 and MD5 hashes of evidence file on disk
    and verifies match against acquisition hashes recorded in DB.
    """
    result = await db.execute(select(Evidence).where(Evidence.id == evidence_id))
    evidence = result.scalars().first()
    if not evidence:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence not found")

    if not os.path.exists(evidence.file_path):
        evidence.integrity_status = "missing"
        await db.commit()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence file missing from disk vault")

    sha256_hash = hashlib.sha256()
    md5_hash = hashlib.md5()
    with open(evidence.file_path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            sha256_hash.update(chunk)
            md5_hash.update(chunk)

    current_sha = sha256_hash.hexdigest()
    current_md5 = md5_hash.hexdigest()

    is_match = (current_sha == evidence.raw_sha256 and current_md5 == evidence.raw_md5)
    acquisition_hash_match = (evidence.metadata_json or {}).get("acquisition_hash_match", True)
    evidence.verified_sha256 = current_sha
    evidence.verified_md5 = current_md5
    evidence.integrity_status = "verified" if is_match and acquisition_hash_match else "tampered"

    await db.commit()
    return {
        "evidence_id": evidence_id,
        "file_name": evidence.file_name,
        "raw_sha256": evidence.raw_sha256,
        "verified_sha256": current_sha,
        "raw_md5": evidence.raw_md5,
        "verified_md5": current_md5,
        "integrity_match": is_match,
        "acquisition_hash_match": acquisition_hash_match,
        "status": evidence.integrity_status
    }


