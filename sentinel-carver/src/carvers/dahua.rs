use std::collections::HashMap;
use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::Path;
use crate::carvers::{Carver, CarvedSegment};
use crate::hasher::DualHasher;

pub struct DahuaCarver;

struct ActiveStream {
    writer: BufWriter<File>,
    hasher: DualHasher,
    frame_count: u32,
    byte_offset_start: usize,
    byte_offset_end: usize,
    timestamp_first: Option<String>,
    timestamp_last: Option<String>,
}

fn unpack_date(date: u32) -> Option<String> {
    let sec   =  date        & 0x3F;          // bits  5:0  (6 bits)
    let min   = (date >>  6) & 0x3F;          // bits 11:6  (6 bits)
    let hour  = (date >> 12) & 0x1F;          // bits 16:12 (5 bits)
    let day   = (date >> 17) & 0x1F;          // bits 21:17 (5 bits)
    let month = (date >> 22) & 0x0F;          // bits 25:22 (4 bits)
    let year  = ((date >> 26) & 0x3F) + 2000; // bits 31:26 (6 bits)

    if month >= 1 && month <= 12 && day >= 1 && day <= 31 && hour < 24 && min < 60 && sec < 60 {
        Some(format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", year, month, day, hour, min, sec))
    } else {
        None
    }
}

impl Carver for DahuaCarver {
    fn carve(
        &self,
        mmap: &[u8],
        output_dir: &Path,
    ) -> Result<Vec<CarvedSegment>, Box<dyn std::error::Error>> {
        let mut streams: HashMap<u8, ActiveStream> = HashMap::new();
        let mut pos = 0;

        while pos + 4 <= mmap.len() {
            if &mmap[pos..pos + 4] != b"DHAV" {
                pos += 1;
                continue;
            }

            // Safety check 1: header reading bounds
            if pos + 24 > mmap.len() {
                pos += 1;
                continue;
            }

            let type_marker = mmap[pos + 4];
            let channel_id = mmap[pos + 6];

            let frame_length_bytes: [u8; 4] = match mmap[pos + 12..pos + 16].try_into() {
                Ok(b) => b,
                Err(_) => {
                    pos += 1;
                    continue;
                }
            };
            let frame_length = u32::from_le_bytes(frame_length_bytes) as usize;

            // Safety check 2: Basic validation on frame length
            if frame_length < 24 || frame_length > 10_000_000 {
                pos += 1;
                continue;
            }

            let chunk_size = frame_length - 8;

            // Safety check 3: Ensure total chunk fits in mmap
            if pos + chunk_size > mmap.len() {
                pos += 1;
                continue;
            }

            let ext_length = mmap[pos + 22] as usize;

            // Safety check 4: Header + extension check
            if 24 + ext_length > chunk_size {
                pos += 1;
                continue;
            }

            // Parse timestamp
            let date_bytes: [u8; 4] = match mmap[pos + 16..pos + 20].try_into() {
                Ok(b) => b,
                Err(_) => [0, 0, 0, 0],
            };
            let date_val = u32::from_le_bytes(date_bytes);
            let timestamp_str = unpack_date(date_val);

            // 0xf1 = index/metadata frame (skip payload, do not carve into stream)
            if type_marker != 0xf1 {
                let chunk_bytes = &mmap[pos..pos + chunk_size];

                let stream = match streams.get_mut(&channel_id) {
                    Some(s) => s,
                    None => {
                        let filename = format!("recovered_cam_{:02}.dav", channel_id);
                        let file_path = output_dir.join(&filename);
                        let file = File::create(file_path)?;
                        let writer = BufWriter::new(file);

                        streams.insert(
                            channel_id,
                            ActiveStream {
                                writer,
                                hasher: DualHasher::new(),
                                frame_count: 0,
                                byte_offset_start: pos,
                                byte_offset_end: pos + chunk_size,
                                timestamp_first: timestamp_str.clone(),
                                timestamp_last: timestamp_str.clone(),
                            },
                        );
                        streams.get_mut(&channel_id).unwrap()
                    }
                };

                stream.writer.write_all(chunk_bytes)?;
                stream.hasher.update(chunk_bytes);
                stream.frame_count += 1;
                stream.byte_offset_end = pos + chunk_size;

                if stream.timestamp_first.is_none() && timestamp_str.is_some() {
                    stream.timestamp_first = timestamp_str.clone();
                }
                if timestamp_str.is_some() {
                    stream.timestamp_last = timestamp_str;
                }
            }

            // Advance scan position by exactly frame_length - 8
            pos += chunk_size;
        }

        let mut segments = Vec::new();

        for (channel_id, mut stream) in streams {
            stream.writer.flush()?;
            let (sha256, md5) = stream.hasher.finalize();
            let filename = format!("recovered_cam_{:02}.dav", channel_id);

            segments.push(CarvedSegment {
                filename,
                camera_channel: channel_id,
                tier_used: "Dhav".to_string(),
                byte_offset_start: stream.byte_offset_start,
                byte_offset_end: stream.byte_offset_end,
                timestamp_start: stream.timestamp_first,
                timestamp_end: stream.timestamp_last,
                sha256,
                md5,
                frame_count: stream.frame_count,
                is_deleted: false,
                recovery_confidence: "high".to_string(),
            });
        }

        segments.sort_by_key(|s| s.camera_channel);
        Ok(segments)
    }
}
