import cv2
import numpy as np
from typing import Generator, Tuple


class FrameExtractor:
    """Extracts timestamped frames at normalized sampling rates."""

    def __init__(self, video_path: str, target_fps: int = 15):
        self.cap = cv2.VideoCapture(video_path)
        if not self.cap.isOpened():
            raise IOError(f"Cannot open video source: {video_path}")
        self.native_fps = self.cap.get(cv2.CAP_PROP_FPS) or 25.0
        self.frame_interval = max(1, int(round(self.native_fps / target_fps)))

    def extract(self) -> Generator[Tuple[int, float, str, np.ndarray], None, None]:
        frame_idx = 0
        while self.cap.isOpened():
            ret, frame = self.cap.read()
            if not ret:
                break

            if frame_idx % self.frame_interval == 0:
                pts_ms = self.cap.get(cv2.CAP_PROP_POS_MSEC)
                secs, ms = divmod(int(pts_ms), 1000)
                mins, secs = divmod(secs, 60)
                hrs, mins = divmod(mins, 60)
                ts_str = f"{hrs:02d}:{mins:02d}:{secs:02d}.{ms:03d}"
                yield frame_idx, pts_ms, ts_str, frame

            frame_idx += 1

    def release(self):
        if self.cap.isOpened():
            self.cap.release()