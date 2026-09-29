import hashlib
import os
import shutil
import subprocess
from pathlib import Path


VIDEO_EXTENSIONS = {".264", ".avi", ".dav", ".h264", ".mkv", ".mov", ".mp4", ".mpeg", ".mpg", ".webm"}


def create_playback_copy(source_path: str) -> dict[str, str | int] | None:
    source = Path(source_path)
    if source.suffix.lower() not in VIDEO_EXTENSIONS:
        return None

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return None

    playback_path = source.with_name(f"{source.stem}.playback.mp4")
    try:
        subprocess.run(
            [
                ffmpeg,
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                str(source),
                "-map",
                "0:v:0",
                "-map",
                "0:a?",
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-movflags",
                "+faststart",
                str(playback_path),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
    except (OSError, subprocess.CalledProcessError):
        if playback_path.exists():
            playback_path.unlink()
        return None

    if not playback_path.is_file() or playback_path.stat().st_size == 0:
        return None

    sha256_hash = hashlib.sha256()
    with playback_path.open("rb") as playback_file:
        for chunk in iter(lambda: playback_file.read(1 << 20), b""):
            sha256_hash.update(chunk)

    return {
        "file_name": playback_path.name,
        "sha256": sha256_hash.hexdigest(),
        "size_bytes": os.path.getsize(playback_path),
    }