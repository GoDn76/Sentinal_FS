import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

def build_hikvision_disk():
    project_dir = Path(__file__).resolve().parent
    source_video = project_dir / "CheckVid.mp4"
    ffmpeg = shutil.which("ffmpeg")
    ffprobe = shutil.which("ffprobe")
    if not source_video.is_file():
        raise FileNotFoundError(f"Playable source video not found: {source_video}")
    if not ffmpeg or not ffprobe:
        raise RuntimeError("Both ffmpeg and ffprobe must be available on PATH")

    # This creates a synthetic MPEG-PS carving fixture, not a native Hikvision disk.
    with tempfile.TemporaryDirectory() as temp_dir:
        mpeg_path = Path(temp_dir) / "CheckVid_hikvision_test.mpg"
        subprocess.run(
            [
                ffmpeg,
                "-y",
                "-i",
                str(source_video),
                "-map",
                "0:v:0",
                "-map",
                "0:a?",
                "-c:v",
                "mpeg2video",
                "-q:v",
                "4",
                "-c:a",
                "mp2",
                "-f",
                "vob",
                str(mpeg_path),
            ],
            check=True,
        )

        probe = subprocess.run(
            [
                ffprobe,
                "-v",
                "error",
                "-show_entries",
                "stream=codec_type,width,height",
                "-of",
                "json",
                str(mpeg_path),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        streams = json.loads(probe.stdout).get("streams", [])
        if not any(
            stream.get("codec_type") == "video"
            and stream.get("width", 0) > 0
            and stream.get("height", 0) > 0
            for stream in streams
        ):
            raise RuntimeError("FFmpeg output contains no decodable video stream")

        mpeg_video = mpeg_path.read_bytes()

    # Embed a recognizable marker and MPEG-PS payload into a synthetic disk image.
    magic_header = b'HIKVISION@HANGZHOU' + (b'\x00' * 110)
    
    hik_payload = magic_header + mpeg_video

    disk_size = 50 * 1024 * 1024  # 50 MB
    disk_path = project_dir / "fake_hik_disk_valid.raw"
    suffix = 1
    while disk_path.exists():
        disk_path = project_dir / f"fake_hik_disk_valid_{suffix}.raw"
        suffix += 1
    print(f"Generating 50MB synthetic carving fixture: {disk_path}")
    with open(disk_path, 'wb') as disk:
        disk.write(os.urandom(disk_size))

    # Place the synthetic stream at the 10MB offset.
    with open(disk_path, 'r+b') as disk:
        disk.seek(10 * 1024 * 1024)
        disk.write(hik_payload)

    print("Done. Created a synthetic MPEG-PS raw carving fixture.")

build_hikvision_disk()