import os
import cv2
import hashlib
from pathlib import Path
from .schemas import DetectionItem, ForensicManifest


class ForensicExporter:
    """Crops unaltered raw suspect imagery and maintains SHA-256 audit trails."""

    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.crops_dir = self.output_dir / "person_crops"
        self.crops_dir.mkdir(parents=True, exist_ok=True)
        self.records = []
        self.trajectories = {}

    @staticmethod
    def calc_sha256(filepath: str) -> str:
        h = hashlib.sha256()
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()

    def save_crop(self, raw_frame, frame_idx, pts_ms, ts_str, track_id, bbox, conf):
        h, w, _ = raw_frame.shape
        x1, y1, x2, y2 = bbox

        # Safe border padding
        pad = 10
        x1, y1 = max(0, x1 - pad), max(0, y1 - pad)
        x2, y2 = min(w, x2 + pad), min(h, y2 + pad)
        if (x2 - x1) < 20 or (y2 - y1) < 20:
            return

        cx, cy = int((x1 + x2) / 2), int((y1 + y2) / 2)
        if track_id not in self.trajectories:
            self.trajectories[track_id] = []
        self.trajectories[track_id].append(
            {"frame_idx": frame_idx, "time_ms": pts_ms, "cx": cx, "cy": cy}
        )

        track_dir = self.crops_dir / f"track_{track_id}"
        track_dir.mkdir(exist_ok=True)
        crop_path = track_dir / f"f{frame_idx}_{int(pts_ms)}ms.jpg"

        cv2.imwrite(str(crop_path), raw_frame[y1:y2, x1:x2])
        self.records.append(
            DetectionItem(
                frame_idx=frame_idx,
                timestamp_ms=round(pts_ms, 2),
                timestamp_str=ts_str,
                track_id=track_id,
                bbox_xyxy=[x1, y1, x2, y2],
                confidence=round(conf, 4),
                crop_path=crop_path.relative_to(self.output_dir).as_posix(),
                crop_sha256=self.calc_sha256(str(crop_path)),
                centroid=(cx, cy),
            )
        )

    def export_manifest(self, video_path: str, params: dict) -> str:
        manifest = ForensicManifest(
            source_video=os.path.abspath(video_path),
            source_video_sha256=self.calc_sha256(video_path),
            execution_params=params,
            summary={
                "total_detections": len(self.records),
                "unique_tracks": len(self.trajectories),
                "tracked_ids": [int(k) for k in self.trajectories.keys()],
            },
            trajectories={str(k): v for k, v in self.trajectories.items()},
            detections=self.records,
        )
        manifest_path = self.output_dir / "pipeline_tracking_manifest.json"
        with open(manifest_path, "w") as f:
            f.write(manifest.model_dump_json(indent=2))
        return str(manifest_path)