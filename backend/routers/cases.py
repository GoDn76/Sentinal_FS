import os
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from backend.database.connection import get_db
from backend.database.models import Case, User, AuditLog
from backend.schemas.schemas import CaseCreate, CaseResponse, TaskDispatchResponse
from backend.routers.auth import get_current_user
from backend.workers.celery_worker import run_rust_carver, run_ml_pipeline

router = APIRouter(prefix="/cases", tags=["cases"])

@router.get("", response_model=List[CaseResponse])
async def list_cases(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Case).order_by(Case.created_at.desc()))
    return result.scalars().all()

@router.post("", response_model=CaseResponse, status_code=status.HTTP_201_CREATED)
async def create_case(
    case_in: CaseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Case).where(Case.case_number == case_in.case_number))
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Case number {case_in.case_number} already exists"
        )
    
    new_case = Case(
        case_number=case_in.case_number,
        title=case_in.title,
        description=case_in.description,
        jurisdiction=case_in.jurisdiction or "Metro Cyber Division",
        lead_investigator_id=current_user.id
    )
    db.add(new_case)

    # Log audit
    audit = AuditLog(
        case_id=new_case.id,
        phase="case_creation",
        action="create_case",
        status="SUCCESS",
        details={"case_number": case_in.case_number, "investigator": current_user.username}
    )
    db.add(audit)

    await db.commit()
    await db.refresh(new_case)
    return new_case

@router.get("/{case_id}", response_model=CaseResponse)
async def get_case(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalars().first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    return case

@router.post("/{case_id}/carve", response_model=TaskDispatchResponse)
async def dispatch_carving_job(
    case_id: str,
    raw_disk_path: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Dispatch forensic carving job to Celery worker running the Rust binary.
    Returns task_id for WebSocket real-time progress streaming.
    """
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalars().first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    out_dir = os.path.abspath(f"./carved_output/{case_id}")
    
    # Trigger Celery async task
    task = run_rust_carver.delay(raw_disk_path, out_dir, case_id)

    return TaskDispatchResponse(
        task_id=task.id,
        case_id=case_id,
        task_type="carving",
        status="PENDING",
        message=f"Forensic carving task dispatched for drive: {raw_disk_path}"
    )

@router.post("/{case_id}/analyze", response_model=TaskDispatchResponse)
async def dispatch_ml_analysis_job(
    case_id: str,
    video_path: str,
    confidence_thresh: float = 0.45,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Dispatch ML analysis job (YOLOv11/ByteTrack/OSNet/NAFNet) to Celery worker.
    """
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalars().first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    task = run_ml_pipeline.delay(video_path, case_id, confidence_thresh)

    return TaskDispatchResponse(
        task_id=task.id,
        case_id=case_id,
        task_type="ml_inference",
        status="PENDING",
        message=f"ML Pipeline analysis task dispatched for video: {video_path}"
    )
