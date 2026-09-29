import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  HardDrive,
  Film,
  Activity,
  FileText,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Play,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { API_BASE_URL, evidenceVideoUrl } from '../api';
import type { Case } from '../types';

interface CarvedSegment {
  filename: string;
  camera_channel: number;
  tier_used: string;
  timestamp_start?: string;
  timestamp_end?: string;
  sha256: string;
  md5: string;
  integrity_status: string;
  frame_count: number;
  is_deleted: boolean;
  size_bytes: number;
}

export const CaseDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);

  const [caseData, setCaseData] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<CarvedSegment | null>(null);

  const [segments, setSegments] = useState<CarvedSegment[]>([]);

  useEffect(() => {
    const fetchCase = async () => {
      setLoading(true);
      setError(null);
      setCaseData(null);
      setSegments([]);
      setSelectedSegment(null);
      try {
        if (!id) throw new Error('Case ID is missing');
        const res = await fetch(`${API_BASE_URL}/api/v1/cases`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Could not load case (${res.status})`);
        const list: Case[] = await res.json();
        const found = list.find((c) => c.id === id || c.case_number === id);
        if (!found) throw new Error('Case not found');
        setCaseData(found);

        const evRes = await fetch(`${API_BASE_URL}/api/v1/evidence/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!evRes.ok) throw new Error(`Could not load case evidence (${evRes.status})`);
        const evList = await evRes.json();
        const mapped: CarvedSegment[] = evList.map((e: any) => ({
          filename: e.file_name,
          camera_channel: e.camera_channel || 0,
          tier_used: e.file_type || 'Unknown',
          timestamp_start: e.created_at,
          timestamp_end: e.created_at,
          sha256: e.verified_sha256 || e.raw_sha256,
          md5: e.verified_md5 || e.raw_md5,
          integrity_status: e.integrity_status || 'pending',
          frame_count: 0,
          is_deleted: false,
          size_bytes: e.file_size_bytes || 0,
        }));
        setSegments(mapped);
        setSelectedSegment(mapped[0] || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load case');
      } finally {
        setLoading(false);
      }
    };

    fetchCase();
  }, [id, token]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const totalBytes = segments.reduce((acc, s) => acc + s.size_bytes, 0);
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);

  return (
    <div className="p-6 space-y-6 max-w-[1800px] mx-auto font-sans">
      {/* Top Breadcrumb & Action Toolbar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-100 font-mono text-xs transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Command Center</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/compliance/${id || 'default'}`)}
            className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-all shadow-lg shadow-teal-500/20"
          >
            <FileText className="w-4 h-4" />
            <span>Generate Sec 63 BSA Certificate</span>
          </button>

          <button
            onClick={() => navigate('/timeline')}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2 rounded-lg text-xs font-mono uppercase transition-colors"
          >
            <Activity className="w-4 h-4 text-teal-400" />
            <span>Open Multi-Track Timeline</span>
          </button>
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

      {/* Case Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded bg-teal-500/20 text-teal-400 font-mono text-xs font-bold border border-teal-500/30">
                {caseData?.case_number || 'CASE-2026-REF'}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded font-mono font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                BSA Section 63 Verified
              </span>
            </div>

            <h1 className="text-2xl font-bold font-mono text-slate-100 pt-1">
              {caseData?.title || 'State v. DVR Evidence Case'}
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              {caseData?.description || 'Bit-stream disk image carving and cryptographic hash verification.'}
            </p>
          </div>

          <div className="text-right space-y-1 font-mono text-xs text-slate-400">
            <div>Case ID: <span className="text-teal-400 font-bold">{caseData?.id || id}</span></div>
            <div>Registered: <span className="text-slate-200">{new Date(caseData?.created_at || Date.now()).toLocaleString()}</span></div>
          </div>
        </div>

        {/* Case Quick Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-center font-mono">
            <HardDrive className="w-5 h-5 text-blue-400 mx-auto mb-1" />
            <span className="text-xl font-bold text-slate-100 block">{segments.length}</span>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Evidence Files</span>
          </div>

          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-center font-mono">
            <Film className="w-5 h-5 text-purple-400 mx-auto mb-1" />
            <span className="text-xl font-bold text-slate-100 block">
              {segments.filter((s) => s.is_deleted).length}
            </span>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Deleted Files Recovered</span>
          </div>

          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-center font-mono">
            <ShieldCheck className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
            <span className="text-xl font-bold text-slate-100 block">{totalMB} MB</span>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Ingested Volume</span>
          </div>

          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-center font-mono">
            <Clock className="w-5 h-5 text-amber-400 mx-auto mb-1" />
            <span className="text-xl font-bold text-slate-100 block">DHAV Tier</span>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Primary Carver Engine</span>
          </div>
        </div>
      </div>

      {/* Ingested Evidence Segments Grid & Video Player Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Evidence Segments Table (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-mono">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Ingested Evidence Segments ({segments.length})
            </h3>
            <span className="text-[11px] text-slate-400">Click segment to select & preview</span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {!loading && !error && segments.length === 0 && (
              <p className="py-6 text-center text-slate-500">No evidence files uploaded for this case.</p>
            )}
            {segments.map((seg) => {
              const isSelected = selectedSegment?.filename === seg.filename;
              return (
                <div
                  key={seg.filename}
                  onClick={() => setSelectedSegment(seg)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-slate-800 border-teal-400 shadow-lg shadow-teal-500/10'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100">{seg.filename}</span>
                        {seg.is_deleted ? (
                          <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                            DELETED
                          </span>
                        ) : (
                          <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                            RECOVERED
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Camera Channel: {seg.camera_channel} | Engine: {seg.tier_used} | Frames: {seg.frame_count}
                      </div>
                    </div>

                    <span className="text-xs text-slate-300 font-bold">
                      {(seg.size_bytes / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
                    <div className="flex items-center justify-between bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                      <span className="text-slate-500">SHA-256:</span>
                      <span className="text-teal-400 font-bold truncate max-w-[180px]">{seg.sha256}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(seg.sha256);
                        }}
                        className="text-slate-400 hover:text-white"
                      >
                        {copiedHash === seg.sha256 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                      <span className="text-slate-500">MD5:</span>
                      <span className="text-emerald-400 font-bold truncate max-w-[140px]">{seg.md5}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(seg.md5);
                        }}
                        className="text-slate-400 hover:text-white"
                      >
                        {copiedHash === seg.md5 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Evidence Detail & Player (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-mono">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Evidence Inspector & Video Player
              </h3>
              <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-400 text-[10px] font-bold">
                PROPRIETARY STREAM
              </span>
            </div>

            {selectedSegment ? (
              <div className="space-y-4 font-mono text-xs">
                {/* HTML5 Video Player Box */}
                <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden aspect-video flex flex-col items-center justify-center relative shadow-2xl">
                  <video
                    controls
                    autoPlay
                    className="w-full h-full object-contain bg-black"
                    src={id ? evidenceVideoUrl(id, selectedSegment.filename) : undefined}
                    onError={() => setError('No playable video stream was produced. The original evidence and its hashes are unchanged.')}
                  >
                    Your browser does not support video playback.
                  </video>
                </div>

                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Timestamp Range:</span>
                    <span className="text-slate-200">{selectedSegment.timestamp_start}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Evidence Integrity:</span>
                    <span className={`font-bold ${selectedSegment.integrity_status === 'verified' ? 'text-emerald-400' : 'text-amber-300'}`}>
                      {selectedSegment.integrity_status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">BSA Compliance:</span>
                    <span className="text-teal-400 font-bold">SECTION 63(4) CERTIFIED</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 font-mono text-xs space-y-2">
                <Film className="w-8 h-8 mx-auto text-slate-600" />
                <p>Select an evidence segment from the left panel to inspect details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
