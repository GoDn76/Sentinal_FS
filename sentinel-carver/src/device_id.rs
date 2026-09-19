use std::fmt;

#[derive(Debug, PartialEq, Eq, Clone, serde::Serialize, serde::Deserialize)]
pub enum VendorTier {
    Dhav,       // Dahua, CP Plus, Honeywell
    Hikvision,  // Hikvision (Godrej: treat as Hikvision-lineage)
    Generic,    // Uniview, Matrix, TP-Link, unknown, or corrupted
}

impl fmt::Display for VendorTier {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            VendorTier::Dhav => write!(f, "Dhav"),
            VendorTier::Hikvision => write!(f, "Hikvision"),
            VendorTier::Generic => write!(f, "Generic"),
        }
    }
}

#[allow(dead_code)]
pub struct DetectedVendor {
    pub tier:            VendorTier,
    pub signature_found: String,
    pub first_offset:    usize,
}

pub fn detect_vendor(mmap: &[u8]) -> DetectedVendor {
    let scan_len = usize::min(mmap.len(), 64 * 1024 * 1024);

    let mut first_dhav: Option<(usize, String)> = None;
    let mut first_hik: Option<(usize, String)> = None;

    let dhav_pat1 = b"DHAV";
    let dhav_pat2 = b"DHFS";
    let hik_pat1 = b"HIKVISION@HANGZHOU";
    let hik_pat2 = [0x00, 0x00, 0x01, 0xBA];

    let mut i = 0;
    while i < scan_len {
        // Check Dahua / DHAV signatures
        if first_dhav.is_none() {
            if i + 4 <= scan_len && &mmap[i..i + 4] == dhav_pat1 {
                first_dhav = Some((i, "DHAV".to_string()));
            } else if i + 4 <= scan_len && &mmap[i..i + 4] == dhav_pat2 {
                first_dhav = Some((i, "DHFS".to_string()));
            }
        }

        // Check Hikvision signatures
        if first_hik.is_none() {
            if i + hik_pat1.len() <= scan_len && &mmap[i..i + hik_pat1.len()] == hik_pat1 {
                first_hik = Some((i, "HIKVISION@HANGZHOU".to_string()));
            } else if i + 4 <= scan_len && &mmap[i..i + 4] == hik_pat2 {
                // Check top 2 bits of pack header
                if (mmap[i + 4] & 0xC0) == 0x40 {
                    first_hik = Some((i, "MPEG-PS (0x000001BA)".to_string()));
                }
            }
        }

        if first_dhav.is_some() && first_hik.is_some() {
            break;
        }

        i += 1;
    }

    // Priority order: Dhav > Hikvision > Generic
    if let Some((offset, sig)) = first_dhav {
        DetectedVendor {
            tier: VendorTier::Dhav,
            signature_found: sig,
            first_offset: offset,
        }
    } else if let Some((offset, sig)) = first_hik {
        DetectedVendor {
            tier: VendorTier::Hikvision,
            signature_found: sig,
            first_offset: offset,
        }
    } else {
        DetectedVendor {
            tier: VendorTier::Generic,
            signature_found: "None".to_string(),
            first_offset: 0,
        }
    }
}
