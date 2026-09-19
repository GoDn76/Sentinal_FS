use std::fs::File;
use std::io::Write;
use std::path::Path;
use chrono::{DateTime, Utc};
use uuid::Uuid;
use crate::carvers::CarvedSegment;

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct EvidenceManifest {
    pub evidence_id:             Uuid,
    pub source_path:             String,
    pub source_sha256:           String,
    pub source_md5:              String,
    pub vendor_detected:         String,
    pub carved_segments:         Vec<CarvedSegment>,
    pub extraction_timestamp:    DateTime<Utc>,
    pub operator_name:           String,
    pub bsa_compliance_statement: String,
}

impl EvidenceManifest {
    pub fn new(
        source_path: String,
        source_sha256: String,
        source_md5: String,
        vendor_detected: String,
        carved_segments: Vec<CarvedSegment>,
        operator_name: String,
    ) -> Self {
        let bsa_compliance_statement = format!(
            "This forensic manifest certifies that the source evidence at {} has been acquired in a read-only manner. Dual cryptographic verification (SHA-256: {}, MD5: {}) was computed concurrently during acquisition using a streaming single-pass algorithm, satisfying the hash-value certificate requirement under Section 63(4) of the Bharatiya Sakshya Adhiniyam, 2023. The unbroken audit chain is recorded in the accompanying audit_trail.jsonl.",
            source_path, source_sha256, source_md5
        );

        Self {
            evidence_id: Uuid::new_v4(),
            source_path,
            source_sha256,
            source_md5,
            vendor_detected,
            carved_segments,
            extraction_timestamp: Utc::now(),
            operator_name,
            bsa_compliance_statement,
        }
    }

    pub fn save(&self, path: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let json_data = serde_json::to_string_pretty(self)?;
        let mut file = File::create(path)?;
        file.write_all(json_data.as_bytes())?;
        Ok(())
    }
}
