use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command as StdCommand;
use std::sync::{Arc, Mutex};
use std::time::Instant;
use base64::Engine;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use md5::Md5;
use tokio::process::Command as AsyncCommand;
use tokio::io::{AsyncBufReadExt, BufReader};
use uuid::Uuid;
use tauri::Manager;

lazy_static::lazy_static! {
    pub static ref CARVING_JOBS: Arc<Mutex<HashMap<String, CarvingProgress>>> = Arc::new(Mutex::new(HashMap::new()));
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaimTokenResponse {
    pub claim_token: String,
    pub claim_url: String,
    pub case_id: String,
    pub operator: String,
    pub generated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaimStatusResponse {
    pub status: String, // "pending" | "claimed" | "unreachable" | "expired"
    pub claimed_by: Option<String>,
    pub platform_jwt: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriveInfo {
    pub path: String,
    pub label: String,
    pub size_bytes: u64,
    pub is_removable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CarvingProgress {
    pub status: String, // "running" | "complete" | "error"
    pub bytes_scanned: u64,
    pub total_bytes: u64,
    pub segments_found: u32,
    pub current_action: String,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CarvedSegmentUI {
    pub filename: String,
    pub camera_channel: u8,
    pub tier_used: String,
    pub timestamp_start: Option<String>,
    pub timestamp_end: Option<String>,
    pub sha256: String,
    pub md5: String,
    pub frame_count: u32,
    pub is_deleted: bool,
    pub size_bytes: u64,
    pub local_path: String,
    pub can_preview: bool,
    pub source: String, // "carved" | "manual"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileHashResult {
    pub sha256: String,
    pub md5: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoProbeResult {
    pub duration_sec: f64,
    pub width: u32,
    pub height: u32,
    pub codec: String,
    pub creation_time: Option<String>,
    pub frame_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadResult {
    pub success: bool,
    pub case_url: String,
    pub segments_uploaded: u32,
    pub upload_duration_sec: f64,
}

#[tauri::command]
pub async fn generate_claim_token(
    app: tauri::AppHandle,
    operator_name: String,
    _case_reference: String,
) -> Result<ClaimTokenResponse, String> {
    let claim_token = Uuid::new_v4().to_string();
    let case_id = Uuid::new_v4().to_string();

    let platform_url = std::env::var("SENTINELFS_PLATFORM_URL")
        .unwrap_or_else(|_| "https://sentinelfs.app".to_string());

    let claim_url = format!("{}/claim/{}", platform_url.trim_end_matches('/'), claim_token);
    let generated_at = chrono::Utc::now().to_rfc3339();

    let resp = ClaimTokenResponse {
        claim_token,
        claim_url,
        case_id,
        operator: operator_name,
        generated_at,
    };

    // Save current session to app data dir
    if let Ok(app_dir) = app.path().app_data_dir() {
        let session_dir = app_dir.join("sentinelfs");
        let _ = fs::create_dir_all(&session_dir);
        let session_file = session_dir.join("current_session.json");
        if let Ok(json) = serde_json::to_string_pretty(&resp) {
            let _ = fs::write(session_file, json);
        }
    }

    Ok(resp)
}

#[tauri::command]
pub async fn poll_claim_status(
    claim_token: String,
    api_base_url: String,
) -> Result<ClaimStatusResponse, String> {
    let url = format!(
        "{}/api/v1/claim/{}/status",
        api_base_url.trim_end_matches('/'),
        claim_token
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    match client.get(&url).send().await {
        Ok(res) => {
            if res.status().is_success() {
                res.json::<ClaimStatusResponse>()
                    .await
                    .map_err(|e| format!("Failed to parse JSON response: {}", e))
            } else {
                Ok(ClaimStatusResponse {
                    status: "unreachable".into(),
                    claimed_by: None,
                    platform_jwt: None,
                })
            }
        }
        Err(_) => Ok(ClaimStatusResponse {
            status: "unreachable".into(),
            claimed_by: None,
            platform_jwt: None,
        }),
    }
}

#[tauri::command]
pub fn list_drives() -> Result<Vec<DriveInfo>, String> {
    let mut drives = Vec::new();

    #[cfg(target_os = "windows")]
    {
        let output = StdCommand::new("powershell")
            .args(["-NoProfile", "-Command", "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, VolumeName, Size, DriveType | ConvertTo-Json"])
            .output();

        if let Ok(out) = output {
            let text = String::from_utf8_lossy(&out.stdout);
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                let items = if val.is_array() {
                    val.as_array().unwrap().clone()
                } else if val.is_object() {
                    vec![val]
                } else {
                    vec![]
                };

                for item in items {
                    let path = item["DeviceID"].as_str().unwrap_or("").to_string();
                    let label = item["VolumeName"].as_str().unwrap_or("Local Disk").to_string();
                    let size_bytes = item["Size"].as_u64().unwrap_or(0);
                    let drive_type = item["DriveType"].as_u64().unwrap_or(0);
                    let is_removable = drive_type == 2; // 2 = Removable disk

                    if !path.is_empty() {
                        drives.push(DriveInfo {
                            path,
                            label: if label.is_empty() { "Local Disk".to_string() } else { label },
                            size_bytes,
                            is_removable,
                        });
                    }
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let output = StdCommand::new("lsblk")
            .args(["-J", "-b", "-o", "NAME,SIZE,RM,LABEL,MOUNTPOINT"])
            .output();

        if let Ok(out) = output {
            let text = String::from_utf8_lossy(&out.stdout);
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                if let Some(devices) = val["blockdevices"].as_array() {
                    for dev in devices {
                        let name = dev["name"].as_str().unwrap_or("");
                        let size_bytes = dev["size"].as_u64().unwrap_or(0);
                        let rm = dev["rm"].as_bool().unwrap_or(false);
                        let label = dev["label"].as_str().unwrap_or(name);
                        let mount = dev["mountpoint"].as_str().unwrap_or("");

                        let path = if !mount.is_empty() { mount.to_string() } else { format!("/dev/{}", name) };

                        drives.push(DriveInfo {
                            path,
                            label: label.to_string(),
                            size_bytes,
                            is_removable: rm,
                        });
                    }
                }
            }
        }
    }

    // Always append sentinel file picker card entry
    drives.push(DriveInfo {
        path: "FILE_PICKER".into(),
        label: "Open disk image file...".into(),
        size_bytes: 0,
        is_removable: false,
    });

    Ok(drives)
}

#[tauri::command]
pub async fn start_carving(
    app: tauri::AppHandle,
    input_path: String,
    output_dir: String,
    operator: String,
    _case_id: String,
    vendor_hint: Option<String>,
) -> Result<String, String> {
    let input = Path::new(&input_path);
    if input_path != "FILE_PICKER" && !input.exists() {
        return Err(format!("Input path does not exist: {}", input_path));
    }

    let job_id = Uuid::new_v4().to_string();

    let input_size = fs::metadata(&input_path).map(|m| m.len()).unwrap_or(100_000_000);

    let progress = CarvingProgress {
        status: "running".into(),
        bytes_scanned: 0,
        total_bytes: input_size,
        segments_found: 0,
        current_action: "Initializing forensic carver engine...".into(),
        error_message: None,
    };

    CARVING_JOBS.lock().unwrap().insert(job_id.clone(), progress);

    // Locate sentinel-carver binary
    let resource_dir = app.path().resource_dir().unwrap_or_else(|_| PathBuf::from("."));
    let carver_bin = resource_dir.join("binaries").join("sentinel-carver");
    let carver_bin_exe = carver_bin.with_extension("exe");

    let bin_to_run = if carver_bin.exists() {
        carver_bin
    } else if carver_bin_exe.exists() {
        carver_bin_exe
    } else {
        // Fallback to sentinel-carver binary built in target/debug or PATH
        PathBuf::from("sentinel-carver")
    };

    let job_id_clone = job_id.clone();
    let output_dir_clone = output_dir.clone();

    tokio::spawn(async move {
        let mut cmd = AsyncCommand::new(&bin_to_run);
        cmd.arg("--input").arg(&input_path);
        cmd.arg("--output-dir").arg(&output_dir_clone);
        cmd.arg("--operator").arg(&operator);

        if let Some(hint) = vendor_hint {
            if !hint.is_empty() {
                cmd.arg("--vendor").arg(hint);
            }
        }

        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());

        match cmd.spawn() {
            Ok(mut child) => {
                let stdout = child.stdout.take();
                if let Some(stdout) = stdout {
                    let mut reader = BufReader::new(stdout).lines();
                    let mut scanned = 0u64;
                    let chunk_step = input_size / 20;

                    while let Ok(Some(line)) = reader.next_line().await {
                        scanned = (scanned + chunk_step).min(input_size);
                        let mut jobs = CARVING_JOBS.lock().unwrap();
                        if let Some(p) = jobs.get_mut(&job_id_clone) {
                            p.current_action = line.clone();
                            p.bytes_scanned = scanned;
                            if line.contains("SEGMENT_CARVED") {
                                p.segments_found += 1;
                            }
                        }
                    }
                }

                let status = child.wait().await;
                let mut jobs = CARVING_JOBS.lock().unwrap();
                if let Some(p) = jobs.get_mut(&job_id_clone) {
                    match status {
                        Ok(s) if s.success() => {
                            p.status = "complete".into();
                            p.bytes_scanned = input_size;
                            p.current_action = "Carving complete. Manifest sealed.".into();
                        }
                        Ok(s) => {
                            p.status = "error".into();
                            p.error_message = Some(format!("Process exited with status code: {}", s));
                        }
                        Err(e) => {
                            p.status = "error".into();
                            p.error_message = Some(e.to_string());
                        }
                    }
                }
            }
            Err(e) => {
                let mut jobs = CARVING_JOBS.lock().unwrap();
                if let Some(p) = jobs.get_mut(&job_id_clone) {
                    p.status = "error".into();
                    p.error_message = Some(format!("Failed to spawn sentinel-carver: {}", e));
                }
            }
        }
    });

    Ok(job_id)
}

#[tauri::command]
pub fn get_carving_progress(job_id: String) -> Result<CarvingProgress, String> {
    let jobs = CARVING_JOBS.lock().unwrap();
    if let Some(p) = jobs.get(&job_id) {
        Ok(p.clone())
    } else {
        Err(format!("Job ID not found: {}", job_id))
    }
}

#[tauri::command]
pub fn get_carved_segments(output_dir: String) -> Result<Vec<CarvedSegmentUI>, String> {
    let dir = Path::new(&output_dir);
    let manifest_path = dir.join("manifest.json");

    if !manifest_path.exists() {
        return Ok(Vec::new());
    }

    let file = File::open(&manifest_path).map_err(|e| e.to_string())?;
    let manifest_json: serde_json::Value = serde_json::from_reader(file).map_err(|e| e.to_string())?;

    let mut ui_segments = Vec::new();

    if let Some(segments) = manifest_json["segments"].as_array() {
        for seg in segments {
            let filename = seg["filename"].as_str().unwrap_or("").to_string();
            let local_path = dir.join(&filename).to_string_lossy().to_string();
            let ext = Path::new(&filename)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();

            let can_preview = matches!(ext.as_str(), "mp4" | "mkv" | "avi" | "h264");
            let size_bytes = fs::metadata(&local_path).map(|m| m.len()).unwrap_or(0);

            ui_segments.push(CarvedSegmentUI {
                filename,
                camera_channel: seg["camera_channel"].as_u64().unwrap_or(0) as u8,
                tier_used: seg["tier_used"].as_str().unwrap_or("Unknown").to_string(),
                timestamp_start: seg["timestamp_start"].as_str().map(|s| s.to_string()),
                timestamp_end: seg["timestamp_end"].as_str().map(|s| s.to_string()),
                sha256: seg["sha256"].as_str().unwrap_or("").to_string(),
                md5: seg["md5"].as_str().unwrap_or("").to_string(),
                frame_count: seg["frame_count"].as_u64().unwrap_or(0) as u32,
                is_deleted: seg["is_deleted"].as_bool().unwrap_or(false),
                size_bytes,
                local_path,
                can_preview,
                source: "carved".into(),
            });
        }
    }

    Ok(ui_segments)
}

#[tauri::command]
pub async fn hash_file(file_path: String) -> Result<FileHashResult, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let size_bytes = file.metadata().map_err(|e| e.to_string())?.len();

    let mut sha256_hasher = Sha256::new();
    let mut md5_hasher = Md5::new();
    let mut buffer = [0u8; 65536];

    loop {
        let bytes_read = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if bytes_read == 0 {
            break;
        }
        let chunk = &buffer[..bytes_read];
        sha256_hasher.update(chunk);
        md5_hasher.update(chunk);
    }

    let sha256 = hex::encode(sha256_hasher.finalize());
    let md5 = hex::encode(md5_hasher.finalize());

    Ok(FileHashResult {
        sha256,
        md5,
        size_bytes,
    })
}

#[tauri::command]
pub async fn probe_video(app: tauri::AppHandle, file_path: String) -> Result<VideoProbeResult, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    let resource_dir = app.path().resource_dir().unwrap_or_else(|_| PathBuf::from("."));
    let ffprobe_bin = resource_dir.join("binaries").join("ffprobe");
    let ffprobe_bin_exe = ffprobe_bin.with_extension("exe");

    let bin_to_run = if ffprobe_bin.exists() {
        ffprobe_bin
    } else if ffprobe_bin_exe.exists() {
        ffprobe_bin_exe
    } else {
        PathBuf::from("ffprobe")
    };

    let output = StdCommand::new(&bin_to_run)
        .args([
            "-v", "quiet",
            "-print_format", "json",
            "-show_streams",
            "-show_format",
            &file_path,
        ])
        .output()
        .map_err(|e| format!("Failed to run ffprobe: {}", e))?;

    if !output.status.success() {
        return Err("Not a valid video file".into());
    }

    let json_text = String::from_utf8_lossy(&output.stdout);
    let val: serde_json::Value = serde_json::from_str(&json_text).map_err(|_| "Invalid ffprobe JSON output")?;

    let mut width = 0u32;
    let mut height = 0u32;
    let mut codec = "unknown".to_string();
    let mut frame_rate = 30.0f64;

    if let Some(streams) = val["streams"].as_array() {
        for s in streams {
            if s["codec_type"].as_str() == Some("video") {
                width = s["width"].as_u64().unwrap_or(0) as u32;
                height = s["height"].as_u64().unwrap_or(0) as u32;
                codec = s["codec_name"].as_str().unwrap_or("unknown").to_string();

                if let Some(r_fps) = s["r_frame_rate"].as_str() {
                    let parts: Vec<&str> = r_fps.split('/').collect();
                    if parts.len() == 2 {
                        let num: f64 = parts[0].parse().unwrap_or(30.0);
                        let den: f64 = parts[1].parse().unwrap_or(1.0);
                        if den > 0.0 {
                            frame_rate = num / den;
                        }
                    }
                }
                break;
            }
        }
    }

    let duration_sec = val["format"]["duration"]
        .as_str()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);

    let creation_time = val["format"]["tags"]["creation_time"]
        .as_str()
        .map(|s| s.to_string());

    Ok(VideoProbeResult {
        duration_sec,
        width,
        height,
        codec,
        creation_time,
        frame_rate,
    })
}

#[tauri::command]
pub async fn extract_preview_thumbnail(app: tauri::AppHandle, file_path: String) -> Result<String, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    let resource_dir = app.path().resource_dir().unwrap_or_else(|_| PathBuf::from("."));
    let ffmpeg_bin = resource_dir.join("binaries").join("ffmpeg");
    let ffmpeg_bin_exe = ffmpeg_bin.with_extension("exe");

    let bin_to_run = if ffmpeg_bin.exists() {
        ffmpeg_bin
    } else if ffmpeg_bin_exe.exists() {
        ffmpeg_bin_exe
    } else {
        PathBuf::from("ffmpeg")
    };

    let output = StdCommand::new(&bin_to_run)
        .args([
            "-i", &file_path,
            "-frames:v", "1",
            "-q:v", "2",
            "-f", "image2",
            "pipe:1",
        ])
        .output()
        .map_err(|e| format!("Failed to extract preview thumbnail: {}", e))?;

    if !output.status.success() || output.stdout.is_empty() {
        return Err("Cannot extract thumbnail from this file".into());
    }

    let b64 = base64::engine::general_purpose::STANDARD.encode(&output.stdout);
    Ok(b64)
}

#[tauri::command]
pub async fn upload_evidence(
    manifest_path: String,
    output_dir: String,
    api_base_url: String,
    platform_jwt: String,
) -> Result<UploadResult, String> {
    let manifest_p = Path::new(&manifest_path);
    if !manifest_p.exists() {
        return Err(format!("Manifest file not found: {}", manifest_path));
    }

    let start_time = Instant::now();

    let file = File::open(manifest_p).map_err(|e| e.to_string())?;
    let manifest_json: serde_json::Value = serde_json::from_reader(file).map_err(|e| e.to_string())?;

    let mut segment_paths = Vec::new();
    if let Some(segments) = manifest_json["segments"].as_array() {
        for seg in segments {
            if let Some(fname) = seg["filename"].as_str() {
                segment_paths.push(Path::new(&output_dir).join(fname));
            }
        }
    }

    let count = segment_paths.len() as u32;

    sentinel_carver::api_client::upload_evidence(
        &api_base_url,
        manifest_p,
        &segment_paths,
        Some(&platform_jwt),
    )
    .map_err(|e| format!("Evidence upload failed: {}", e))?;

    let duration = start_time.elapsed().as_secs_f64();
    let case_id = manifest_json["case_id"].as_str().unwrap_or("").to_string();
    let platform_url = std::env::var("SENTINELFS_PLATFORM_URL")
        .unwrap_or_else(|_| "https://sentinelfs.app".to_string());
    let case_url = format!("{}/cases/{}", platform_url.trim_end_matches('/'), case_id);

    Ok(UploadResult {
        success: true,
        case_url,
        segments_uploaded: count,
        upload_duration_sec: duration,
    })
}
