import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, ShieldCheck, Eye } from 'lucide-react';
import { TimelineEvent } from '../types';

interface BoundingBoxOverlayProps {
  videoUrl?: string;
  events?: TimelineEvent[];
  activeTimestamp?: number;
}

export const VideoPlayerWithOverlay: React.FC<BoundingBoxOverlayProps> = ({
  videoUrl,
  events = [],
  activeTimestamp = 0
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(activeTimestamp);
  const [activeBoxes, setActiveBoxes] = useState<TimelineEvent[]>([]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);

      // Filter events active at current timestamp
      const active = events.filter(
        (e) => time >= e.start_sec && time <= e.end_sec
      );
      setActiveBoxes(active);
    }
  };

  useEffect(() => {
    if (videoRef.current && activeTimestamp !== currentTime) {
      videoRef.current.currentTime = activeTimestamp;
    }
  }, [activeTimestamp]);

  return (
    <div className="relative bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col group select-none">
      <div className="relative aspect-video w-full bg-slate-950 overflow-hidden flex items-center justify-center">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            onTimeUpdate={handleTimeUpdate}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-t from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center relative">
            <div className="text-center font-mono space-y-2">
              <Eye className="w-10 h-10 text-teal-400 mx-auto animate-pulse" />
              <div className="text-xs text-slate-300 font-bold uppercase tracking-wider">
                Live Synthetic Telemetry Viewport
              </div>
              <div className="text-[11px] text-slate-500">
                CAM 03 — Rear Alleyway Loading Dock (4K 60FPS)
              </div>
            </div>
          </div>
        )}

        {/* HUD Top Bar Overlay */}
        <div className="absolute top-3 left-4 right-4 flex items-center justify-between text-xs font-mono text-slate-300 pointer-events-none z-10">
          <div className="px-2.5 py-1 rounded bg-slate-950/80 backdrop-blur-md border border-slate-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="text-teal-400 font-bold">
              2026-09-28 22:31:45.812 UTC
            </span>
            <span className="text-slate-600">|</span>
            <span>TIME: {currentTime.toFixed(2)}s</span>
          </div>
          <div className="px-2.5 py-1 rounded bg-slate-950/80 backdrop-blur-md border border-slate-800 text-emerald-400 font-bold">
            BSA SEC 63(4) VALIDATED
          </div>
        </div>

        {/* Dynamic Bounding Box Overlays */}
        {activeBoxes.length > 0 ? (
          activeBoxes.map((ev, idx) => {
            const [x1, y1, x2, y2] = ev.bounding_box || [150, 100, 450, 350];
            const isPerson = ev.entity_class === 'Person';
            const colorClass = isPerson ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-emerald-400 bg-emerald-400/10 text-emerald-400';

            return (
              <div
                key={idx}
                className={`absolute border-2 rounded ${colorClass} p-2 shadow-lg transition-all duration-150 flex flex-col justify-between`}
                style={{
                  left: `${(x1 / 640) * 100}%`,
                  top: `${(y1 / 480) * 100}%`,
                  width: `${((x2 - x1) / 640) * 100}%`,
                  height: `${((y2 - y1) / 480) * 100}%`,
                }}
              >
                <div className="bg-slate-950/90 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold self-start">
                  {ev.entity_class.toUpperCase()}: {ev.track_id} [{(ev.confidence_avg * 100).toFixed(1)}%]
                </div>
                <div className="bg-slate-950/90 px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-300 self-end">
                  OSNet 512-dim Embedding
                </div>
              </div>
            );
          })
        ) : (
          /* Default HUD Bounding Box if playing interactive mock */
          <div className="absolute top-[28%] left-[44%] w-[22%] h-[48%] border-2 border-emerald-400 bg-emerald-400/10 rounded p-2 flex flex-col justify-between shadow-[0_0_15px_rgba(78,222,163,0.3)]">
            <div className="bg-slate-950/90 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-emerald-400 self-start">
              TGT_01: PERSON [94.2%]
            </div>
            <div className="bg-slate-950/90 px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-300 self-end">
              Track ID: P-001 | OSNet 512-dim
            </div>
          </div>
        )}
      </div>

      {/* Control Toolbar */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className="px-3 py-1.5 rounded bg-teal-500 text-slate-950 font-bold hover:bg-teal-400 transition-colors flex items-center gap-1.5"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
          </button>
          <button
            onClick={() => {
              if (videoRef.current) videoRef.current.currentTime = 0;
            }}
            className="p-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-4 text-slate-400">
          <span>CODEC: H.264</span>
          <span>BITRATE: 14.8 Mbps</span>
          <span className="text-teal-400 font-bold">1.0X REALTIME</span>
        </div>
      </div>
    </div>
  );
};
