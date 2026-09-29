import cv2
import json
from pathlib import Path


def render_presentation_video(
    video_path: str, manifest_path: str, output_path: str = "annotated_tracking.mp4"
):
    """Renders video with bounding box overlays and persistence to avoid flickering."""
    print(f"[*] Rendering annotated video to: {output_path}...")
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    with open(manifest_path, "r") as f:
        manifest = json.load(f)

    frame_map = {}
    for det in manifest["detections"]:
        frame_map.setdefault(det["frame_idx"], []).append(det)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise IOError(f"Could not open video file: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Calculate frame interval used during sampling
    sampled_fps = manifest["execution_params"].get("target_fps", 15)
    hold_frames = max(1, int(round(fps / sampled_fps)))

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(output_path, fourcc, fps, (w, h))

    frame_idx = 0
    active_boxes = []
    frames_since_update = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # Check for new detections at this sampled index
        if frame_idx in frame_map:
            active_boxes = frame_map[frame_idx]
            frames_since_update = 0
        else:
            frames_since_update += 1
            # Clear boxes if no new update arrives within the hold window
            if frames_since_update >= hold_frames:
                active_boxes = []

        # Render active bounding markers
        for d in active_boxes:
            x1, y1, x2, y2 = d["bbox_xyxy"]
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 127), 2)
            label = f"ID: {d['track_id']} | {d['confidence']:.2f}"
            (txt_w, txt_h), _ = cv2.getTextSize(
                label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2
            )
            cv2.rectangle(
                frame, (x1, y1 - txt_h - 10), (x1 + txt_w + 10, y1), (0, 255, 127), -1
            )
            cv2.putText(
                frame,
                label,
                (x1 + 5, y1 - 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (0, 0, 0),
                2,
            )

        out.write(frame)
        frame_idx += 1

    cap.release()
    out.release()
    print(f"[+] Render complete: {output_path}")