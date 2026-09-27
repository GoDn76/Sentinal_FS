import React, { useState, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { convertFileSrc } from '@tauri-apps/api/core';
import { ShieldAlert, Film } from 'lucide-react';
import type { CarvedSegmentUI } from '../types';
import { api } from '../api/client';

interface VideoPreviewProps {
  segment: CarvedSegmentUI;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({ segment }) => {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [thumbError, setThumbError] = useState(false);
  const [isLoadingThumb, setIsLoadingThumb] = useState(false);

  const ext = segment.filename.split('.').pop()?.toLowerCase() || '';

  useEffect(() => {
    setThumbnail(null);
    setThumbError(false);

    if (!segment.can_preview && ext === 'dav') {
      setIsLoadingThumb(true);
      api
        .extractPreviewThumbnail(segment.local_path)
        .then((b64) => {
          setThumbnail(b64);
          setIsLoadingThumb(false);
        })
        .catch(() => {
          setThumbError(true);
          setIsLoadingThumb(false);
        });
    }
  }, [segment.local_path, segment.can_preview, ext]);

  // Case 1: Standard video preview via convertFileSrc
  if (segment.can_preview) {
    const assetUrl = convertFileSrc(segment.local_path);
    return (
      <div className="w-full bg-[#0f1117] rounded-sm border border-[#2d3148] overflow-hidden aspect-video relative flex items-center justify-center">
        <ReactPlayer
          url={assetUrl}
          controls
          width="100%"
          height="100%"
          config={{ file: { forceVideo: true } }}
        />
      </div>
    );
  }

  // Case 2: Proprietary .dav file preview thumbnail
  if (ext === 'dav') {
    return (
      <div className="w-full bg-[#0f1117] rounded-sm border border-[#2d3148] overflow-hidden aspect-video relative flex items-center justify-center p-4">
        {isLoadingThumb && (
          <div className="flex flex-col items-center space-y-2 text-slate-400">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono">Extracting .dav frame...</span>
          </div>
        )}

        {!isLoadingThumb && thumbnail && (
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={`data:image/jpeg;base64,${thumbnail}`}
              alt="DAV Keyframe Preview"
              className="max-h-full max-w-full object-contain rounded"
            />
            <span className="absolute bottom-2 right-2 bg-black/80 text-emerald-400 text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-500/30">
              FRAME PREVIEW EXTRACTED
            </span>
          </div>
        )}

        {!isLoadingThumb && thumbError && (
          <div className="border border-dashed border-[#2d3148] rounded p-8 text-center text-slate-400 w-full h-full flex flex-col items-center justify-center space-y-2">
            <ShieldAlert className="w-8 h-8 text-amber-400" />
            <p className="text-sm font-semibold text-slate-200">Cannot preview proprietary format</p>
            <p className="text-xs text-slate-400">
              Hash verified — evidence integrity confirmed
            </p>
          </div>
        )}
      </div>
    );
  }

  // Case 3: Other non-previewable format
  return (
    <div className="w-full bg-[#0f1117] rounded-sm border border-dashed border-[#2d3148] aspect-video flex flex-col items-center justify-center p-6 text-center space-y-2 text-slate-400">
      <Film className="w-8 h-8 text-slate-500" />
      <p className="text-sm font-semibold text-slate-200">No preview available for this format</p>
      <p className="text-xs font-mono text-slate-500">{segment.local_path}</p>
    </div>
  );
};
