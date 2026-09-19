use md5::Md5;
use sha2::{Digest, Sha256};

pub struct DualHasher {
    sha256: Sha256,
    md5: Md5,
    bytes_processed: u64,
}

impl DualHasher {
    pub fn new() -> Self {
        Self {
            sha256: Sha256::new(),
            md5: Md5::new(),
            bytes_processed: 0,
        }
    }

    /// Feeds the same byte slice to both digests in a single pass.
    pub fn update(&mut self, data: &[u8]) {
        self.sha256.update(data);
        self.md5.update(data);
        self.bytes_processed += data.len() as u64;
    }

    #[allow(dead_code)]
    pub fn bytes_processed(&self) -> u64 {
        self.bytes_processed
    }

    /// Finalizes both hashes and returns (sha256_hex, md5_hex).
    pub fn finalize(self) -> (String, String) {
        let sha256_res = self.sha256.finalize();
        let md5_res = self.md5.finalize();

        (hex::encode(sha256_res), hex::encode(md5_res))
    }
}

impl Default for DualHasher {
    fn default() -> Self {
        Self::new()
    }
}
