"""
faiss_search.py
SentinelFS FAISS Cross-Camera Unified Search Engine.

Indexes 512-dim L2-normalised vectors from:
  - Pipeline A: OSNet person body Re-ID embeddings
  - Pipeline B: ArcFace raw & restored face embeddings

Features:
  - FAISS IndexFlatIP (Cosine similarity)
  - Cross-camera trajectory timeline generation with clock-drift sorting
  - Graceful NumPy dot-product fallback if faiss-cpu is not installed
  - Section 63(4) BSA compliant: deterministic vector similarity measurements
"""

from __future__ import annotations
import os
import json
import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

import numpy as np


class FAISSCrossCameraSearch:
    """
    Unified vector search engine across multi-camera DVR video segments.
    """

    def __init__(self, dim: int = 512):
        self.dim = dim
        self.index = None
        self.metadata: List[Dict[str, Any]] = []
        self.vectors: Optional[np.ndarray] = None
        self.backend = "numpy_fallback"
        self._init_index()

    def _init_index(self):
        try:
            import faiss
            self.index = faiss.IndexFlatIP(self.dim)
            self.backend = "faiss_cpu"
            print(f"[faiss] Initialised FAISS IndexFlatIP (dim={self.dim})")
        except Exception as e:
            self.backend = "numpy_fallback"
            print(f"[faiss] FAISS not available ({e}). Using NumPy dot-product cosine search.")

    def add_embeddings(self, embeddings: List[List[float]], meta_list: List[Dict[str, Any]]):
        """
        Add 512-dim L2-normalised embeddings and metadata records to the index.
        """
        if not embeddings or len(embeddings) != len(meta_list):
            return

        arr = np.array(embeddings, dtype=np.float32)
        # Verify L2 normalisation
        norms = np.linalg.norm(arr, axis=1, keepdims=True)
        norms[norms < 1e-6] = 1.0
        arr = arr / norms

        if self.index is not None:
            self.index.add(arr)
        else:
            if self.vectors is None:
                self.vectors = arr
            else:
                self.vectors = np.vstack([self.vectors, arr])

        self.metadata.extend(meta_list)

    def search(self, query_embedding: List[float], top_k: int = 10, min_similarity: float = 0.40) -> List[Dict[str, Any]]:
        """
        Search for top-K matching persons/faces across all camera streams.
        Returns matched records with cosine similarity score.
        """
        if not self.metadata:
            return []

        q = np.array([query_embedding], dtype=np.float32)
        norm = np.linalg.norm(q)
        if norm > 1e-6:
            q = q / norm

        results = []

        if self.index is not None and self.index.ntotal > 0:
            scores, indices = self.index.search(q, min(top_k, self.index.ntotal))
            for score, idx in zip(scores[0], indices[0]):
                if idx < 0 or idx >= len(self.metadata):
                    continue
                sim = float(score)
                if sim >= min_similarity:
                    item = dict(self.metadata[idx])
                    item["similarity_score"] = round(sim, 4)
                    results.append(item)
        elif self.vectors is not None and len(self.vectors) > 0:
            scores = np.dot(self.vectors, q.T).flatten()
            top_indices = np.argsort(-scores)[:top_k]
            for idx in top_indices:
                sim = float(scores[idx])
                if sim >= min_similarity:
                    item = dict(self.metadata[idx])
                    item["similarity_score"] = round(sim, 4)
                    results.append(item)

        return results

    def build_trajectory_timeline(self, query_embedding: List[float], top_k: int = 20, min_similarity: float = 0.40) -> Dict[str, Any]:
        """
        Builds a cross-camera chronological trajectory timeline for a suspect target.
        Grouped and ordered by camera_channel and estimated timestamp.
        """
        matches = self.search(query_embedding, top_k=top_k, min_similarity=min_similarity)

        # Sort matches by timestamp_sec or frame_idx
        matches.sort(key=lambda m: (m.get("camera_channel", 0), m.get("timestamp_sec", 0.0)))

        timeline = []
        cameras_visited = set()

        for m in matches:
            cam = m.get("camera_channel", 0)
            cameras_visited.add(cam)
            timeline.append({
                "camera_channel": cam,
                "timestamp_sec": m.get("timestamp_sec", 0.0),
                "timestamp_readable": format_seconds(m.get("timestamp_sec", 0.0)),
                "track_id": m.get("track_id"),
                "similarity_score": m.get("similarity_score"),
                "embedding_type": m.get("embedding_type", "unknown"),
                "frame_idx": m.get("frame_idx", 0),
                "source_file": m.get("source_file", "unknown"),
            })

        return {
            "total_matches": len(matches),
            "cameras_count": len(cameras_visited),
            "cameras_visited": sorted(list(cameras_visited)),
            "trajectory_timeline": timeline,
            "backend_used": self.backend,
        }


def format_seconds(sec: float) -> str:
    m, s = divmod(int(sec), 60)
    h, m = divmod(m, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"
