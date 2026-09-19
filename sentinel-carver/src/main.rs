mod api_client;
mod audit_log;
mod carvers;
mod device_id;
mod hasher;
mod manifest;

use std::fs::{self, File};
use std::path::PathBuf;
use clap::Parser;
use memmap2::MmapOptions;

use api_client::upload_evidence;
use audit_log::AuditLedger;
use carvers::dahua::DahuaCarver;
use carvers::generic::GenericCarver;
use carvers::hikvision::HikvisionCarver;
use carvers::Carver;
use device_id::{detect_vendor, VendorTier};
use hasher::DualHasher;
use manifest::EvidenceManifest;

#[derive(Parser, Debug)]
#[command(author, version, about = "SentinelFS Forensic Carver Engine - BSA Section 63 Compliant")]
struct Cli {
    /// Input raw disk or bit-stream image (.dd, .raw)
    #[arg(short, long)]
    input: PathBuf,

    /// Output directory for carved evidence
    #[arg(short, long, default_value = "./carved_evidence")]
    output_dir: PathBuf,

    /// Override auto-vendor detection (dhav | hikvision | generic)
    #[arg(short, long)]
    vendor: Option<String>,

    /// Operator name for chain of custody record
    #[arg(long, default_value = "Forensic Operator")]
    operator: String,

    /// FastAPI endpoint URL for automatic evidence upload
    #[arg(long)]
    upload: Option<String>,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();

    if !cli.input.exists() {
        return Err(format!("Input file standard path does not exist: {:?}", cli.input).into());
    }

    // 1. Create output_dir if missing
    fs::create_dir_all(&cli.output_dir)?;

    // 2. Initialize AuditLedger (genesis block / DRIVE_MOUNTED)
    let mut audit_ledger = AuditLedger::new(&cli.output_dir)?;

    // 3. Open input file read-only and memory map it
    let file = File::open(&cli.input)?;
    let mmap = unsafe { MmapOptions::new().map(&file)? };

    // 4. Hash entire source image with DualHasher -> log SOURCE_HASHED
    let mut source_hasher = DualHasher::new();
    source_hasher.update(&mmap);
    let (source_sha256, source_md5) = source_hasher.finalize();

    audit_ledger.log(
        "SOURCE_HASHED",
        &format!("SHA256: {} | MD5: {}", source_sha256, source_md5),
    )?;

    // 5. Detect vendor or use override flag
    let vendor_detected = match cli.vendor.as_deref().map(|s| s.to_lowercase()).as_deref() {
        Some("dhav") | Some("dahua") => VendorTier::Dhav,
        Some("hikvision") | Some("hik") => VendorTier::Hikvision,
        Some("generic") => VendorTier::Generic,
        _ => detect_vendor(&mmap).tier,
    };

    audit_ledger.log(
        "VENDOR_DETECTED",
        &format!("Vendor Tier Selected: {}", vendor_detected),
    )?;

    // 6. Dispatch to appropriate Carver implementation
    let mut segments;
    let mut active_tier = vendor_detected.clone();

    match active_tier {
        VendorTier::Dhav => {
            let carver = DahuaCarver;
            segments = carver.carve(&mmap, &cli.output_dir)?;
        }
        VendorTier::Hikvision => {
            let carver = HikvisionCarver;
            segments = carver.carve(&mmap, &cli.output_dir)?;

            // Hikvision Fallback Rule: If 0x000001BA produces zero segments, fallback to Generic
            if segments.is_empty() {
                audit_ledger.log(
                    "CARVER_FALLBACK",
                    "Hikvision 0x000001BA scanning yielded 0 segments. Falling back to Generic NAL carver.",
                )?;
                eprintln!("[WARNING] Hikvision carver produced 0 segments. Falling back to Generic NAL Carver...");

                let generic_carver = GenericCarver;
                segments = generic_carver.carve(&mmap, &cli.output_dir)?;
                active_tier = VendorTier::Generic;
            }
        }
        VendorTier::Generic => {
            let carver = GenericCarver;
            segments = carver.carve(&mmap, &cli.output_dir)?;
        }
    }

    if segments.is_empty() {
        eprintln!("[WARNING] Zero video segments were carved from the input evidence.");
    }

    // 7. Log carved segments
    for seg in &segments {
        audit_ledger.log(
            "SEGMENT_CARVED",
            &format!(
                "File: {} | Start: {} | End: {} | SHA256: {}",
                seg.filename, seg.byte_offset_start, seg.byte_offset_end, seg.sha256
            ),
        )?;
    }

    // 8. Build EvidenceManifest and save to manifest.json
    let manifest_path = cli.output_dir.join("manifest.json");
    let manifest = EvidenceManifest::new(
        cli.input.to_string_lossy().to_string(),
        source_sha256.clone(),
        source_md5.clone(),
        active_tier.to_string(),
        segments.clone(),
        cli.operator.clone(),
    );

    manifest.save(&manifest_path)?;
    audit_ledger.log("MANIFEST_SEALED", &format!("Manifest saved to {:?}", manifest_path))?;

    // 9. Verify Audit Ledger integrity
    let is_verified = audit_ledger.verify_integrity();

    // 10. If --upload flag provided, send evidence to API
    if let Some(upload_url) = &cli.upload {
        audit_ledger.log("UPLOAD_INITIATED", &format!("Target: {}", upload_url))?;
        println!("[INFO] Uploading evidence to API endpoint: {}...", upload_url);

        let segment_paths: Vec<PathBuf> = segments
            .iter()
            .map(|s| cli.output_dir.join(&s.filename))
            .collect();

        match upload_evidence(upload_url, &manifest_path, &segment_paths) {
            Ok(_) => {
                audit_ledger.log("UPLOAD_COMPLETE", "Upload succeeded with HTTP 200 OK")?;
                println!("[SUCCESS] Evidence package successfully ingested by API.");
            }
            Err(e) => {
                audit_ledger.log("UPLOAD_FAILED", &format!("Error: {}", e))?;
                eprintln!("[ERROR] Failed to upload evidence package: {}", e);
            }
        }
    }

    // 11. Print Terminal Summary Report
    println!("\n========================================================");
    println!("      SENTINEL-CARVER FORENSIC ACQUISITION REPORT       ");
    println!("========================================================");
    println!("Source Path:        {}", cli.input.display());
    println!("Source SHA-256:     {}", source_sha256);
    println!("Source MD5:         {}", source_md5);
    println!("Vendor Detected:    {}", active_tier);
    println!("Segments Carved:    {}", segments.len());
    println!(
        "Audit Ledger:       {}",
        if is_verified { "Verified (UNBROKEN)" } else { "Broken (INVALID)" }
    );
    println!(
        "BSA Sec 63 Status:  {}",
        if is_verified { "COMPLIANT" } else { "NON-COMPLIANT" }
    );
    println!("========================================================\n");

    Ok(())
}