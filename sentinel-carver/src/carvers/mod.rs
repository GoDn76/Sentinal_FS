pub mod dahua;
pub mod generic;
pub mod hikvision;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CarvedSegment {
    pub filename:            String,
    pub camera_channel:      u8,
    pub tier_used:           String,
    pub byte_offset_start:   usize,
    pub byte_offset_end:     usize,
    pub timestamp_start:     Option<String>,   // ISO 8601 or None
    pub timestamp_end:       Option<String>,
    pub sha256:              String,
    pub md5:                 String,
    pub frame_count:         u32,
    pub is_deleted:          bool,
    pub recovery_confidence: String,           // "high" | "medium" | "low"
}

pub trait Carver {
    fn carve(
        &self,
        mmap:       &[u8],
        output_dir: &std::path::Path,
    ) -> Result<Vec<CarvedSegment>, Box<dyn std::error::Error>>;
}