import json
from video_understanding.pipeline import run_pipeline
from video_understanding.visualizer import render_presentation_video


def main():
    evidence_video = "evidence_video.mp4"
    output_directory = "./forensic_pipeline_output"

    # 1. Run Pipeline
    manifest_path = run_pipeline(
        video_path=evidence_video,
        output_dir=output_directory,
        model_weights="yolo11x.pt",
        target_fps=15,
    )

    # 2. Audit Output
    with open(manifest_path, "r") as f:
        manifest_data = json.load(f)

    summary = manifest_data["summary"]
    print(f"\n[+] Extraction Complete!")
    print(f"    - Unique Suspects Tracked: {summary['unique_tracks']}")
    print(f"    - Track IDs Assigned:      {summary['tracked_ids']}")
    print(f"    - Structured Manifest:     {manifest_path}")

    # 3. Render Visual Overlay
    render_presentation_video(
        evidence_video, manifest_path, f"{output_directory}/annotated_tracking.mp4"
    )
    


if __name__ == "__main__":
    main()