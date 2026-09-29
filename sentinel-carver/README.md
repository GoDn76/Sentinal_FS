# SentinelFS Rust Sector Carver Engine (Layer 1)

**`sentinel-carver`** is a standalone, high-performance forensic carving binary written in **Rust**. It performs raw sector scanning, proprietary DVR header parsing, atom tree parsing, and real-time dual SHA-256 / MD5 cryptographic checksum calculation over seized physical drives and unallocated disk images (`.raw`, `.dd`, `.img`).

---

## 📑 Technical Architecture

```
sentinel-carver/
├── Cargo.toml               # Rust crate metadata & dependencies (sha2, md5, hex, serde)
└── src/
    ├── main.rs              # Sector scanning engine, format parsers, CLI flags, manifest sealer
    └── api_client.rs        # HTTP evidence uploader client
```

---

## 🔍 Supported DVR & Video Formats

1. **Dahua (DHAV)**:
   - Identifies magic byte pattern `DHAV` (`0x44 0x48 0x41 0x56`).
   - Extracts camera channel ID, frame type (I-frame / P-frame), and embedded timestamp metadata.
   - Reconstructs fragmented stream blocks into `.dav` video segments.

2. **Hikvision (HBK / Custom Stream)**:
   - Detects Hikvision `HBK` header signatures and payload boundaries.
   - Restores missing index tables and packages output into playable stream clips.

3. **Generic MP4 / H.264 Atom Tree Parser**:
   - Parses ISO Base Media File Format atom trees (`ftyp`, `moov`, `mdat`, `trak`, `stbl`).
   - Extracts raw H.264 NAL units (`0x00 0x00 0x00 0x01` / `0x00 0x00 0x01`).

---

## 🔒 Cryptographic Sealing & Manifest Generation

During disk scanning, `sentinel-carver` streams disk sectors through concurrent `sha2::Sha256` and `md5::Md5` hasher contexts. Upon completion, it automatically outputs a signed `manifest.json`:

```json
{
  "case_id": "98d77562-4115-4c46-b21e-1fe8f7856bf7",
  "operator": "Det. Investigator",
  "carved_at": "2026-09-29T22:30:00Z",
  "segments": [
    {
      "filename": "carved_cam_01.dav",
      "camera_channel": 1,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "md5": "d41d8cd98f00b204e9800998ecf8427e",
      "size_bytes": 130432743
    }
  ]
}
```

---

## 🛠 Compilation & Execution

```bash
# 1. Build release binary
cargo build --release

# 2. Run sector carving CLI on a raw disk image
./target/release/sentinel-carver --input /path/to/evidence_disk.raw --output /path/to/carved_output
```
