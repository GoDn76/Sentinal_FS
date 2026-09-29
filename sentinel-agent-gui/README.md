# SentinelFS Edge Desktop Agent GUI (Layer 1)

The **SentinelFS Desktop Agent** is a cross-platform desktop application built using **Tauri v2, React 18, TypeScript, Tailwind CSS, and Zustand**. It runs locally on the investigator's field workstation, directly interfacing with physical drive hardware, executing the Rust carver binary (`sentinel-carver`), serving local video previews, performing non-destructive stream copy sub-clip trimming, dual-hashing (SHA-256 + MD5), and packaging evidence for cloud upload.

---

## 📂 Subsystem Structure

```
sentinel-agent-gui/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs               # Tauri app initialization & window setup
│   │   ├── commands.rs           # Drive enumerator, Rust carver launcher, ffprobe wrapper
│   │   └── hasher.rs             # Local sector & file SHA-256 + MD5 hashing
│   ├── Cargo.toml                # Tauri Rust host dependencies
│   └── tauri.conf.json           # Tauri v2 bundle configuration & permissions
├── src/
│   ├── api/
│   │   └── client.ts             # Tauri invoke IPC bridge with web fallback
│   ├── components/
│   │   ├── StepBar.tsx           # Workflow step progress indicator
│   │   ├── ClaimLinkBox.tsx      # Pairing QR code & claim link box
│   │   └── AuditTrailViewer.tsx  # Chain-of-custody block logger
│   ├── pages/
│   │   ├── DeviceLinkPage.tsx    # Step 1: Device Pairing QR code & token status polling
│   │   ├── Welcome.tsx           # Step 1: Case reference entry & connection status
│   │   ├── DriveSelect.tsx       # Step 2: Physical drive & raw disk image picker
│   │   ├── Carving.tsx           # Step 3: Sector-level carving progress & byte counter
│   │   ├── Preview.tsx           # Step 4: Video streaming preview, sub-clip trimming, dual re-hash
│   │   ├── ManualUpload.tsx      # Alternative: Manual video file intake
│   │   └── ClaimUpload.tsx       # Step 5: Multipart evidence package uploader
│   ├── store/
│   │   └── caseStore.ts          # Persistent Zustand store (sentinelfs-case-storage)
│   ├── types/
│   │   └── index.ts              # Agent TypeScript interfaces
│   └── App.tsx                   # React Router layout
└── package.json                  # Agent frontend dependencies
```

---

## 🔑 Core Features & Workflows

1. **Persistent Device Pairing (`DeviceLinkPage.tsx`)**:
   - Generates pairing claim token on first launch.
   - Renders live QR code and claim URL (`http://<host>/claim/<token>`).
   - Polls `GET /api/v1/claim/{token}/status` every 3 seconds until redeemed by an investigator on the web platform.
   - Stores issued case JWT in Zustand `localStorage` for automatic reconnection.

2. **Edge Sector Carving (`Carving.tsx`)**:
   - Enumerates physical drives (Windows CIM / Linux `lsblk`) and raw disk files (`.dd`, `.raw`).
   - Spawns `sentinel-carver` binary with `--input` and `--output` flags.
   - Monitors real-time byte scanning progress via `Arc<Mutex<CarvingProgress>>`.

3. **In-App Local Video Preview & Sub-Clip Selector (`Preview.tsx`)**:
   - Custom Tauri stream handler (`http://localhost:54321/stream/...`) for seeking through carved Dahua (`.dav`) and MP4 video chunks smoothly.
   - Dual range sliders for start (`start_time`) and end (`end_time`) timestamp selection.
   - Non-destructive FFmpeg stream copy trimming:
     ```bash
     ffmpeg -ss {start} -to {end} -i input.mp4 -c copy trimmed.mp4
     ```
   - Invokes `hasher.rs` to compute exact SHA-256 + MD5 checksums on trimmed sub-clips and writes records into `manifest.json`.

4. **Multipart Evidence Package Upload (`ClaimUpload.tsx`)**:
   - Dispatches multipart HTTP POST requests to `POST /api/v1/evidence/ingest` with case-scoped JWT.
   - Attaches carved clips, sub-clips, and signed `manifest.json`.

---

## 🛠 Local Development & Build

```bash
# Install node dependencies
npm install

# Run Tauri desktop app in dev mode
npm run tauri dev

# Build standalone desktop installer (Windows .msi / Linux .deb)
npm run tauri build
```
