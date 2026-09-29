# SentinelFS — Standard Operating Procedures (SOPs)

**Platform:** SentinelFS Multi-Vendor DVR/NVR Forensic Analysis Platform  
**PS:** SIH 26150 — NTRO  
**Team:** Sentinels (ID: 134952)  
**Legal Compliance:** Section 63(4), Bharatiya Sakshya Adhiniyam (BSA), 2023  
**Version:** 1.0 | SIH 2026  

---

> [!IMPORTANT]
> These SOPs govern the use of SentinelFS in forensic investigations. Every action performed through SentinelFS is automatically logged to a cryptographic, append-only audit ledger. Investigators must not attempt to modify, delete, or bypass any step in these procedures. Doing so may render evidence inadmissible under Section 63(4) BSA 2023.

---

## 📑 Table of Contents
1. [SOP-01: Evidence Acquisition from Seized DVR/NVR](#sop-01-evidence-acquisition-from-seized-dvrnvr)
2. [SOP-02: Manual Video Evidence Upload](#sop-02-manual-video-evidence-upload)
3. [SOP-03: AI-Assisted Analysis Workflow](#sop-03-ai-assisted-analysis-workflow)
4. [SOP-04: Cross-Camera Timeline Correlation](#sop-04-cross-camera-timeline-correlation)
5. [SOP-05: Forensic Report Generation & Court Submission](#sop-05-forensic-report-generation--court-submission)
6. [SOP-06: Tool Validation & Environment Verification](#sop-06-tool-validation--environment-verification)
7. [SOP-07: Chain-of-Custody Audit Log Verification](#sop-07-chain-of-custody-audit-log-verification)
8. [SOP-08: Evidence Integrity Re-Verification](#sop-08-evidence-integrity-re-verification)
9. [Appendix A: Vendor Coverage Reference](#appendix-a-vendor-coverage-reference)
10. [Appendix B: Legal Compliance Reference](#appendix-b-legal-compliance-reference)
11. [Appendix C: Known Limitations](#appendix-c-known-limitations)

---

## SOP-01: Evidence Acquisition from Seized DVR/NVR

**Purpose:** Standardized forensic acquisition from a physically seized DVR/NVR hard drive or raw disk image, ensuring no modification to the source evidence.

**Prerequisites:**
- Physical write-blocker connected between the seized drive and the investigator's machine.
- SentinelFS Desktop Agent (Tauri GUI) installed and paired to the platform.
- Investigator account created on the SentinelFS web platform.
- Output storage with sufficient free space (minimum 2× the size of the source drive).

**Authority Required:** Written seizure authorization or court order.

### Steps

#### Step 1 — Connect the seized drive
- Attach the seized DVR hard drive to your machine through a hardware write-blocker.
- **Never connect a seized drive directly without a write-blocker** — any accidental write will alter the evidence and may void admissibility.
- Confirm the write-blocker indicator light shows read-only mode before proceeding.

#### Step 2 — Launch the SentinelFS Desktop Agent
- Open the SentinelFS Agent application on the investigator's workstation.
- If this is the first launch, complete device pairing (see the QR code / claim link on the Device Pairing screen) before proceeding.
- If the platform connection banner shows **"✓ Persistent Platform Connection Active"**, proceed directly to Step 3.

#### Step 3 — Create or select a case
- Enter the **Operator Name** (the investigating officer's full name as it will appear in the forensic report).
- Enter the **Case Reference** (e.g., `FIR-2026-001` — this must match the official case filing number).
- Click **"Run Forensic Carving"**.

#### Step 4 — Select the source drive
- The Drive Selection screen will enumerate all connected physical drives and disk image files.
- Select the write-blocked seized drive or click **"Open disk image file..."** to select a `.dd`, `.raw`, or `.img` file if a prior bit-stream image was created.
- Do not select your own system drive or any drive not related to the case.
- Confirm your selection and click **"Confirm Drive"**.

#### Step 5 — Carving begins automatically
The `sentinel-carver` engine will:
- Compute a full-drive `SHA-256` + `MD5` hash of the source image (streaming, read-only — this is the hash that goes into the BSA Section 63(4) certificate).
- Detect the DVR vendor automatically (Dahua/CP Plus/Honeywell, Hikvision/Godrej, or Generic fallback for Uniview/Matrix/TP-Link).
- Scan every sector for valid video signatures (`DHAV` headers, MPEG-PS pack headers, or H.264 Annex B start codes).
- Carve and demultiplex all camera channels into separate segment files.
- Flag any segment found in unallocated space as `is_deleted: true` (deleted footage recovery).
- Compute `SHA-256` + `MD5` on each carved segment individually.
- Monitor the live progress display — do not interrupt the process once started.
- On completion, the screen shows total segments found, bytes scanned, and vendor detected.

#### Step 6 — Review carved segments
The Preview screen displays all carved segments with:
- Camera channel ID
- Timestamp range (start → end)
- `SHA-256` and `MD5` hashes
- `DELETED` badge if recovered from unallocated space
- Thumbnail or video preview where format allows
- Verify the segment count and timestamp ranges are consistent with the expected recording period of the seized device.

#### Step 7 — Upload to the SentinelFS platform
- On the Upload screen, confirm the manifest summary (segment count, total size, source hash).
- Click **"Upload to SentinelFS"**.
- The platform re-verifies all hashes on receipt — if any mismatch is detected, the upload is rejected and an alert is shown.
- On successful upload, a case URL is generated — record this URL in the physical case file.

#### Step 8 — Record physical documentation
Note in the physical case file:
- Source drive serial number
- `SHA-256` of the source image (shown in the manifest)
- Case URL from the SentinelFS platform
- Date, time, and operator name

**Output Produced:**
- `manifest.json` — tamper-evident manifest with all hashes and segment metadata
- `audit_trail.jsonl` — append-only cryptographic audit log
- Carved segment files — hash-sealed, stored in the evidence vault
- BSA Section 63(4) compliance statement embedded in the manifest

---

## SOP-02: Manual Video Evidence Upload

**Purpose:** Intake of video files already exported from a DVR/NVR using the manufacturer's own software, or received from a third party, where full raw disk acquisition is not possible.

**When to use:** When a physical drive is not available and only exported clip files (`.dav`, `.mp4`, `.avi`, `.h264`, `.dvr`) are in hand.

> [!NOTE]
> Manual uploads receive a lower `recovery_confidence` rating than carved acquisitions and should be noted as such in the case file and report.

### Steps

#### Step 1 — Launch Agent & Create Case
- Launch the Desktop Agent and create a case (same as SOP-01 Steps 2–3).

#### Step 2 — Select Upload Mode
- Select **"Upload Existing Videos"** on the Welcome screen.

#### Step 3 — Add video files
- Click **"+ Add Videos"** and select all relevant clip files.
- **Accepted formats:** `.dav`, `.mp4`, `.avi`, `.mkv`, `.h264`, `.dvr`, `.raw`.
- For each file, the agent will automatically:
  - Compute `SHA-256` + `MD5` (this hash is the BSA certificate reference).
  - Run `ffprobe` to extract duration, resolution, codec, and embedded timestamp.
  - Display a `ManualFileCard` with all metadata and both hash values.

#### Step 4 — Verify metadata per file
- Confirm the file name, hash values, and extracted timestamp match the evidence received.
- If a file shows *"Metadata unavailable — proprietary format,"* note this in the case file; the hash is still computed and the file is still forensically sealed.

#### Step 5 — Proceed to Upload
- Complete upload and physical documentation (same as SOP-01 Steps 7–8).

---

## SOP-03: AI-Assisted Analysis Workflow

**Purpose:** Targeted AI analysis of specific segments to detect persons, vehicles, and faces — run only after the investigator has applied a time/camera filter to avoid processing unnecessary footage.

> [!IMPORTANT]
> Do not click "Run AI Analysis" on all segments at once. The triage filter exists to reduce analysis time (a core PS 26150 requirement). Select only the segments relevant to the incident time window.

### Steps

#### Step 1 — Open case on dashboard
- Open the case on the SentinelFS web dashboard via the recorded URL.
- The Timeline view shows all carved segments indexed by camera channel and timestamp.

#### Step 2 — Apply the triage filter
- Set **Camera Channel** to the camera(s) relevant to the incident.
- Set **Time Window** to the incident period (e.g. 01:30 AM – 02:30 AM).
- Toggle **Show Deleted** on if you want to include recovered deleted footage.
- The filtered list should show only the directly relevant segments (typically 2–10 out of potentially thousands).

#### Step 3 — Select segments for analysis
- Check the segments you want to analyze.
- Review the `SHA-256` hash displayed on each segment card to confirm you are selecting the correct evidence.

#### Step 4 — Run AI Analysis
- Click **"Run AI Analytics"** on the selected segments only.
- The system enqueues an analysis job via Redis Streams.
- **Pipeline A runs automatically:**
  - YOLOv11 detects all persons, vehicles, and objects per frame.
  - ByteTrack assigns persistent Track IDs across frames.
  - OSNet extracts 512-dim body embeddings per tracked person.
  - Vehicle HSV + HOG features extracted per tracked vehicle.
- **Pipeline B runs on every tracked person:**
  - Best 8 frames selected by quality score (sharpness, frontal angle, exposure, occlusion).
  - NAFNet non-generative denoising applied to each frame.
  - Burt-Adelson Laplacian pyramid fusion produces `composite.png`.
  - ArcFace extracts 512-dim embedding from the restored composite face.

#### Step 5 — Monitor job status
- The dashboard shows live job status: `queued` → `running` → `done`.
- Processing time depends on segment length and hardware (GPU strongly recommended for Pipeline B).
- On completion, detection results, track summaries, and embeddings are written to the case database.

#### Step 6 — Review detections
- The Analysis Results view shows:
  - Bounding boxes per frame with Track IDs.
  - Per-track summary (first seen, last seen, duration, best crop).
  - Confidence scores per detection.
- Flag any incorrect detections using the **"Reject Detection"** button (human verification is recorded in the audit log).

---

## SOP-04: Cross-Camera Timeline Correlation

**Purpose:** Building a unified chronological timeline of a subject's movement across multiple cameras, with clock-drift correction applied.

**Prerequisite:** AI analysis (SOP-03) must be completed on segments from at least two different camera channels.

### Steps

#### Step 1 — Navigate to Timeline view
- Open the case and click **"Timeline"** in the left sidebar.

#### Step 2 — Initiate identity search
- Click **"Search by Face/Person"**.
- Upload a reference photograph of the suspect (any clear photo — does not need to be from the CCTV footage).
- The system runs ArcFace embedding on the uploaded photo and searches the FAISS index using cosine similarity.
- Results are returned ranked by confidence, across all cameras and all analyzed segments.

#### Step 3 — Review and confirm matches
- For each candidate match, the system shows:
  - Camera channel, timestamp, confidence score.
  - Side-by-side: reference photo vs. matched restored composite.
  - `attribution.json` showing which source frames contributed to the composite (per-region).
- Click **"Confirm Match"** or **"Reject Match"** for each result (these decisions are logged in the audit trail).

#### Step 4 — View unified cross-camera timeline
- Confirmed matches are assembled into a chronological movement timeline with clock-drift-corrected timestamps.
- The timeline shows: `Camera → Entry time → Exit time → Next camera`.
- Export the timeline as a JSON or PDF extract for inclusion in the report.

---

## SOP-05: Forensic Report Generation & Court Submission

**Purpose:** Generating a sealed, court-ready forensic report that satisfies Section 63(4) BSA 2023 requirements.

### Steps

#### Step 1 — Navigate to Reports
- Open the case on the SentinelFS web dashboard.
- Click **"Generate Report"** in the left sidebar.

#### Step 2 — Confirm case details
- Verify operator name, case reference, and date match the physical case file.
- Confirm the list of analyzed segments shown on the report preview.

#### Step 3 — Generate sealed package
- Click **"Generate Forensic Report"**.
- The system produces a sealed case package containing:
  - PDF forensic report with all findings.
  - `SHA-256` + `MD5` of every piece of evidence.
  - Per-region face restoration attribution (`attribution.json`).
  - NAFNet model checkpoint `SHA-256` (model provenance).
  - Full audit log excerpt for this case.
  - BSA Section 63(4) compliance certificate with dual-hash verification statement.
  - Blockchain transaction ID (Polygon testnet) anchoring the audit log root hash.

#### Step 4 — Verify blockchain anchor
- The report includes a blockchain transaction ID.
- Verify it independently at [Polygonscan](https://amoy.polygonscan.com) using the transaction ID shown in the report.
- The on-chain data should match the audit log root hash in the report.

#### Step 5 — Download and submit
- Download the sealed PDF report or `.case.zip` archive.
- The PDF is self-contained — it includes all hash values needed for independent verification.
- Submit the PDF alongside the physical evidence to the court or investigating authority.
- The defence or any independent expert can verify the report's integrity by re-computing the hashes against the original evidence files.

---

## SOP-06: Tool Validation & Environment Verification

**Purpose:** Confirming that the SentinelFS platform is correctly installed and all components are functioning before use in an active investigation.

**When to run:** Before the first use on a new machine, after any software update, and at the start of each new case.

### Steps

#### Step 1 — Verify the ML environment
```bash
cd ml
python verify_setup.py
```
- **Expected output:** `All checks passed. Safe to start the API.`
- If any check fails, the script prints the exact fix command — run it and re-verify before proceeding.

#### Step 2 — Verify the Rust carver
```bash
cd sentinel-carver
cargo test
```
- **Expected output:** All tests pass with no panics or failures.

#### Step 3 — Run the API integration test
```bash
# With the ML service running on port 8001:
python ml/test_api.py --key YOUR_KEY --image ml/test_person_frame1.jpg
```
- **Expected output:** `All checks passed.` with a restored image written to `test_api_restored.png` — open it and visually confirm the denoising is working.

#### Step 4 — Verify hash round-trip on a known file
```bash
# Hash a known test file before and after carving
cd sentinel-carver
cargo run --release -- --input docs/fixtures/fake_disk.raw --output-dir ./carved_test --operator "Validation Test"
```
- Open `carved_test/manifest.json`.
- Confirm `source_sha256` matches the known hash of `fake_disk.raw`.
- Confirm `audit_trail.jsonl` exists and shows `DRIVE_MOUNTED`, `SOURCE_HASHED`, `VENDOR_DETECTED`, `SEGMENT_CARVED`, `MANIFEST_SEALED` entries in sequence.

#### Step 5 — Confirm audit chain integrity
- The terminal output of the carver shows:
  `Audit Ledger: Verified (UNBROKEN) | BSA Sec 63 Status: COMPLIANT`
- If it shows `BROKEN` or `NON-COMPLIANT`, do not use this installation for active casework — report to the system administrator.

---

## SOP-07: Chain-of-Custody Audit Log Verification

**Purpose:** Independent verification that the audit log for a case has not been tampered with since the evidence was first acquired.

### Steps

#### Step 1 — Locate the audit log
- In the SentinelFS web dashboard, navigate to the case.
- Click **"Audit Log"** in the left sidebar.
- The audit trail viewer shows every logged action with its hash and the hash chain linking it to the previous entry.

#### Step 2 — Visual chain inspection
- Confirm the first entry shows action `DRIVE_MOUNTED` with `previous_block_hash` equal to 64 zeroes (the genesis block).
- Confirm every subsequent entry's `previous_block_hash` matches the `current_block_hash` of the entry before it.

#### Step 3 — Automated verification
- Click **"Verify Chain Integrity"** on the dashboard.
- The system re-reads the entire `audit_trail.jsonl` file, recomputes every block hash, and confirms the chain is unbroken.
- **Expected result:** `"Chain Intact — N entries verified"`

#### Step 4 — Cross-check blockchain anchor
- Note the blockchain transaction ID shown at the bottom of the audit log.
- Verify it on [Polygonscan](https://amoy.polygonscan.com).
- The on-chain data encodes the Merkle root of the audit log at the time of anchoring — if the log has been altered since anchoring, the root will not match.

---

## SOP-08: Evidence Integrity Re-Verification

**Purpose:** Re-verifying that carved segment files have not been altered since they were originally sealed, at any point during or after an investigation.

### Steps

#### Step 1 — Open Case on Dashboard
- Navigate to the case on the web dashboard.

#### Step 2 — Re-compute Checksums
- Click **"Verify Evidence Integrity"**.
- The system retrieves each segment file from the evidence vault.
- It re-computes `SHA-256` and `MD5` of each file.
- It compares the computed hashes against the hashes stored in `manifest.json` at the time of acquisition.

#### Step 3 — Review results
- **All hashes match:** Evidence is intact — display **"✅ VERIFIED"** badge.
- **Any hash mismatch:** Evidence may have been altered — display **"❌ INTEGRITY FAILURE"** and log the event to the audit trail immediately.
- A mismatch must be reported to a senior investigating officer and the case file must be flagged before any further action is taken.

---

## Appendix A: Vendor Coverage Reference

| Vendor | Tier | Format | Parsing Depth | Deleted Recovery |
| :--- | :---: | :--- | :--- | :--- |
| **Dahua Technology** | 1 | DHAV / DHFS4.1 | Full proprietary | ✅ NAL + index carving |
| **CP Plus** | 1 | DHAV (Dahua OEM) | Full proprietary | ✅ Same as Dahua |
| **Honeywell Security**| 1 | DHAV (Dahua OEM) | Full proprietary | ✅ Same as Dahua |
| **Hikvision** | 2 | HIKFS / MPEG-PS | Full proprietary | ✅ MPEG-PS carving |
| **Godrej Security** | 2 | MPEG-PS (HIK lineage) | Full proprietary | ✅ HIK lineage |
| **Uniview** | 3 | H.264/H.265 Annex B | Best-effort | ✅ NAL start-code carving |
| **Matrix** | 3 | H.264/H.265 Annex B | Best-effort | ✅ NAL start-code carving |
| **TP-Link** | 3 | H.264/H.265 Annex B | Best-effort | ✅ NAL start-code carving |

### Tier Definitions
- **Tier 1:** Full proprietary container + filesystem parsing, timestamp extraction, camera channel demultiplexing.
- **Tier 2:** Proprietary stream header parsing, frame boundary detection, timestamp from SCR.
- **Tier 3:** Vendor-agnostic Annex B NAL unit carving — works on any H.264/H.265 stream regardless of container.

*Sources: Han/Jeong/Lee (2015) Hikvision filesystem analysis; MDPI (2025) multi-vendor DVR recovery study (91.8% recovery rate, 96.7% timestamp accuracy on 27 real drives); FFmpeg dhav.c demuxer specification.*

---

## Appendix B: Legal Compliance Reference

Section 63(4) of the Bharatiya Sakshya Adhiniyam, 2023 requires a certificate signed by the responsible person that includes the hash value of the electronic record. SentinelFS satisfies this by:
1. Computing `SHA-256` + `MD5` on the source drive in a single streaming pass during read-only acquisition — no second read of the evidence is required.
2. Embedding these hash values in every output document and the sealed forensic report.
3. Logging every action to a cryptographic hash-chained audit ledger where modification of any historical entry is mathematically detectable.
4. Anchoring audit log root hashes to a public blockchain (Polygon Amoy testnet) providing an independent, externally verifiable timestamp.
5. Ensuring all AI processing is non-generative — NAFNet residual denoising ($y = x + \text{net}(x)$) and Burt-Adelson Laplacian pyramid blending produce no pixels that were not present in the original source frames. The model checkpoint `SHA-256` is embedded in every report as model provenance evidence.

*Note: Section 63 BSA 2023 replaces Section 65B of the Indian Evidence Act, 1872, effective July 1, 2024.*

---

## Appendix C: Known Limitations

These limitations must be disclosed in any forensic report generated by SentinelFS:

| Limitation | Details |
| :--- | :--- |
| **Encrypted footage** | Approximately 43% of modern DVR footage uses proprietary encryption. SentinelFS recovers the encrypted stream but cannot decrypt it without the vendor key. Encrypted segments are flagged in the manifest as `encrypted: true`. |
| **Firmware-variant drift** | Proprietary DVR formats vary slightly between firmware versions of the same vendor. Tier 1/2 parsers are validated against documented specifications; edge-case firmware variants may require manual review. |
| **No live DVR network access** | SentinelFS operates on offline disk images and exported files only. It does not connect to live DVR/NVR systems over a network. |
| **Synthetic fixture validation** | Core validation was performed on synthetic fixtures built from published filesystem specifications. Real-hardware validation was performed using MDPI 2025 study data (27 real drives). Independent re-validation on case-specific hardware is recommended before first use in a jurisdiction. |
| **Action Recognition module** | Pipeline A includes action recognition capability. The specific model is under evaluation and results from this module should be treated as investigative leads, not as primary evidence, until the module is formally validated. |

---

*Document prepared by Team Sentinels for SIH 2026, PS 26150 (NTRO).*  
*For technical support, raise an issue on the [GitHub Repository](https://github.com/GoDn76/Sentinal_FS).*
