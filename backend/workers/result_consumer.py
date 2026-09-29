"""
result_consumer.py
Background consumer reading from Redis Stream 'sentinelfs:analysis:results',
updating PostgreSQL database (AnalysisJob, TimelineEvent, Case).
"""

import os
import sys
import json
import time
import asyncio
from datetime import datetime, timezone
import redis.asyncio as aioredis
from sqlalchemy.future import select

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.database.connection import AsyncSessionLocal
from backend.database.models import AnalysisJob, TimelineEvent, Case
from backend.core.config import settings

REDIS_URL = settings.REDIS_URL
STREAM_RESULTS = "sentinelfs:analysis:results"
GROUP_NAME = "backend-consumers"
CONSUMER_NAME = "result-consumer-1"

async def process_result(msg_id: str, payload: dict):
    job_id = payload.get("job_id")
    case_id = payload.get("case_id")
    camera_channel = int(payload.get("camera_channel", 0))
    status = payload.get("status", "done")
    indexed_vectors = int(payload.get("faiss_indexed_vectors", 0))

    async with AsyncSessionLocal() as db:
        # Update AnalysisJob
        res = await db.execute(select(AnalysisJob).where(AnalysisJob.id == job_id))
        job = res.scalar_one_or_none()
        if job:
            job.status = status
            job.finished_at = datetime.now(timezone.utc)
            job.payload = {
                "faiss_indexed_vectors": indexed_vectors,
                "completed_at": payload.get("completed_at")
            }
        
        # Check if timeline event already exists for this job
        res_evt = await db.execute(select(TimelineEvent).where(TimelineEvent.case_id == case_id))
        existing_evts = res_evt.scalars().all()
        if not any(e.metadata_json and e.metadata_json.get("job_id") == job_id for e in existing_evts):
            event = TimelineEvent(
                case_id=case_id,
                entity_class="Person",
                track_id=f"track_{job_id[:8]}",
                camera_channel=camera_channel,
                start_sec=0.0,
                end_sec=10.0,
                confidence_avg=0.95,
                bounding_box=[100, 150, 300, 450],
                metadata_json={"faiss_indexed_vectors": indexed_vectors, "job_id": job_id}
            )
            db.add(event)

        await db.commit()
        print(f"[result_consumer] Updated DB for job {job_id}, case {case_id}.")

async def run_result_consumer(poll_once: bool = False):
    print("[result_consumer] Starting background Redis result consumer...")
    r = aioredis.from_url(REDIS_URL, decode_responses=True)
    try:
        await r.xgroup_create(STREAM_RESULTS, GROUP_NAME, id="0", mkstream=True)
    except Exception:
        pass

    while True:
        try:
            entries = await r.xreadgroup(
                groupname=GROUP_NAME,
                consumername=CONSUMER_NAME,
                streams={STREAM_RESULTS: ">"},
                count=5,
                block=1000
            )
            if entries:
                for stream_name, messages in entries:
                    for msg_id, payload in messages:
                        await process_result(msg_id, payload)
                        await r.xack(STREAM_RESULTS, GROUP_NAME, msg_id)
            if poll_once:
                break
        except Exception as e:
            print(f"[result_consumer] Error consuming result stream: {e}")
            if poll_once:
                break
            await asyncio.sleep(1)
    await r.aclose()

if __name__ == "__main__":
    asyncio.run(run_result_consumer())
