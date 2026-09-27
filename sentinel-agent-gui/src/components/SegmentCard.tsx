import React from 'react';
import { Film, Video, ShieldAlert, CheckCircle2 } from 'lucide-react';
import type { CarvedSegmentUI } from '../types';

interface SegmentCardProps {
  segment: CarvedSegmentUI;
  isSelected: boolean;
  onSelect: () => void;
}

export const SegmentCard: React.FC<SegmentCardProps> = ({ segment, isSelected, onSelect }) => {
  const sizeMB = (segment.size_bytes / (1024 * 1024)).toFixed(2);

  return (
    <div
      onClick={onSelect}
      className={`p-3.5 rounded-sm border cursor-pointer transition-all ${
        isSelected
          ? 'bg-[#25293a] border-blue-500 ring-1 ring-blue-500 shadow-md'
          : 'bg-[#1a1d27] border-[#2d3148] hover:border-slate-500 hover:bg-[#202433]'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-2.5 truncate">
          <div className="p-2 bg-[#0f1117] rounded-sm text-blue-400">
            {segment.source === 'manual' ? (
              <Film className="w-4 h-4 text-purple-400" />
            ) : (
              <Video className="w-4 h-4 text-blue-400" />
            )}
          </div>
          <div className="truncate">
            <h4 className="text-xs font-semibold text-slate-200 truncate" title={segment.filename}>
              {segment.filename}
            </h4>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              {sizeMB} MB • {segment.frame_count > 0 ? `${segment.frame_count} frames` : 'Manual'}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end space-y-1">
          {segment.is_deleted ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
              <ShieldAlert className="w-3 h-3 mr-1" />
              DELETED
            </span>
          ) : (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              RECOVERED
            </span>
          )}

          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded uppercase ${
              segment.source === 'manual'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
            }`}
          >
            {segment.tier_used}
          </span>
        </div>
      </div>

      <div className="mt-2.5 pt-2 border-t border-[#2d3148]/60 flex items-center justify-between text-[10px] text-slate-400">
        <span>
          Channel: {segment.camera_channel === 0 ? 'Unknown' : `Cam ${segment.camera_channel}`}
        </span>
        <span className="font-mono truncate max-w-[150px]">
          {segment.timestamp_start || 'No timestamp'}
        </span>
      </div>
    </div>
  );
};
