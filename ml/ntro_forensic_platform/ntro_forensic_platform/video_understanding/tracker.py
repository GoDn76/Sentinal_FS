import torch
import numpy as np
from typing import List, Dict, Any
from ultralytics import YOLO


class VideoTracker:
    """Executes YOLO11 person detection paired with ByteTrack association."""

    def __init__(self, model_weights: str = "yolo11x.pt", conf_thresh: float = 0.25):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = YOLO(model_weights)
        self.conf_thresh = conf_thresh

    def track(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        results = self.model.track(
            source=frame,
            persist=True,
            classes=[0],  # Person class only
            conf=self.conf_thresh,
            iou=0.70,
            tracker="bytetrack.yaml",
            device=self.device,
            verbose=False,
        )

        tracks = []
        if len(results) > 0 and results[0].boxes is not None:
            boxes = results[0].boxes.xyxy.cpu().numpy().astype(int)
            confs = results[0].boxes.conf.cpu().numpy().astype(float)
            ids = (
                results[0].boxes.id.cpu().numpy().astype(int)
                if results[0].boxes.id is not None
                else []
            )

            for i in range(len(ids)):
                tracks.append(
                    {
                        "track_id": int(ids[i]),
                        "bbox": boxes[i].tolist(),
                        "conf": float(confs[i]),
                    }
                )
        return tracks