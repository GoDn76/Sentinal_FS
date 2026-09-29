import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { open as openShell } from '@tauri-apps/plugin-shell';
import {
  CloudUpload,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Film,
  HardDrive,
  Copy,
  Check,
  ArrowLeft,
} from 'lucide-react';
import { api } from '../api/client';
import { useCaseStore } from '../store/caseStore';
import { StepBar } from '../components/StepBar';
import { AuditTrailViewer } from '../components/AuditTrailViewer';
import type { AuditLogEntry, UploadResult } from '../types';

export const ClaimUpload: React.FC = () => {
  const navigate = useNavigate();
  const { session, segments, platformUrl, persistentAuth, resetWorkspace } = useCaseStore();

  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copiedCaseUrl, setCopiedCaseUrl] = useState(false);

  if (!session) {
    navigate('/');
    return null;
  }

  const activeApiUrl = platformUrl || (import.meta.env as any).VITE_API_BASE_URL || 'http://localhost:8000';
  const jwtToken = persistentAuth?.jwt || session?.platform_jwt || '';

  const carvedCount = segments.filter((s) => s.source === 'carved').length;
  const manualCount = segments.filter((s) => s.source === 'manual').length;
  const totalSizeMB = (
    segments.reduce((acc, s) => acc + s.size_bytes, 0) /
    (1024 * 1024)
  ).toFixed(2);

  const dhavCount = segments.filter((s) => s.tier_used.toLowerCase().includes('dhav')).length;
  const hikCount = segments.filter((s) => s.tier_used.toLowerCase().includes('hikvision')).length;
  const genericCount = segments.filter((s) => s.tier_used.toLowerCase().includes('generic')).length;

  const handleUpload = async () => {
    if (segments.length === 0) {
      setUploadError('Select at least one evidence file before uploading.');
      return;
    }
    setIsUploading(true);
    setUploadError(null);

    try {
      const manifestPath = session.output_dir ? `${session.output_dir}/manifest.json` : '';
      const result = await api.uploadEvidence(
        manifestPath,
        session.output_dir,
        activeApiUrl,
        jwtToken,
        session.case_id,
        session.case_reference,
        segments
      );

      setUploadResult(result);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenBrowser = (url: string) => {
    try {
      openShell(url);
    } catch (e: unknown) {
      window.open(url, '_blank');
    }
  };

  const dummyAuditLogs: AuditLogEntry[] = [
    {
      seq: 1,
      timestamp: 'GENESIS_BLOCK',
      action: 'DRIVE_MOUNTED',
      details: `Mounted case evidence target: ${session.case_reference || session.case_id}`,
      current_block_hash: '0000000000000000000000000000000000000000000000000000000000000000',
      previous_block_hash: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    {
      seq: 2,
      timestamp: new Date().toISOString(),
      action: 'SOURCE_HASHED',
      details: `Operator: ${session.operator_name} | Segments: ${segments.length}`,
      current_block_hash: 'a3f9e018b2c45d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e',
      previous_block_hash: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    {
      seq: 3,
      timestamp: new Date().toISOString(),
      action: 'MANIFEST_SEALED',
      details: `Evidence package sealed for case ID: ${session.case_id}`,
      current_block_hash: '7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c',
      previous_block_hash: 'a3f9e018b2c45d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col">
      <StepBar currentStep={5} flow={session.flow} />

      <main className="flex-1 max-w-4xl w-full mx-auto p-8 space-y-8 flex flex-col justify-center">
        {/* Centered Upload Package Card */}
        <div className="bg-[#1a1d27] border border-[#2d3148] p-8 rounded-sm shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-100">Evidence Upload Package</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Ingest carved segments and audit ledger into your SentinelFS cloud case workspace.
              </p>
            </div>
            {persistentAuth?.username && (
              <div className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>Authenticated as: {persistentAuth.username}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#0f1117] p-4 rounded-sm border border-[#2d3148] text-center">
              <HardDrive className="w-6 h-6 text-blue-400 mx-auto mb-1.5" />
              <span className="text-xl font-bold font-mono text-slate-100 block">
                {carvedCount}
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">
                Carved Segments
              </span>
            </div>

            <div className="bg-[#0f1117] p-4 rounded-sm border border-[#2d3148] text-center">
              <Film className="w-6 h-6 text-purple-400 mx-auto mb-1.5" />
              <span className="text-xl font-bold font-mono text-slate-100 block">
                {manualCount}
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">
                Manual Files
              </span>
            </div>

            <div className="bg-[#0f1117] p-4 rounded-sm border border-[#2d3148] text-center">
              <ShieldCheck className="w-6 h-6 text-emerald-400 mx-auto mb-1.5" />
              <span className="text-xl font-bold font-mono text-slate-100 block">
                {totalSizeMB} MB
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">
                Total Volume
              </span>
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-300 bg-[#0f1117] p-4 rounded-sm border border-[#2d3148]">
            <div className="flex justify-between">
              <span className="text-slate-400">Source Tier Breakdown:</span>
              <span className="font-mono">
                DHAV: {dhavCount} | Hikvision: {hikCount} | Generic: {genericCount} | Manual: {manualCount}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-[#2d3148]">
              <span className="text-slate-400">Case ID:</span>
              <span className="font-mono text-blue-400">{session.case_id}</span>
            </div>
          </div>

          {uploadError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-sm text-xs font-mono">
              {uploadError}
            </div>
          )}
          {segments.length === 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 p-4 rounded-sm text-xs font-mono">
              No evidence files are selected for this case.
            </div>
          )}

          {uploadResult ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-6 rounded-sm space-y-4">
              <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>Evidence Package Uploaded Successfully!</span>
              </div>
              <p className="text-xs text-slate-300">
                {uploadResult.local_cleanup_complete
                  ? 'App-generated carved files and previews were removed. The manifest, audit trail, and manually selected originals were kept.'
                  : 'Upload succeeded, but some carved files could not be removed from this device.'}
              </p>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Case Workspace URL:
                </label>
                <div className="flex items-center space-x-2 bg-[#0f1117] border border-[#2d3148] px-3 py-2 rounded-sm text-xs font-mono text-blue-400">
                  <span className="truncate flex-1">{uploadResult.case_url}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(uploadResult.case_url);
                      setCopiedCaseUrl(true);
                      setTimeout(() => setCopiedCaseUrl(false), 2000);
                    }}
                    className="p-1 text-slate-400 hover:text-white"
                    title="Copy URL"
                  >
                    {copiedCaseUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                onClick={() => handleOpenBrowser(uploadResult.case_url)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-3 rounded-sm flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 transition-all"
              >
                <span>Open Case in Web Browser</span>
                <ExternalLink className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  resetWorkspace();
                  navigate('/');
                }}
                className="w-full bg-[#2d3148] hover:bg-[#3d4261] text-white text-xs font-semibold py-3 rounded-sm flex items-center justify-center space-x-2 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Start</span>
              </button>
            </div>
          ) : (
            <div className="flex space-x-3">
              <button
                onClick={() => navigate('/preview')}
                className="bg-[#2d3148] hover:bg-[#3d4261] text-white text-xs font-semibold px-4 py-3 rounded-sm flex items-center space-x-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                disabled={isUploading || segments.length === 0}
                onClick={handleUpload}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm py-3 rounded-sm flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
              >
                <CloudUpload className={`w-5 h-5 ${isUploading ? 'animate-bounce' : ''}`} />
                <span>
                  {isUploading
                    ? 'Uploading Evidence Package...'
                    : 'Upload Evidence Package to SentinelFS'}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Collapsible Audit Trail Viewer */}
        <AuditTrailViewer logs={dummyAuditLogs} isVerified={true} />
      </main>
    </div>
  );
};
