// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use tauri::Manager;
use commands::*;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let resource_dir = app.path().resource_dir().unwrap_or_default();
            let binaries_dir = resource_dir.join("binaries");

            let carver = binaries_dir.join("sentinel-carver").with_extension(std::env::consts::EXE_EXTENSION);
            let ffmpeg = binaries_dir.join("ffmpeg").with_extension(std::env::consts::EXE_EXTENSION);
            let ffprobe = binaries_dir.join("ffprobe").with_extension(std::env::consts::EXE_EXTENSION);

            println!("[INFO] Verifying external bundled binaries...");
            println!("[INFO] sentinel-carver: {:?}", carver.exists());
            println!("[INFO] ffmpeg: {:?}", ffmpeg.exists());
            println!("[INFO] ffprobe: {:?}", ffprobe.exists());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            generate_claim_token,
            poll_claim_status,
            list_drives,
            start_carving,
            get_carving_progress,
            get_carved_segments,
            hash_file,
            probe_video,
            extract_preview_thumbnail,
            upload_evidence
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
