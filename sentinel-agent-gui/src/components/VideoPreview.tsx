import React from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { CarvedSegmentUI } from '../types';

interface VideoPreviewProps {
  segment: CarvedSegmentUI;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({ segment }) => {
  const previewPath = segment.preview_path || (segment.can_preview ? segment.local_path : null);
  const assetUrl = previewPath ? convertFileSrc(previewPath) : null;

  return (
    <div className="w-full bg-[#0f1117] rounded-sm border border-[#2d3148] overflow-hidden aspect-video relative flex items-center justify-center shadow-xl">
      {assetUrl ? (
        <video
          key={assetUrl}
          src={assetUrl}
          controls
          autoPlay
          className="w-full h-full object-contain bg-black"
        >
          Your browser does not support HTML5 video playback.
        </video>
      ) : (
        <p className="px-6 text-center font-mono text-xs text-slate-400">
          This segment has no playable MP4 preview. Install FFmpeg or upload a browser-compatible video file.
        </p>
      )}
    </div>
  );
};
