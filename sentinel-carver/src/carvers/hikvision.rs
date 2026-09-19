use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::Path;
use crate::carvers::{Carver, CarvedSegment};
use crate::hasher::DualHasher;

pub struct HikvisionCarver;

impl HikvisionCarver {
    pub fn scan_master_sector(mmap: &[u8]) -> Option<usize> {
        let scan_len = usize::min(mmap.len(), 64 * 1024 * 1024);
        let pattern = b"HIKVISION@HANGZHOU";
        if scan_len < pattern.len() {
            return None;
        }

        for i in 0..=scan_len - pattern.len() {
            if &mmap[i..i + pattern.len()] == pattern {
                return Some(i);
            }
        }
        None
    }

    fn parse_scr(pack_header: &[u8]) -> Option<u64> {
        if pack_header.len() < 10 {
            return None;
        }
        let b4 = pack_header[4] as u64;
        let b5 = pack_header[5] as u64;
        let b6 = pack_header[6] as u64;
        let b7 = pack_header[7] as u64;
        let b8 = pack_header[8] as u64;

        let scr_32_30 = (b4 >> 3) & 0x07;
        let scr_29_15 = ((b4 & 0x03) << 13) | (b5 << 5) | ((b6 >> 3) & 0x1F);
        let scr_14_0  = ((b6 & 0x03) << 13) | (b7 << 5) | ((b8 >> 3) & 0x1F);

        let scr = (scr_32_30 << 28) | (scr_29_15 << 15) | scr_14_0;
        Some(scr)
    }
}

impl Carver for HikvisionCarver {
    fn carve(
        &self,
        mmap: &[u8],
        output_dir: &Path,
    ) -> Result<Vec<CarvedSegment>, Box<dyn std::error::Error>> {
        let mut segments = Vec::new();
        let mut stream_idx = 0;
        let mut pos = 0;

        // Log master signature offset if present
        let _master_offset = Self::scan_master_sector(mmap);

        while pos + 14 <= mmap.len() {
            // 1. Signature Scan: MPEG-PS Pack Header [0x00, 0x00, 0x01, 0xBA]
            if &mmap[pos..pos + 4] != [0x00, 0x00, 0x01, 0xBA] {
                pos += 1;
                continue;
            }

            // 2. Validation: Top 2 bits of byte 4 must be 01 -> (mmap[pos + 4] >> 6) == 1
            if (mmap[pos + 4] >> 6) != 1 {
                pos += 1;
                continue;
            }

            // Read pack stuffing length: mmap[pos + 13] & 0x07
            let stuffing_length = (mmap[pos + 13] & 0x07) as usize;
            let pack_header_len = 14 + stuffing_length;

            if pos + pack_header_len > mmap.len() {
                pos += 1;
                continue;
            }

            // 3. Open output file for carved stream
            let filename = format!("recovered_hik_stream_{:03}.mp4", stream_idx);
            let file_path = output_dir.join(&filename);
            let file = File::create(file_path)?;
            let mut writer = BufWriter::new(file);
            let mut hasher = DualHasher::new();

            let byte_offset_start = pos;
            let mut frame_count = 0u32;

            let first_scr = Self::parse_scr(&mmap[pos..pos + pack_header_len]);
            let mut last_scr = first_scr;

            let mut current_pos = pos;

            // 4. Continuously carve Pack Header and subsequent PES packets
            while current_pos + 4 <= mmap.len() {
                if &mmap[current_pos..current_pos + 4] == [0x00, 0x00, 0x01, 0xBA] {
                    // Pack Header
                    if current_pos + 14 > mmap.len() {
                        break;
                    }
                    if (mmap[current_pos + 4] >> 6) != 1 {
                        break;
                    }
                    let stuff = (mmap[current_pos + 13] & 0x07) as usize;
                    let h_len = 14 + stuff;
                    if current_pos + h_len > mmap.len() {
                        break;
                    }

                    if let Some(scr) = Self::parse_scr(&mmap[current_pos..current_pos + h_len]) {
                        last_scr = Some(scr);
                    }

                    let chunk = &mmap[current_pos..current_pos + h_len];
                    writer.write_all(chunk)?;
                    hasher.update(chunk);
                    frame_count += 1;
                    current_pos += h_len;
                } else if &mmap[current_pos..current_pos + 3] == [0x00, 0x00, 0x01] {
                    // PES Packet or Program End Code
                    let stream_id = mmap[current_pos + 3];
                    if stream_id == 0xB9 {
                        // MPEG_PROGRAM_END_CODE
                        let chunk = &mmap[current_pos..current_pos + 4];
                        writer.write_all(chunk)?;
                        hasher.update(chunk);
                        current_pos += 4;
                        break;
                    }

                    if current_pos + 6 > mmap.len() {
                        break;
                    }

                    let pes_len = u16::from_be_bytes([mmap[current_pos + 4], mmap[current_pos + 5]]) as usize;
                    let pkt_len = if pes_len > 0 {
                        6 + pes_len
                    } else {
                        // Unspecified video PES length -> scan to next 0x000001
                        let mut end = current_pos + 6;
                        while end + 3 <= mmap.len() && &mmap[end..end + 3] != [0x00, 0x00, 0x01] {
                            end += 1;
                        }
                        end - current_pos
                    };

                    if current_pos + pkt_len > mmap.len() {
                        break;
                    }

                    let chunk = &mmap[current_pos..current_pos + pkt_len];
                    writer.write_all(chunk)?;
                    hasher.update(chunk);
                    current_pos += pkt_len;
                } else {
                    // 5. Gap Detection: non-MPEG-PS bytes -> break stream loop
                    break;
                }
            }

            writer.flush()?;
            let (sha256, md5) = hasher.finalize();
            let byte_offset_end = current_pos;

            let timestamp_start = first_scr.map(|s| format!("SCR:{}", s));
            let timestamp_end = last_scr.map(|s| format!("SCR:{}", s));

            segments.push(CarvedSegment {
                filename,
                camera_channel: 1,
                tier_used: "Hikvision".to_string(),
                byte_offset_start,
                byte_offset_end,
                timestamp_start,
                timestamp_end,
                sha256,
                md5,
                frame_count,
                is_deleted: false,
                recovery_confidence: "high".to_string(),
            });

            stream_idx += 1;
            pos = usize::max(current_pos, pos + 1);
        }

        // 6. Fallback Safe: Return Ok(vec![]) if zero segments found
        Ok(segments)
    }
}
