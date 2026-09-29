"""
ml_worker.py
Dedicated GPU Worker process consuming jobs from Redis Stream 'sentinelfs:analysis:jobs'.

Execution Pipeline:
1. Pipeline A: YOLOv11m detection + ByteTrack tracking + OSNet 512-dim L2-normalized embeddings.
2. Pipeline B: RetinaFace/MediaPipe face detection -> 8-region scoring -> NAFNet non-generative denoising -> Burt-Adelson Laplacian pyramid blend -> ArcFace 512-dim embedding.
3. FAISS Indexing: Inserts 512-dim embeddings into IndexFlatIP with clock-drift corrected timestamps:
   t_corrected = t_raw + delta_t_i
4. Completion: Publishes results to Redis Stream 'sentinelfs:analysis:results' and executes XACK.
"""

from __future__ import annotations
import os
import sys
import time
import json
import traceback
from datetime import datetime, timezone
import redis

# Add root directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
STREAM_IN = "sentinelfs:analysis:jobs"
STREAM_OUT = "sentinelfs:analysis:results"
CONSUMER_GROUP = "ml-workers"
CONSUMER_NAME = "gpu-worker-1"

def init_redis_group(r: redis.Redis):
    try:
        r.xgroup_create(STREAM_IN, CONSUMER_GROUP, id="0", mkstream=True)
        print(f"[ml_worker] Created Redis consumer group '{CONSUMER_GROUP}' on stream '{STREAM_IN}'")
    except redis.exceptions.ResponseError as e:
        if "BUSYGROUP" in str(e):
            print(f"[ml_worker] Consumer group '{CONSUMER_GROUP}' already active.")
        else:
            print(f"[ml_worker] Redis group error: {e}")

def run_gpu_worker():
    print(f"[ml_worker] Initializing Dedicated GPU ML Worker ({CONSUMER_NAME})...")
    r = redis.from_url(REDIS_URL, decode_responses=True)
    init_redis_group(r)

    # Initialize FAISS Cross Camera Indexer
    from ml.faiss_search import FAISSCrossCameraSearch
    faiss_engine = FAISSCrossCameraSearch(dim=512)

    while True:
        try:
            # Read 1 job from Redis Stream group
            entries = r.xreadgroup(
                groupname=CONSUMER_GROUP,
                consumername=CONSUMER_NAME,
                streams={STREAM_IN: ">"},
                count=1,
                block=3000
            )

            if not entries:
                time.sleep(0.5)
                continue

            for stream_name, messages in entries:
                for msg_id, payload in messages:
                    job_id = payload.get("job_id", "unknown")
                    case_id = payload.get("case_id", "unknown")
                    segment_files = json.loads(payload.get("segment_files", "[]"))
                    camera_channel = int(payload.get("camera_channel", 0))
                    clock_drift = float(payload.get("clock_drift", 0.0))

                    print(f"\n[ml_worker] Processing Job {job_id} for Case {case_id} (Cam {camera_channel}, Drift: {clock_drift}s)...")

                    # ─── Execute Pipeline A: YOLOv11 + ByteTrack + OSNet ───────────────────
                    try:
                        from ml.pipeline_a_person_tracker import run_pipeline_a
                        p_a_results = []
                        for seg_file in segment_files:
                            resolved_path = seg_file
                            if not os.path.exists(resolved_path):
                                candidate_vault_path = os.path.abspath(f"./evidence_vault/{case_id}/{os.path.basename(seg_file)}")
                                if os.path.exists(candidate_vault_path):
                                    resolved_path = candidate_vault_path

                            if os.path.exists(resolved_path):
                                res = run_pipeline_a(resolved_path, camera_channel=camera_channel)
                                p_a_results.append(res)
                    except Exception as p_a_err:
                        print(f"[ml_worker] Pipeline A Warning: {p_a_err}")
                        p_a_results = []

                    # ─── Execute Pipeline B: Face Reconstruction ─────────────────────────
                    try:
                        from ml.face_fusion_v2 import reconstruct
                        fusion_report = None
                        target_video = segment_files[0] if segment_files else ""
                        if target_video and not os.path.exists(target_video):
                            cand = os.path.abspath(f"./evidence_vault/{case_id}/{os.path.basename(target_video)}")
                            if os.path.exists(cand):
                                target_video = cand

                        if target_video and os.path.exists(target_video):
                            out_dir = f"./fusion_out/{job_id}"
                            fusion_report = reconstruct(
                                input_path=target_video,
                                outdir=out_dir,
                                max_images=50
                            )
                    except Exception as p_b_err:
                        print(f"[ml_worker] Pipeline B Warning: {p_b_err}")
                        fusion_report = None

                    # ─── FAISS Indexing with Temporal Clock-Drift Correction ──────────────
                    # t_corrected = t_raw + delta_t_i
                    indexed_count = 0
                    for p_res in p_a_results:
                        p_embs = p_res.get("person_embeddings", [])
                        t_sums = p_res.get("track_summaries", [])
                        for t_sum in t_sums:
                            emb = t_sum.get("embedding")
                            if emb:
                                raw_t = t_sum.get("first_seen_sec", 0.0)
                                corr_t = round(raw_t + clock_drift, 3)
                                meta_item = {
                                    "case_id": case_id,
                                    "track_id": t_sum["track_id"],
                                    "camera_channel": camera_channel,
                                    "timestamp_raw_sec": raw_t,
                                    "timestamp_sec": corr_t,  # Clock-drift corrected
                                    "temporal_offset_sec": clock_drift,
                                    "embedding_type": t_sum.get("embedding_type", "osnet_x1_0_512dim"),
                                    "source_file": segment_files[0] if segment_files else "unknown",
                                    "embedding": emb
                                }
                                faiss_engine.add_embeddings([emb], [meta_item])
                                indexed_count += 1

                    # ─── Publish Results to Redis Stream ──────────────────────────────────
                    results_payload = {
                        "job_id": job_id,
                        "case_id": case_id,
                        "camera_channel": str(camera_channel),
                        "status": "done",
                        "faiss_indexed_vectors": str(indexed_count),
                        "completed_at": datetime.now(timezone.utc).isoformat()
                    }
                    r.xadd(STREAM_OUT, results_payload)
                    r.xack(STREAM_IN, CONSUMER_GROUP, msg_id)
                    print(f"[ml_worker] Job {job_id} complete. Indexed {indexed_count} vectors. XACK sent.")

        except Exception as err:
            print(f"[ml_worker] Error in consumer loop: {err}")
            traceback.print_exc()
            time.sleep(1)

if __name__ == "__main__":
    run_gpu_worker()
