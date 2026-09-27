import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderPlus, ArrowRight, ArrowLeft, Film } from 'lucide-react';
import { api } from '../api/client';
import { useCaseStore } from '../store/caseStore';
import { StepBar } from '../components/StepBar';
import { ManualFileCard } from '../components/ManualFileCard';
import type { FileHashResult, VideoProbeResult, CarvedSegmentUI } from '../types';

interface ProcessedFile {
  path: string;
  hash: FileHashResult | null;
  probe: VideoProbeResult | null;
  isLoading: boolean;
}

export const ManualUpload: React.FC = () => {
  const navigate = useNavigate();
  const { session, addSegments } = useCaseStore();
  const [files, setFiles] = useState<ProcessedFile[]>([]);

  const handlePickFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: 'Video Files',
            extensions: ['mp4', 'avi', 'mkv', 'dav', 'dvr', 'h264', 'raw'],
          },
        ],
      });

      if (!selected) return;

      const paths = Array.isArray(selected) ? selected : [selected];
      const newEntries: ProcessedFile[] = paths.map((p) => ({
        path: p,
        hash: null,
        probe: null,
        isLoading: true,
      }));

      setFiles((prev) => [...prev, ...newEntries]);

      // Process in parallel
      for (const entry of newEntries) {
        processFile(entry.path);
      }
    } catch (err: unknown) {
      console.error('Error selecting files:', err);
    }
  };

  const processFile = async (filePath: string) => {
    let hashRes: FileHashResult | null = null;
    let probeRes: VideoProbeResult | null = null;

    try {
      hashRes = await api.hashFile(filePath);
    } catch (e: unknown) {
      console.error('Hash error:', e);
    }

    try {
      probeRes = await api.probeVideo(filePath);
    } catch (e: unknown) {
      console.warn('Probe notice:', e);
    }

    setFiles((prev) =>
      prev.map((f) =>
        f.path === filePath
          ? { ...f, hash: hashRes, probe: probeRes, isLoading: false }
          : f
      )
    );
  };

  const handleRemove = (filePath: string) => {
    setFiles((prev) => prev.filter((f) => f.path !== filePath));
  };

  const handleProceed = () => {
    const manualSegments: CarvedSegmentUI[] = files
      .filter((f) => f.hash !== null)
      .map((f) => {
        const filename = f.path.split(/[/\\]/).pop() || f.path;
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        const canPreview = ['mp4', 'mkv', 'avi', 'h264'].includes(ext);

        return {
          filename,
          camera_channel: 0,
          tier_used: 'Manual Upload',
          timestamp_start: f.probe?.creation_time || null,
          timestamp_end: null,
          sha256: f.hash!.sha256,
          md5: f.hash!.md5,
          frame_count: 0,
          is_deleted: false,
          size_bytes: f.hash!.size_bytes,
          local_path: f.path,
          can_preview: canPreview,
          source: 'manual',
        };
      });

    addSegments(manualSegments);

    if (session?.flow === 'manual') {
      navigate('/upload');
    } else {
      navigate('/preview');
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col">
      <StepBar currentStep={2} flow="manual" />

      <main className="flex-1 max-w-4xl w-full mx-auto p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Add Manual Video Files</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select existing video files from your disk to add to this SentinelFS case.
            </p>
          </div>

          <button
            onClick={handlePickFiles}
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-4 py-2.5 rounded-sm flex items-center space-x-2 shadow-lg shadow-purple-600/20 transition-all"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Select Video Files</span>
          </button>
        </div>

        {files.length === 0 ? (
          <div
            onClick={handlePickFiles}
            className="border-2 border-dashed border-[#2d3148] hover:border-purple-500 bg-[#1a1d27]/50 rounded-sm p-12 text-center cursor-pointer transition-colors space-y-3"
          >
            <Film className="w-12 h-12 mx-auto text-purple-400" />
            <div>
              <h3 className="text-base font-semibold text-slate-200">No video files added yet</h3>
              <p className="text-xs text-slate-400 mt-1">
                Click here or use the button above to select .mp4, .avi, .mkv, .dav, or .h264 files
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {files.map((file) => (
              <ManualFileCard
                key={file.path}
                filePath={file.path}
                hashResult={file.hash}
                probeResult={file.probe}
                isLoading={file.isLoading}
                onRemove={() => handleRemove(file.path)}
              />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-6 border-t border-[#2d3148]">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 text-slate-400 hover:text-white text-xs px-4 py-2.5 rounded-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <button
            disabled={files.length === 0 || files.some((f) => f.isLoading)}
            onClick={handleProceed}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs px-6 py-2.5 rounded-sm flex items-center space-x-2 shadow-lg shadow-blue-600/20 transition-all"
          >
            <span>Proceed to {session?.flow === 'manual' ? 'Claim & Upload' : 'Preview'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>
    </div>
  );
};
