use std::fs;
use std::path::Path;

fn main() {
    // Re-run build.rs if sentinel-carver source files change
    println!("cargo:rerun-if-changed=../../sentinel-carver/src");

    let source_bin = Path::new("../../target/debug/sentinel-carver.exe");
    let fallback_bin = Path::new("../../sentinel-carver/target/debug/sentinel-carver.exe");

    let target_bin = Path::new("binaries/sentinel-carver-x86_64-pc-windows-msvc.exe");
    let target_simple_bin = Path::new("binaries/sentinel-carver.exe");

    if let Ok(binaries_dir) = Path::new("binaries").canonicalize() {
        let _ = fs::create_dir_all(&binaries_dir);
    }

    if source_bin.exists() {
        let _ = fs::copy(source_bin, target_bin);
        let _ = fs::copy(source_bin, target_simple_bin);
    } else if fallback_bin.exists() {
        let _ = fs::copy(fallback_bin, target_bin);
        let _ = fs::copy(fallback_bin, target_simple_bin);
    }

    tauri_build::build();
}
