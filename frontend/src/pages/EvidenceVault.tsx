import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HardDrive,
  Upload,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  BrainCircuit,
  Play,
  Sparkles,
  FileVideo
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useCaseStore } from '../store/useCaseStore';
import { API_BASE_URL, evidenceVideoUrl } from '../api';
import { Evidence } from '../types';

export const EvidenceVault: React.FC = () => {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const { activeCase, evidences, setEvidences } = useCaseStore();

  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchEvidence = async (caseId: string, signal?: AbortSignal) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/evidence/${caseId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (!res.ok) {
        throw new Error(`Could not load evidence (${res.status})`);
      }
      const data: Evidence[] = await res.json();
      if (useCaseStore.getState().activeCase?.id === caseId) {
        setEvidences(data);
        setError(null);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Fetch evidence error:', err);
      if (useCaseStore.getState().activeCase?.id === caseId) {
        setEvidences([]);
        setError(err instanceof Error ? err.message : 'Could not load evidence');
      }
    }
  };

  useEffect(() => {
    setEvidences([]);
    setError(null);
    if (!activeCase?.id) return;

    const controller = new AbortController();
    void fetchEvidence(activeCase.id, controller.signal);
    return () => controller.abort();
  }, [activeCase?.id, token]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !activeCase?.id || !token) return;
    setUploading(true);
    setError(null);

    const targetCaseId = activeCase.id;
    const formData = new FormData();
    formData.append('case_id', targetCaseId);
    formData.append('file', file);
    formData.append('file_type', file.name.endsWith('.mp4') ? 'normalized_mp4' : 'raw_disk');

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/evidence/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const response = await res.json().catch(() => null);
        throw new Error(response?.detail || `Upload failed (${res.status})`);
      }
      setFile(null);
      await fetchEvidence(targetCaseId);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleVerifyHash = async (evidenceId: string) => {
    setVerifyingId(evidenceId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/evidence/${evidenceId}/verify-hash`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        if (activeCase) fetchEvidence(activeCase.id);
      }
    } catch (err) {
      console.error('Verify hash error:', err);
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1800px] mx-auto font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider">
              Cryptographic Evidence Locker
            </div>
            <h1 className="text-lg font-mono font-bold text-slate-100">
              Evidence Vault & Hash Verification Matrix
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <button
            onClick={() => navigate('/analysis')}
            className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold flex items-center gap-2 transition-all shadow-lg shadow-teal-500/20 uppercase"
          >
            <BrainCircuit className="w-4 h-4" />
            <span>Open AI Analysis Page</span>
          </button>

          <button
            onClick={() => activeCase && fetchEvidence(activeCase.id)}
            className="px-3.5 py-2 rounded-lg bg-slate-800 text-slate-300 font-mono hover:bg-slate-700 flex items-center gap-2 border border-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh Vault</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Upload Form */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-slate-200 font-mono text-xs font-bold uppercase border-b border-slate-800 pb-3">
            <Upload className="w-4 h-4 text-teal-400" />
            <span>Upload Disk Image / Video File</span>
          </div>

          <form onSubmit={handleUpload} className="space-y-4 font-mono text-xs">
            {!activeCase && (
              <p className="text-amber-300">Select a case before uploading evidence.</p>
            )}
            {error && (
              <p role="alert" className="text-red-300">{error}</p>
            )}
            <div>
              <label className="block text-slate-400 mb-1">Select File (.dd, .raw, .dav, .mp4)</label>
              <input
                type="file"
                required
                disabled={!activeCase || uploading}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-teal-400"
              />
            </div>

            <button
              type="submit"
              disabled={uploading || !file || !activeCase}
              className="w-full py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold uppercase transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>{uploading ? 'Calculating Hashes & Uploading...' : 'Upload & Compute Hashes'}</span>
            </button>
          </form>
        </div>

        {/* Right Column: Evidence File Table */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-mono text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-200 uppercase">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Sealed Evidence File Inventory</span>
            </div>
            <span className="text-slate-400 font-bold">{evidences.length} EVIDENCE FILES REGISTERED</span>
          </div>

          {/* Video Preview Card if active */}
          {previewVideoUrl && (
            <div className="bg-slate-950 p-4 rounded-lg border border-teal-500/40 space-y-2 relative">
              <div className="flex justify-between items-center text-xs font-mono text-teal-400 font-bold">
                <span>Active Vault Video Stream</span>
                <button
                  onClick={() => setPreviewVideoUrl(null)}
                  className="text-slate-400 hover:text-slate-200 text-xs"
                >
                  ✕ Close Preview
                </button>
              </div>
              <video
                controls
                autoPlay
                src={previewVideoUrl}
                onError={() => setPlaybackError('No playable video stream was produced. The original evidence and its hashes are unchanged.')}
                className="w-full aspect-video rounded bg-black max-h-[360px]"
              />
              {playbackError && <p role="alert" className="text-amber-300 text-xs">{playbackError}</p>}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                  <th className="py-2.5 px-3">File Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">SHA-256 Checksum</th>
                  <th className="py-2.5 px-3">Integrity</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {evidences.map((item) => {
                  const itemVideoUrl = evidenceVideoUrl(item.case_id, item.file_name);
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-100 flex items-center gap-2">
                        <FileVideo className="w-4 h-4 text-teal-400" />
                        <span>{item.file_name}</span>
                      </td>
                      <td className="py-3 px-3 uppercase text-slate-400">{item.file_type}</td>
                      <td className="py-3 px-3 font-mono text-teal-400 truncate max-w-xs">{item.raw_sha256}</td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-bold text-[10px] ${
                          item.integrity_status === 'verified'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {item.integrity_status === 'verified' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          {item.integrity_status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right space-x-2">
                        <button
                          onClick={() => {
                            setPlaybackError(null);
                            setPreviewVideoUrl(itemVideoUrl);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 font-bold transition-colors inline-flex items-center gap-1"
                        >
                          <Play className="w-3 h-3" />
                          <span>Play</span>
                        </button>

                        <button
                          onClick={() => navigate('/analysis')}
                          className="px-2.5 py-1 rounded bg-purple-500/20 border border-purple-500/30 hover:bg-purple-500/30 text-purple-300 font-bold transition-colors inline-flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3 text-purple-400" />
                          <span>Trigger AI Analysis</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!evidences.length && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500 italic">
                      {activeCase ? 'No evidence files uploaded for this case yet.' : 'Select a case to view its evidence.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
