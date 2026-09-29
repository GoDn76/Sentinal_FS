import math
import shutil
from pathlib import Path
from .exporter import ForensicExporter


def resolve_occlusions(
    exporter: ForensicExporter, max_gap_ms: float = 1000.0, max_dist_px: float = 80.0
):
    """Merges fragmented tracks caused by crossovers or occlusions."""
    print("[*] Analyzing trajectories for occlusion-induced track splits...")
    merge_map = {}
    track_ids_sorted = sorted(
        exporter.trajectories.keys(),
        key=lambda tid: exporter.trajectories[tid][0]["time_ms"],
    )

    for i in range(len(track_ids_sorted)):
        tid_a = track_ids_sorted[i]
        target_a = merge_map.get(tid_a, tid_a)
        pts_a = exporter.trajectories[tid_a]
        end_time_a = pts_a[-1]["time_ms"]
        end_pos_a = (pts_a[-1]["cx"], pts_a[-1]["cy"])

        for j in range(i + 1, len(track_ids_sorted)):
            tid_b = track_ids_sorted[j]
            if tid_b in merge_map:
                continue
            pts_b = exporter.trajectories[tid_b]
            start_time_b = pts_b[0]["time_ms"]
            start_pos_b = (pts_b[0]["cx"], pts_b[0]["cy"])

            time_gap = start_time_b - end_time_a
            if 0 < time_gap < max_gap_ms:
                dist = math.hypot(
                    start_pos_b[0] - end_pos_a[0], start_pos_b[1] - end_pos_a[1]
                )
                if dist < max_dist_px:
                    print(
                        f"[!] Occlusion Split Detected: Merging Track {tid_b} -> Track {target_a} (Gap: {time_gap:.1f}ms, Jump: {dist:.1f}px)"
                    )
                    merge_map[tid_b] = target_a
                    end_time_a = pts_b[-1]["time_ms"]
                    end_pos_a = (pts_b[-1]["cx"], pts_b[-1]["cy"])

    if merge_map:
        # Path compression for merge chains
        for k in merge_map:
            target = merge_map[k]
            while target in merge_map:
                target = merge_map[target]
            merge_map[k] = target

        # Migrate physical image crops and update in-memory records
        for rec in exporter.records:
            if rec.track_id in merge_map:
                new_tid = merge_map[rec.track_id]
                old_crop_path = exporter.output_dir / rec.crop_path
                new_dir = exporter.crops_dir / f"track_{new_tid}"
                new_dir.mkdir(parents=True, exist_ok=True)
                new_crop_path = new_dir / old_crop_path.name

                if old_crop_path.exists():
                    shutil.move(str(old_crop_path), str(new_crop_path))
                    rec.crop_path = new_crop_path.relative_to(
                        exporter.output_dir
                    ).as_posix()
                rec.track_id = new_tid

        # Remove now-empty fragmented directories safely
        for old_tid in merge_map.keys():
            old_dir = exporter.crops_dir / f"track_{old_tid}"
            if old_dir.exists():
                shutil.rmtree(old_dir, ignore_errors=True)

        # Re-index coordinate trajectories
        new_trajectories = {}
        for tid, pts in exporter.trajectories.items():
            mapped_id = merge_map.get(tid, tid)
            if mapped_id not in new_trajectories:
                new_trajectories[mapped_id] = []
            new_trajectories[mapped_id].extend(pts)

        for tid in new_trajectories:
            new_trajectories[tid] = sorted(
                new_trajectories[tid], key=lambda p: p["time_ms"]
            )

        exporter.trajectories = new_trajectories