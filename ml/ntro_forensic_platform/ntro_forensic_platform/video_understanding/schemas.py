from typing import List, Tuple, Dict, Any
from pydantic import BaseModel


class DetectionItem(BaseModel):
    frame_idx: int
    timestamp_ms: float
    timestamp_str: str
    track_id: int
    bbox_xyxy: List[int]
    confidence: float
    crop_path: str
    crop_sha256: str
    centroid: Tuple[int, int]


class ForensicManifest(BaseModel):
    source_video: str
    source_video_sha256: str
    execution_params: Dict[str, Any]
    summary: Dict[str, Any]
    trajectories: Dict[str, List[Dict[str, Any]]]
    detections: List[DetectionItem]