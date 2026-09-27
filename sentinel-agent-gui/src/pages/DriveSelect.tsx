import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { open } from '@tauri-apps/plugin-dialog';
import { HardDrive, FolderOpen, ArrowRight, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { api } from '../api/client';
import { useCaseStore } from '../store/caseStore';
import { StepBar } from '../components/StepBar';
import type { DriveInfo } from '../types';

export const DriveSelect: React.FC = () => {
  const navigate = useNavigate();
  const { session, setSession } = useCaseStore();

  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [customFilePath, setCustomFilePath] = useState<string | null>(null);
  const [vendorHint, setVendorHint] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDrives = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listDrives();
      setDrives(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrives();
  }, []);

  const handleCardClick = async (drive: DriveInfo) => {
    if (drive.path === 'FILE_PICKER') {
      try {
        const selected = await open({
          multiple: false,
          filters: [
            { name: 'Disk Images & Evidence', extensions: ['raw', 'dd', 'img', 'e01', 'dav', 'h264', 'bin'] },
          ],
        });

        if (selected && typeof selected === 'string') {
          setCustomFilePath(selected);
          setSelectedPath(selected);
        }
      } catch (err: unknown) {
        console.error('File picker error:', err);
      }
    } else {
      setSelectedPath(drive.path);
    }
  };

  const handleProceed = () => {
    if (!selectedPath || !session) return;

    const caseOutputDir = `./carved_evidence_${session.case_id.slice(0, 8)}`;

    setSession({
      ...session,
      output_dir: caseOutputDir,
      step: 3,
    });

    navigate('/carving', { state: { inputPath: selectedPath, vendorHint } });
  };

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col">
      <StepBar currentStep={2} flow="carving" />

      <main className="flex-1 max-w-5xl w-full mx-auto p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Select Storage Evidence Source</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Choose a physical drive, partition, or disk image file to carve for video evidence.
            </p>
          </div>
          <button
            onClick={fetchDrives}
            className="flex items-center space-x-1.5 bg-[#1a1d27] border border-[#2d3148] hover:border-slate-500 text-slate-300 px-3 py-1.5 rounded-sm text-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Drives</span>
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-sm flex items-center space-x-3 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {drives.map((drive) => {
            const isFilePicker = drive.path === 'FILE_PICKER';
            const isSelected = isFilePicker
              ? selectedPath === customFilePath && customFilePath !== null
              : selectedPath === drive.path;

            const sizeGB = (drive.size_bytes / (1024 * 1024 * 1024)).toFixed(1);

            return (
              <div
                key={drive.path}
                onClick={() => handleCardClick(drive)}
                className={`p-5 rounded-sm border cursor-pointer transition-all ${
                  isFilePicker
                    ? 'border-dashed border-[#2d3148] hover:border-blue-400 bg-[#1a1d27]/50'
                    : 'bg-[#1a1d27] border-[#2d3148] hover:border-slate-500'
                } ${isSelected ? 'ring-2 ring-blue-500 border-blue-500 bg-[#222636]' : ''}`}
              >
                <div className="flex items-start space-x-4">
                  <div
                    className={`p-3 rounded-sm ${
                      isSelected ? 'bg-blue-600 text-white' : 'bg-[#0f1117] text-blue-400'
                    }`}
                  >
                    {isFilePicker ? <FolderOpen className="w-6 h-6" /> : <HardDrive className="w-6 h-6" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm text-slate-100 truncate">
                        {isFilePicker && customFilePath ? customFilePath.split(/[/\\]/).pop() : drive.label}
                      </h3>
                      {drive.is_removable && (
                        <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">
                          Removable
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-mono text-slate-400 mt-1 truncate">
                      {isFilePicker
                        ? customFilePath || 'Click to select disk image (.raw, .dd, .img)'
                        : drive.path}
                    </p>

                    {!isFilePicker && drive.size_bytes > 0 && (
                      <p className="text-xs text-slate-500 font-mono mt-1">{sizeGB} GB Total</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-[#1a1d27] border border-[#2d3148] p-4 rounded-sm space-y-2">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
            Vendor Specification Override (Optional)
          </label>
          <select
            value={vendorHint}
            onChange={(e) => setVendorHint(e.target.value)}
            className="w-full bg-[#0f1117] border border-[#2d3148] text-slate-200 px-3 py-2 rounded-sm text-xs outline-none focus:border-blue-500"
          >
            <option value="">Auto-Detect Vendor Tier (Recommended)</option>
            <option value="dhav">Dahua (DHAV signature)</option>
            <option value="hikvision">Hikvision (MPEG-PS 0x000001BA)</option>
            <option value="generic">Generic (Annex B NAL carver)</option>
          </select>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-[#2d3148]">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 text-slate-400 hover:text-white text-xs px-4 py-2.5 rounded-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <button
            disabled={!selectedPath}
            onClick={handleProceed}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold px-6 py-2.5 rounded-sm flex items-center space-x-2 shadow-lg shadow-blue-600/20 transition-all"
          >
            <span>Start Forensic Carving</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>
    </div>
  );
};
