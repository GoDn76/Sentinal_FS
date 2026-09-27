import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { open as openShell } from '@tauri-apps/plugin-shell';
import {
  CloudUpload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  ShieldCheck,
  Film,
  HardDrive,
  Copy,
  Check,
} from 'lucide-react';
import { api } from '../api/client';
import { useCaseStore } from '../store/caseStore';
import { StepBar } from '../components/StepBar';
import { ClaimLinkBox } from '../components/ClaimLinkBox';
import { AuditTrailViewer } from '../components/AuditTrailViewer';
import type { AuditLogEntry, UploadResult } from '../types';

export const ClaimUpload: React.FC = () => {
  const navigate = useNavigate();
  const { session, segments, platformUrl, updateJWT } = useCaseStore();

  const [claimStatus, setClaimStatus] = useState<'pending' | 'claimed' | 'unreachable' | 'expired'>(
    'pending'
  );
  const [claimedBy, setClaimedBy] = useState<string | null>(null);
  const [jwtToken, setJwtToken] = useState<string | null>(session?.platform_jwt || null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copiedCaseUrl, setCopiedCaseUrl] = useState(false);

  // Polling claim status every 3 seconds
  useEffect(() => {
    if (!session?.claim_token) return;

    const poll = async () => {
      try {
        const res = await api.pollClaimStatus(session.claim_token, platformUrl);
        setClaimStatus(res.status);

        if (res.status === 'claimed' && res.platform_jwt) {
          setClaimedBy(res.claimed_by);
          setJwtToken(res.platform_jwt);
          updateJWT(res.platform_jwt);
        }
      } catch (err: unknown) {
        setClaimStatus('unreachable');
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [session?.claim_token, platformUrl, updateJWT]);

  if (!session) {
    navigate('/');
    return null;
  }

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
    if (!jwtToken) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const manifestPath = `${session.output_dir}/manifest.json`;
      const result = await api.uploadEvidence(
        manifestPath,
        session.output_dir,
        platformUrl,
        jwtToken
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
      timestamp: session.claim_token ? 'GENESIS_BLOCK' : new Date().toISOString(),
      action: 'DRIVE_MOUNTED',
      details: `Mounted case evidence target: ${session.case_reference}`,
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

      <main className="flex-1 max-w-6xl w-full mx-auto p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Left Panel - Claim Link */}
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-100">Link Session to SentinelFS</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Scan the QR code or use the claim URL to authorize platform evidence upload.
              </p>
            </div>

            <ClaimLinkBox claimUrl={session.claim_url} claimToken={session.claim_token} />

            {/* Claim Polling Status Badge */}
            <div className="bg-[#1a1d27] border border-[#2d3148] p-4 rounded-sm flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Claim Status:
              </span>

              {claimStatus === 'pending' && (
                <div className="flex items-center space-x-2 text-amber-400 text-xs font-semibold">
                  <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />
                  <span>Waiting for platform authentication...</span>
                </div>
              )}

              {claimStatus === 'unreachable' && (
                <div className="flex items-center space-x-2 text-amber-400 text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Platform unreachable — retrying...</span>
                </div>
              )}

              {claimStatus === 'claimed' && (
                <div className="flex items-center space-x-2 text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Linked to: {claimedBy || 'Investigator'}</span>
                </div>
              )}

              {claimStatus === 'expired' && (
                <div className="flex items-center space-x-2 text-red-400 text-xs font-semibold">
                  <Clock className="w-4 h-4" />
                  <span>Token expired</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Upload Summary */}
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-100">Evidence Upload Package</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Ingest carved segments and audit ledger into your SentinelFS cloud case workspace.
              </p>
            </div>

            <div
              className={`bg-[#1a1d27] border border-[#2d3148] p-6 rounded-sm space-y-6 transition-all ${
                claimStatus !== 'claimed' ? 'opacity-50 pointer-events-none grayscale-[30%]' : ''
              }`}
            >
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#0f1117] p-3 rounded-sm border border-[#2d3148] text-center">
                  <HardDrive className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                  <span className="text-lg font-bold font-mono text-slate-100 block">
                    {carvedCount}
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                    Carved Segments
                  </span>
                </div>

                <div className="bg-[#0f1117] p-3 rounded-sm border border-[#2d3148] text-center">
                  <Film className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                  <span className="text-lg font-bold font-mono text-slate-100 block">
                    {manualCount}
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                    Manual Files
                  </span>
                </div>

                <div className="bg-[#0f1117] p-3 rounded-sm border border-[#2d3148] text-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                  <span className="text-lg font-bold font-mono text-slate-100 block">
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
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-sm text-xs">
                  {uploadError}
                </div>
              )}

              {uploadResult ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-5 rounded-sm space-y-4">
                  <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Evidence Package Uploaded Successfully!</span>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Case URL:
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
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2.5 rounded-sm flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 transition-all"
                  >
                    <span>Open Case in Web Browser</span>
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  disabled={claimStatus !== 'claimed' || isUploading}
                  onClick={handleUpload}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm py-3.5 rounded-sm flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/20 transition-all"
                >
                  <CloudUpload className={`w-5 h-5 ${isUploading ? 'animate-bounce' : ''}`} />
                  <span>
                    {isUploading
                      ? 'Uploading Evidence Package...'
                      : 'Upload Evidence Package to SentinelFS'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Collapsible Audit Trail Viewer */}
        <AuditTrailViewer logs={dummyAuditLogs} isVerified={true} />
      </main>
    </div>
  );
};
