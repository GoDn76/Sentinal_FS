import os
import json
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from starlette.concurrency import run_in_threadpool
import redis.asyncio as aioredis

from backend.database.connection import get_db
from backend.database.models import AnalysisJob
from backend.core.config import settings

router = APIRouter(prefix="/analysis", tags=["analysis"])

class AnalysisRequest(BaseModel):
    job_id: str
    case_id: str
    segment_files: List[str]
    camera_channel: Optional[int] = 0

class FAISSSearchRequest(BaseModel):
    query_embedding: List[float]
    top_k: Optional[int] = 20
    min_similarity: Optional[float] = 0.40
    records: Optional[List[dict]] = None

class ReportPackageRequest(BaseModel):
    case_id: str
    case_reference: Optional[str] = None
    operator_name: Optional[str] = "Det. Investigator"
    manifest_items: List[dict]
    attribution_data: Optional[dict] = None
    trajectory_data: Optional[dict] = None

@router.post("/run", status_code=status.HTTP_202_ACCEPTED)
async def trigger_analysis(req: AnalysisRequest, db: AsyncSession = Depends(get_db)):
    """
    Enqueue ML analysis job onto Redis Stream 'sentinelfs:analysis:jobs'
    and record job in database.
    """
    job = AnalysisJob(
        id=req.job_id,
        case_id=req.case_id,
        status="queued",
        segment_files=req.segment_files,
        camera_channel=req.camera_channel or 0,
    )
    db.add(job)
    await db.commit()

    try:
        r = aioredis.from_url(settings.REDIS_URL, protocol=2)
        await r.xadd("sentinelfs:analysis:jobs", {
            "job_id": req.job_id,
            "case_id": req.case_id,
            "segment_files": json.dumps(req.segment_files),
            "camera_channel": str(req.camera_channel or 0),
            "enqueued_at": datetime.now(timezone.utc).isoformat(),
        })
        await r.aclose()
    except Exception as e:
        print(f"[redis-warning] Could not push to Redis Stream ({e}). Job registered in DB.")

    return {"job_id": req.job_id, "status": "queued"}

@router.post("/execute")
async def execute_direct_analysis(req: AnalysisRequest, db: AsyncSession = Depends(get_db)):
    """
    Executes Pipeline A (YOLOv11 Person Tracking) directly on the evidence video file.
    Returns exact real-time person detection count and FAISS vector indices.
    """
    target_file = os.path.basename(req.segment_files[0]) if req.segment_files else "recovered_cam_00.mp4"
    file_stem, file_extension = os.path.splitext(target_file)
    vault_base = os.path.abspath("./evidence_vault")
    case_dir = os.path.abspath(os.path.join(vault_base, req.case_id))
    if os.path.commonpath([vault_base, case_dir]) != vault_base:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence case not found")

    candidate_names = [f"{file_stem}.playback.mp4"]
    if file_extension.lower() != ".mp4":
        candidate_names.append(f"{file_stem}.mp4")
    candidate_names.append(target_file)
    resolved_video_path = next(
        (os.path.join(case_dir, name) for name in candidate_names if os.path.isfile(os.path.join(case_dir, name))),
        None,
    )

    if not resolved_video_path:
        raise HTTPException(status_code=404, detail=f"Evidence video file {target_file} not found for analysis.")

    try:
        from ml.pipeline_a_person_tracker import run_pipeline_a
        results = await run_in_threadpool(
            run_pipeline_a,
            resolved_video_path,
            req.camera_channel or 0,
        )
        if results.get("error"):
            raise HTTPException(status_code=500, detail=results["error"])

        person_tracks = [t for t in results.get("track_summaries", []) if t.get("class_name") == "person"]
        total_persons = len(person_tracks)

        return {
            "success": True,
            "job_id": req.job_id,
            "case_id": req.case_id,
            "video_path": resolved_video_path,
            "fps": round(results.get("fps", 25.0), 1),
            "total_frames": results.get("total_frames", 0),
            "detected_persons_count": total_persons,
            "person_tracks": person_tracks,
            "faiss_indexed_vectors": len(results.get("person_embeddings", [])),
            "processing_time_sec": results.get("processing_time_sec", 0.0),
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[analysis] Pipeline execution notice: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis pipeline failed: {e}",
        ) from e

@router.post("/search/cross-camera")
async def search_cross_camera(req: FAISSSearchRequest):
    """
    FAISS Cross-Camera Unified Vector Search & Chronological Trajectory Engine.
    """
    try:
        from ml.faiss_search import FAISSCrossCameraSearch
        dim = len(req.query_embedding) if req.query_embedding else 512
        engine = FAISSCrossCameraSearch(dim=dim)

        if req.records:
            embeddings = [r["embedding"] for r in req.records if "embedding" in r]
            metadata = [r for r in req.records if "embedding" in r]
            engine.add_embeddings(embeddings, metadata)

        timeline = engine.build_trajectory_timeline(
            query_embedding=req.query_embedding,
            top_k=req.top_k or 20,
            min_similarity=req.min_similarity or 0.40
        )
        return {"success": True, **timeline}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"FAISS cross-camera search failed: {e}"
        )

@router.post("/report/package")
async def generate_forensic_report_package(req: ReportPackageRequest):
    """
    Generates PDF Forensic Report + Section 63(4) BSA Statutory Certificate
    + Merkle Tree Root Hash + Sealed Case Package (.case.zip).
    """
    try:
        from ml.forensic_report import seal_case_package
        import tempfile

        case_dir = os.path.join(tempfile.gettempdir(), "sentinelfs_cases", req.case_id)
        os.makedirs(case_dir, exist_ok=True)
        zip_output_path = os.path.join(case_dir, f"SentinelFS_Sealed_Case_{req.case_id[:8]}.case.zip")

        result = seal_case_package(
            case_id=req.case_id,
            case_dir=case_dir,
            manifest_items=req.manifest_items,
            attribution_data=req.attribution_data,
            trajectory_data=req.trajectory_data,
            output_zip_path=zip_output_path
        )

        return {"success": True, "case_id": req.case_id, **result}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Forensic report packaging failed: {e}"
        )

@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(AnalysisJob).where(AnalysisJob.id == job_id))
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Analysis job not found")

    output = {
        "job_id": job.id,
        "case_id": job.case_id,
        "status": job.status,
        "camera_channel": job.camera_channel,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
        "payload": job.payload,
        "error_message": job.error_message,
    }

    if job.status == "done":
        output["report_download_url"] = f"/api/analysis/report/{job.case_id}/download"

    return output

@router.get("/report/{case_id}/download")
async def download_sealed_case_package(case_id: str):
    import tempfile
    case_dir = os.path.join(tempfile.gettempdir(), "sentinelfs_cases", case_id)
    zip_path = os.path.join(case_dir, f"SentinelFS_Sealed_Case_{case_id[:8]}.case.zip")

    if not os.path.exists(zip_path):
        if os.path.exists(case_dir):
            zips = [os.path.join(case_dir, f) for f in os.listdir(case_dir) if f.endswith(".case.zip")]
            if zips:
                zip_path = zips[0]

    if not os.path.exists(zip_path):
        raise HTTPException(
            status_code=404,
            detail=f"No sealed case package archive found for case {case_id}. Run report packaging first."
        )

    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename=os.path.basename(zip_path),
        headers={"Content-Disposition": f'attachment; filename="{os.path.basename(zip_path)}"'}
    )
