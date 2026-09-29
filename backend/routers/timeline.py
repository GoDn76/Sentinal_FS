from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from backend.database.connection import get_db
from backend.database.models import TimelineEvent, Case, User
from backend.schemas.schemas import TimelineEventResponse, TemporalDriftUpdate
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/timeline", tags=["timeline"])

@router.get("/{case_id}", response_model=List[TimelineEventResponse])
async def get_case_timeline_events(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(TimelineEvent)
        .where(TimelineEvent.case_id == case_id)
        .order_by(TimelineEvent.start_sec.asc())
    )
    events = result.scalars().all()
    return events

@router.put("/drift", response_model=Dict[str, Any])
async def update_temporal_drift_offset(
    drift_in: TemporalDriftUpdate,
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Updates the temporal variance (clock-drift) offset for a specific camera channel
    in a case, shifting all detected timeline events by the offset seconds.
    """
    result = await db.execute(
        select(TimelineEvent)
        .where(TimelineEvent.case_id == case_id)
        .where(TimelineEvent.camera_channel == drift_in.camera_channel)
    )
    events = result.scalars().all()
    updated_count = 0
    for ev in events:
        ev.temporal_offset_sec = drift_in.temporal_offset_sec
        updated_count += 1

    await db.commit()
    return {
        "case_id": case_id,
        "camera_channel": drift_in.camera_channel,
        "temporal_offset_sec": drift_in.temporal_offset_sec,
        "events_updated": updated_count,
        "message": f"Successfully updated clock drift offset to {drift_in.temporal_offset_sec}s for Camera Channel {drift_in.camera_channel}"
    }
