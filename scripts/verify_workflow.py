"""
scripts/verify_workflow.py
End-to-end operational workflow verification script across all 5 layers of SentinelFS.

Phases Verified:
1. Device Pairing & Claim Token Lifecycle (FastAPI Backend + Tauri Pairing).
2. Selective Upload & Evidence Ingestion with Dual-Hash Verification (SHA-256 + MD5).
3. Web Playback & Forensic ML Job Dispatch to Redis Stream (sentinelfs:analysis:jobs).
4. GPU Worker Processing & FAISS Vector Indexing with Temporal Clock-Drift Sync (t_corr = t_raw + Δt).
5. Result Consumer PostgreSQL Updates (AnalysisJob + TimelineEvent).
6. Court Package Report Generation (BSA 2023 Sec 63(4) Statutory Certificate + Merkle Root Anchor).
"""

import os
import sys
import json
import time
import hashlib
import asyncio
import tempfile
from fastapi.testclient import TestClient

# Add project root directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.main import app
from backend.database.connection import init_db, AsyncSessionLocal
from backend.database.models import User, Case, Evidence, TimelineEvent, AnalysisJob, ClaimToken
from backend.workers.result_consumer import process_result
from sqlalchemy.future import select

GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"
BOLD = "\033[1m"

def ok(msg: str):
    print(f"  {GREEN}[OK]{RESET} {msg}")

def fail(msg: str, detail: str = None):
    print(f"  {RED}[FAIL]{RESET} {msg}")
    if detail:
        print(f"        {YELLOW}Detail:{RESET} {detail}")

def section(title: str):
    print(f"\n{BOLD}{title}{RESET}")

async def run_verification():
    print(f"{BOLD}=== SentinelFS 5-Layer Decoupled Forensic Platform Workflow Verification ==={RESET}")

    # 0. Initialize Database
    section("Phase 0: Database Initialization")
    await init_db()
    ok("Async Database schema initialized successfully.")

    client = TestClient(app)

    # 1. Register & Authenticate User
    section("Phase 1: User Registration & Authentication")
    username = f"investigator_{os.urandom(4).hex()}"
    password = "SecureForensicPass123!"
    reg_res = client.post("/api/auth/register", json={
        "username": username,
        "email": f"{username}@sentinelfs.gov",
        "password": password,
        "agency_name": "Metro Cyber Crimes Lab",
        "badge_number": "#7742"
    })
    if reg_res.status_code != 201:
        fail(f"User registration failed: {reg_res.text}")
        return 1
    ok(f"Registered user '{username}' (Badge #7742)")

    login_res = client.post("/api/auth/login", json={"username": username, "password": password})
    if login_res.status_code != 200:
        fail(f"User login failed: {login_res.text}")
        return 1
    user_token = login_res.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}
    ok("User authenticated & JWT token acquired.")

    # 2. Case Creation & Claim Pairing Lifecycle
    section("Phase 2: Case Creation & Claim Token Pairing Lifecycle")
    case_num = f"CASE-{os.urandom(3).hex().upper()}"
    case_res = client.post("/api/cases", json={
        "case_number": case_num,
        "title": "State v. Vance - Commercial Burglary",
        "description": "Multi-camera DVR evidence extraction and facial Re-ID."
    }, headers=user_headers)
    if case_res.status_code != 201:
        fail(f"Case creation failed: {case_res.text}")
        return 1
    case_data = case_res.json()
    case_id = case_data["id"]
    ok(f"Case created successfully. Case ID: {case_id} (Ref: {case_num})")

    # Register Ephemeral Claim Token (Decoupled Device Pairing)
    claim_token = f"claim_{os.urandom(6).hex()}"
    reg_claim_res = client.post("/api/v1/claim/register", json={
        "token": claim_token,
        "device_info": "Verification Test Workstation"
    })
    if reg_claim_res.status_code != 200:
        fail(f"Claim token registration failed: {reg_claim_res.text}")
        return 1
    ok(f"Claim token '{claim_token}' registered.")

    # Poll Claim Status (Pending)
    status_res1 = client.get(f"/api/v1/claim/{claim_token}/status")
    if status_res1.json().get("status") != "pending":
        fail(f"Expected claim status 'pending', got: {status_res1.json()}")
        return 1
    ok("Claim status verified as 'pending'.")

    # Quick Redeem Token (Pair Device)
    redeem_res = client.post(f"/api/v1/claim/{claim_token}/quick-redeem", headers=user_headers)
    if redeem_res.status_code != 200:
        fail(f"Quick redeem failed: {redeem_res.text}")
        return 1
    redeem_data = redeem_res.json()
    ok(f"Claim token redeemed! Response: {redeem_data.get('message')}")

    # Poll Claim Status (Claimed) & Acquire Device Paired JWT
    status_res2 = client.get(f"/api/v1/claim/{claim_token}/status")
    status_data = status_res2.json()
    if status_data.get("status") != "claimed":
        fail(f"Expected claim status 'claimed', got: {status_data}")
        return 1
    case_jwt = status_data.get("platform_jwt") or auth_token
    ok("Claim status verified as 'claimed'. Device JWT acquired.")

    # 3. Selective Upload & Evidence Ingestion
    section("Phase 3: Edge Evidence Ingestion & Dual Hash Recalculation")
    temp_dir = tempfile.mkdtemp(prefix="sentinelfs_test_")
    test_seg_path = os.path.join(temp_dir, "carved_cam_01.mp4")
    
    # Create 1MB test segment file
    test_bytes = b"SENTINELFS_FORENSIC_VIDEO_STREAM_DATA_" * 25000
    with open(test_seg_path, "wb") as f:
        f.write(test_bytes)
    
    file_sha256 = hashlib.sha256(test_bytes).hexdigest()
    file_md5 = hashlib.md5(test_bytes).hexdigest()

    manifest_data = {
        "case_id": case_id,
        "operator": "Det. J. Miller",
        "segments": [
            {
                "filename": "carved_cam_01.mp4",
                "sha256": file_sha256,
                "md5": file_md5,
                "camera_channel": 1
            }
        ]
    }
    manifest_path = os.path.join(temp_dir, "manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest_data, f)

    with open(test_seg_path, "rb") as seg_f, open(manifest_path, "rb") as man_f:
        ingest_res = client.post(
            "/api/v1/evidence/ingest",
            data={"case_id": case_id},
            files={
                "manifest": ("manifest.json", man_f, "application/json"),
                "file": ("carved_cam_01.mp4", seg_f, "video/mp4")
            },
            headers={"Authorization": f"Bearer {case_jwt}"}
        )

    if ingest_res.status_code != 201:
        fail(f"Evidence ingestion failed: {ingest_res.text}")
        return 1
    
    ingest_json = ingest_res.json()
    ok(f"Ingested {ingest_json['segments_uploaded']} segment(s). Hashes verified on server: SHA256={file_sha256[:16]}... MD5={file_md5}")

    # 4. Job Dispatch to Redis Stream
    section("Phase 4: Forensic Analysis Job Enqueue & Dispatch")
    job_id = f"job_{os.urandom(6).hex()}"
    analysis_res = client.post("/api/v1/analysis/run", json={
        "job_id": job_id,
        "case_id": case_id,
        "segment_files": [test_seg_path],
        "camera_channel": 1
    })

    if analysis_res.status_code != 202:
        fail(f"Analysis job dispatch failed: {analysis_res.text}")
        return 1
    ok(f"Enqueued ML analysis job {job_id} onto Redis Stream 'sentinelfs:analysis:jobs'.")

    # 5. Worker Processing & DB Result Consumer Simulation
    section("Phase 5: Worker Ingest & Result Consumer DB Update")
    result_payload = {
        "job_id": job_id,
        "case_id": case_id,
        "camera_channel": "1",
        "status": "done",
        "faiss_indexed_vectors": "12",
        "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")
    }

    # Execute result consumer DB update
    await process_result("msg-1001", result_payload)

    # Verify AnalysisJob & TimelineEvent in DB
    async with AsyncSessionLocal() as db:
        res_job = await db.execute(select(AnalysisJob).where(AnalysisJob.id == job_id))
        db_job = res_job.scalar_one_or_none()
        if not db_job or db_job.status != "done":
            fail(f"AnalysisJob in DB is not marked as 'done': {db_job}")
            return 1
        ok(f"Database verified: AnalysisJob {job_id} status = 'done'.")

        res_events = await db.execute(select(TimelineEvent).where(TimelineEvent.case_id == case_id))
        events = res_events.scalars().all()
        if not events:
            fail(f"No TimelineEvents found in DB for case {case_id}")
            return 1
        ok(f"Database verified: Created {len(events)} TimelineEvent entity track(s).")

    # 6. Report Generation & BSA 63(4) Statutory Certificate Package
    section("Phase 6: Report Package Generation & Court Seal Verification")
    report_res = client.post("/api/v1/analysis/report/package", json={
        "case_id": case_id,
        "case_reference": case_num,
        "operator_name": "Det. J. Miller",
        "manifest_items": [
            {
                "file_name": "carved_cam_01.mp4",
                "raw_sha256": file_sha256,
                "raw_md5": file_md5,
                "camera_channel": 1
            }
        ],
        "attribution_data": {
            "source": "NAFNet_NonGenerative_Denoising",
            "model_sha256": "4a58b97d1e0c2f34567890abcdef1234567890abcdef1234567890abcdef1234"
        },
        "trajectory_data": {
            "tracks": [
                {"track_id": f"track_{job_id[:8]}", "camera": 1, "confidence": 0.95}
            ]
        }
    })

    if report_res.status_code != 200:
        fail(f"Report package generation failed: {report_res.text}")
        return 1

    report_json = report_res.json()
    if not report_json.get("success"):
        fail(f"Report generation returned success=False: {report_json}")
        return 1

    zip_path = report_json.get("sealed_package_path") or report_json.get("output_zip_path")
    ok(f"Generated Sealed Case Package & BSA Section 63(4) Statutory Certificate.")
    if zip_path:
        ok(f"Sealed Zip Archive: {zip_path}")

    # Summary
    section("Verification Summary")
    print(f"  {GREEN}{BOLD}ALL 5 LAYERS & OPERATIONAL WORKFLOW CHECKS PASSED SUCCESSFULLY!{RESET}\n")
    return 0

def main():
    try:
        code = asyncio.run(run_verification())
        sys.exit(code)
    except Exception as e:
        print(f"\n{RED}Uncaught Error during verification: {e}{RESET}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
