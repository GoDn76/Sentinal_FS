import os
import shutil
from .extractor import FrameExtractor
from .tracker import VideoTracker
from .exporter import ForensicExporter
from .stitcher import resolve_occlusions


def run_pipeline(
    video_path: str,
    output_dir: str = "./forensic_pipeline_output",
    target_fps: int = 15,
    model_weights: str = "yolo11x.pt",
) -> str:
    """Master pipeline tying extraction, tracking, stitching, and export together."""
    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)

    config = {
        "target_fps": target_fps,
        "model_weights": model_weights,
        "conf_thresh": 0.25,
        "output_dir": output_dir,
    }

    extractor = FrameExtractor(video_path=video_path, target_fps=config["target_fps"])
    tracker = VideoTracker(
        model_weights=config["model_weights"], conf_thresh=config["conf_thresh"]
    )
    exporter = ForensicExporter(output_dir=config["output_dir"])

    print(f"[*] Starting Forensic Pipeline on: {video_path}")
    print(f"[*] Architecture Model: {model_weights} @ {target_fps} FPS")

    try:
        for frame_idx, pts_ms, ts_str, raw_frame in extractor.extract():
            active_tracks = tracker.track(raw_frame)
            for trk in active_tracks:
                exporter.save_crop(
                    raw_frame,
                    frame_idx,
                    pts_ms,
                    ts_str,
                    trk["track_id"],
                    trk["bbox"],
                    trk["conf"],
                )
    finally:
        extractor.release()

    # Apply automated occlusion resolution
    resolve_occlusions(exporter)

    # Write final signed manifest
    manifest_path = exporter.export_manifest(video_path, config)
    return manifest_path