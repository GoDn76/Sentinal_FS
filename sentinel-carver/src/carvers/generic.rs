use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::Path;
use crate::carvers::{Carver, CarvedSegment};
use crate::hasher::DualHasher;

pub struct GenericCarver;

impl GenericCarver {
    /// Helper to find the next Annex B start code `[0, 0, 0, 1]` (4 bytes) or `[0, 0, 1]` (3 bytes).
    fn find_next_start_code(mmap: &[u8], from: usize) -> Option<(usize, usize)> {
        let mut idx = from;
        while idx + 3 <= mmap.len() {
            if idx + 4 <= mmap.len() && &mmap[idx..idx + 4] == [0, 0, 0, 1] {
                return Some((idx, 4));
            }
            if &mmap[idx..idx + 3] == [0, 0, 1] {
                return Some((idx, 3));
            }
            idx += 1;
        }
        None
    }
}

impl Carver for GenericCarver {
    fn carve(
        &self,
        mmap: &[u8],
        output_dir: &Path,
    ) -> Result<Vec<CarvedSegment>, Box<dyn std::error::Error>> {
        let mut segments = Vec::new();
        let mut stream_idx = 0;
        let mut pos = 0;

        while pos + 5 <= mmap.len() {
            // 1. Signature Scan: 4-byte Annex B start code [0x00, 0x00, 0x00, 0x01]
            if &mmap[pos..pos + 4] != [0x00, 0x00, 0x00, 0x01] {
                pos += 1;
                continue;
            }

            // 2. NAL Unit Classification: nal_type = mmap[pos + 4] & 0x1F
            let nal_type = mmap[pos + 4] & 0x1F;

            // 3. Carving Rule: Do NOT start writing until SPS (nal_type == 7) is detected
            if nal_type != 7 {
                pos += 1;
                continue;
            }

            // Open new output file: generic_nal_stream_{idx:03}.h264
            let filename = format!("generic_nal_stream_{:03}.h264", stream_idx);
            let file_path = output_dir.join(&filename);
            let file = File::create(file_path)?;
            let mut writer = BufWriter::new(file);
            let mut hasher = DualHasher::new();

            let byte_offset_start = pos;
            let mut frame_count = 0u32;
            let mut current_pos = pos;

            // 4. Carve NAL units continuously
            while current_pos < mmap.len() {
                match Self::find_next_start_code(mmap, current_pos + 4) {
                    Some((next_start, _prefix_len)) => {
                        let nal_len = next_start - current_pos;

                        // Check gap size: bytes between current_pos and next_start
                        let chunk = &mmap[current_pos..next_start];
                        writer.write_all(chunk)?;
                        hasher.update(chunk);

                        let unit_type = if current_pos + 4 < mmap.len() {
                            mmap[current_pos + 4] & 0x1F
                        } else {
                            0
                        };
                        if unit_type == 1 || unit_type == 5 {
                            frame_count += 1;
                        }

                        // Stream Termination: gap > 4096 bytes without valid NAL start code
                        if nal_len > 4096 + 65536 {
                            current_pos = next_start;
                            break;
                        }

                        current_pos = next_start;
                    }
                    None => {
                        let remaining = &mmap[current_pos..];
                        if remaining.len() <= 4096 {
                            writer.write_all(remaining)?;
                            hasher.update(remaining);
                            frame_count += 1;
                        }
                        current_pos = mmap.len();
                        break;
                    }
                }
            }

            writer.flush()?;
            let (sha256, md5) = hasher.finalize();
            let byte_offset_end = current_pos;

            segments.push(CarvedSegment {
                filename,
                camera_channel: 1,
                tier_used: "Generic (Annex B)".to_string(),
                byte_offset_start,
                byte_offset_end,
                timestamp_start: None,
                timestamp_end: None,
                sha256,
                md5,
                frame_count,
                is_deleted: false,
                recovery_confidence: "medium".to_string(),
            });

            stream_idx += 1;
            pos = usize::max(current_pos, pos + 1);
        }

        Ok(segments)
    }
}
