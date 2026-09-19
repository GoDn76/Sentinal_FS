use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use chrono::Utc;
use sha2::{Digest, Sha256};

const GENESIS_PREV_HASH: &str = "0000000000000000000000000000000000000000000000000000000000000000";

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AuditEntry {
    pub sequence:            u64,
    pub timestamp:           String,
    pub action:              String,
    pub data_hash:           String,
    pub previous_block_hash: String,
    pub current_block_hash:  String,
}

pub struct AuditLedger {
    log_path: PathBuf,
    sequence: u64,
    last_block_hash: String,
}

impl AuditLedger {
    pub fn new(output_dir: &Path) -> Result<Self, Box<dyn std::error::Error>> {
        let log_path = output_dir.join("audit_trail.jsonl");

        if log_path.exists() {
            let file = File::open(&log_path)?;
            let reader = BufReader::new(file);
            let mut last_seq = 0;
            let mut last_hash = GENESIS_PREV_HASH.to_string();

            for line in reader.lines() {
                let line_str = line?;
                if line_str.trim().is_empty() {
                    continue;
                }
                let entry: AuditEntry = serde_json::from_str(&line_str)?;
                last_seq = entry.sequence + 1;
                last_hash = entry.current_block_hash;
            }

            Ok(Self {
                log_path,
                sequence: last_seq,
                last_block_hash: last_hash,
            })
        } else {
            let mut ledger = Self {
                log_path,
                sequence: 0,
                last_block_hash: GENESIS_PREV_HASH.to_string(),
            };
            ledger.log("DRIVE_MOUNTED", "Initial acquisition ledger initialized")?;
            Ok(ledger)
        }
    }

    pub fn log(&mut self, action: &str, data: &str) -> Result<(), Box<dyn std::error::Error>> {
        let timestamp = Utc::now().to_rfc3339();

        let mut data_hasher = Sha256::new();
        data_hasher.update(data.as_bytes());
        let data_hash = hex::encode(data_hasher.finalize());

        let previous_block_hash = self.last_block_hash.clone();

        let hash_input = format!(
            "{}{}{}{}{}",
            self.sequence, timestamp, action, data_hash, previous_block_hash
        );

        let mut block_hasher = Sha256::new();
        block_hasher.update(hash_input.as_bytes());
        let current_block_hash = hex::encode(block_hasher.finalize());

        let entry = AuditEntry {
            sequence: self.sequence,
            timestamp,
            action: action.to_string(),
            data_hash,
            previous_block_hash,
            current_block_hash: current_block_hash.clone(),
        };

        let json_line = serde_json::to_string(&entry)?;
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.log_path)?;

        writeln!(file, "{}", json_line)?;

        self.sequence += 1;
        self.last_block_hash = current_block_hash;

        Ok(())
    }

    pub fn verify_integrity(&self) -> bool {
        if !self.log_path.exists() {
            return false;
        }

        let file = match File::open(&self.log_path) {
            Ok(f) => f,
            Err(_) => return false,
        };

        let reader = BufReader::new(file);
        let mut expected_seq = 0u64;
        let mut expected_prev_hash = GENESIS_PREV_HASH.to_string();

        for line in reader.lines() {
            let line_str = match line {
                Ok(l) => l,
                Err(_) => return false,
            };

            if line_str.trim().is_empty() {
                continue;
            }

            let entry: AuditEntry = match serde_json::from_str(&line_str) {
                Ok(e) => e,
                Err(_) => return false,
            };

            if entry.sequence != expected_seq {
                return false;
            }

            if entry.previous_block_hash != expected_prev_hash {
                return false;
            }

            let hash_input = format!(
                "{}{}{}{}{}",
                entry.sequence,
                entry.timestamp,
                entry.action,
                entry.data_hash,
                entry.previous_block_hash
            );

            let mut block_hasher = Sha256::new();
            block_hasher.update(hash_input.as_bytes());
            let computed_hash = hex::encode(block_hasher.finalize());

            if entry.current_block_hash != computed_hash {
                return false;
            }

            expected_seq += 1;
            expected_prev_hash = entry.current_block_hash;
        }

        true
    }
}
