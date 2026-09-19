use reqwest::blocking::multipart::{Form, Part};
use reqwest::blocking::Client;
use std::fs;
use std::path::{Path, PathBuf};

pub fn upload_evidence(
    api_url:       &str,
    manifest_path: &Path,
    segment_paths: &[PathBuf],
) -> Result<(), Box<dyn std::error::Error>> {
    let mut form = Form::new();

    let manifest_bytes = fs::read(manifest_path)?;
    let manifest_part = Part::bytes(manifest_bytes)
        .file_name("manifest.json")
        .mime_str("application/json")?;
    form = form.part("manifest", manifest_part);

    for path in segment_paths {
        if path.exists() {
            let file_name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("segment.bin")
                .to_string();

            let part = Part::file(path)?
                .file_name(file_name)
                .mime_str("application/octet-stream")?;

            form = form.part("segment", part);
        }
    }

    let target_url = format!("{}/api/v1/evidence/ingest", api_url.trim_end_matches('/'));
    let client = Client::new();
    let response = client.post(&target_url).multipart(form).send()?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().unwrap_or_default();
        return Err(format!("API Upload Failed with HTTP {}: {}", status, text).into());
    }

    Ok(())
}
