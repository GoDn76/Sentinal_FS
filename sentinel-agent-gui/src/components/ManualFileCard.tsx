import React from 'react';
import { Film, X, Loader2, Clock, Monitor, Code } from 'lucide-react';
import type { FileHashResult, VideoProbeResult } from '../types';
import { HashBadge } from './HashBadge';

interface ManualFileCardProps {
  filePath: string;
  hashResult: FileHashResult | null;
  probeResult: VideoProbeResult | null;
  isLoading: boolean;
  onRemove: () => void;
}

export const ManualFileCard: React.FC<ManualFileCardProps> = ({
  filePath,
  hashResult,
  probeResult,
  isLoading,
  onRemove,
}) => {
  const filename = filePath.split(/[/\\]/).pop() || filePath;
  const sizeMB = hashResult ? (hashResult.size_bytes / (1024 * 1024)).toFixed(2) : null;

  return (
    <div className="bg-[#1a1d27] border border-[#2d3148] p-4 rounded-sm space-y-3 relative">
      <button
        onClick={onRemove}
        className="absolute top-3 right-3 text-slate-400 hover:text-red-400 transition-colors p-1 rounded hover:bg-[#2d3148]"
        title="Remove file"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center space-x-3 pr-8">
        <div className="p-2.5 bg-[#0f1117] border border-[#2d3148] rounded-sm text-purple-400">
          <Film className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-200 truncate" title={filename}>
            {filename}
          </h4>
          <p className="text-xs text-slate-400 font-mono">
            {sizeMB ? `${sizeMB} MB` : 'Processing...'}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center space-x-2 text-xs text-blue-400 py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Hashing evidence & probing metadata...</span>
        </div>
      ) : (
        <div className="space-y-2 pt-2 border-t border-[#2d3148]">
          {hashResult && (
            <div className="flex flex-wrap gap-2">
              <HashBadge label="SHA256" hash={hashResult.sha256} />
              <HashBadge label="MD5" hash={hashResult.md5} />
            </div>
          )}

          {probeResult ? (
            <div className="flex flex-wrap gap-4 text-xs text-slate-300 pt-1">
              <div className="flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>{probeResult.duration_sec.toFixed(1)}s</span>
              </div>
              <div className="flex items-center space-x-1">
                <Monitor className="w-3.5 h-3.5 text-blue-400" />
                <span>
                  {probeResult.width}x{probeResult.height}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <Code className="w-3.5 h-3.5 text-blue-400" />
                <span className="uppercase">{probeResult.codec}</span>
              </div>
              {probeResult.creation_time && (
                <div className="text-slate-400">
                  Created: {probeResult.creation_time}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-amber-400/90 font-mono">
              Metadata unavailable — proprietary video container
            </p>
          )}
        </div>
      )}
    </div>
  );
};
