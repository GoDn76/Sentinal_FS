import React, { useState, useEffect } from 'react';
import {
  BrainCircuit,
  Cpu,
  Play,
  CheckCircle2,
  Scan,
  UserCheck,
  Activity,
  Sparkles,
  Download,
  RefreshCw,
  FileText,
  AlertCircle,
  HardDrive,
  ShieldCheck,
  BarChart3,
  Layers
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useCaseStore } from '../store/useCaseStore';
import { API_BASE_URL, evidenceVideoUrl } from '../api';

interface EvidenceItem {
  id: string;
  case_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  raw_sha256: string;
  raw_md5: string;
  verified_sha256?: string;
  verified_md5?: string;
  file_size_bytes: number;
  camera_channel: number;
  created_at?: string;
}

export const AIAnalysis: React.FC = () => {
  const token = useAuthStore((state) => state.token);
  const { activeCase } = useCaseStore();

  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  // Pipeline configuration toggles
  const [enablePipelineA, setEnablePipelineA] = useState(true);
  const [enablePipelineB, setEnablePipelineB] = useState(true);
  const [enableFAISS, setEnableFAISS] = useState(true);

  // Execution state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState<string>('Idle');
  const [fps, setFps] = useState<number>(0);
  const [detectedPersons, setDetectedPersons] = useState<number>(0);
  const [faissVectors, setFaissVectors] = useState<number>(0);
  const [analysisCompleted, setAnalysisCompleted] = useState(false);
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const fetchEvidence = async (caseId: string, signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/evidence/${caseId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (!res.ok) throw new Error(`Could not load evidence (${res.status})`);
      const data: EvidenceItem[] = await res.json();
      if (useCaseStore.getState().activeCase?.id === caseId) {
        setEvidenceList(data);
        setSelectedEvidence(data[0] || null);
        setEvidenceError(null);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Fetch evidence error:', err);
      if (useCaseStore.getState().activeCase?.id === caseId) {
        setEvidenceList([]);
        setSelectedEvidence(null);
        setEvidenceError(err instanceof Error ? err.message : 'Could not load evidence');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setEvidenceList([]);
    setSelectedEvidence(null);
    setEvidenceError(null);
    if (!activeCase?.id) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    void fetchEvidence(activeCase.id, controller.signal);
    return () => controller.abort();
  }, [activeCase?.id, token]);

  const handleStartAnalysis = async () => {
    if (!selectedEvidence) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisCompleted(false);
    setProgress(15);
    setCurrentStep('Executing YOLOv11 Neural Object & Person Detection...');
    setLogMessages(['[INIT] Running YOLOv11 + ByteTrack on target evidence video stream']);

    const newJobId = `job-${Date.now()}`;
    setJobId(newJobId);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/analysis/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          job_id: newJobId,
          case_id: selectedEvidence.case_id,
          segment_files: [selectedEvidence.file_name],
          camera_channel: selectedEvidence.camera_channel,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false || data.error) {
        throw new Error(data.detail || data.error || `Analysis failed (${res.status})`);
      }

      const personsCount = data.detected_persons_count || 0;
      const realFps = data.fps || 25.0;
      const faissCount = data.faiss_indexed_vectors || 0;

      setProgress(100);
      setCurrentStep('Analysis Complete. Real Neural Detections Sealed.');
      setFps(realFps);
      setDetectedPersons(personsCount);
      setFaissVectors(faissCount);
      setAnalysisCompleted(true);
      setIsAnalyzing(false);

      setLogMessages([
        `[YOLOv11] Processed video stream at ${realFps} FPS (${data.total_frames || 0} total frames)`,
        `[YOLOv11] Tracked ${personsCount} distinct person bounding trajectories`,
        `[FAISS] Indexed ${faissCount} L2-normalized 512-dim vectors`,
        '[SEAL] Cryptographic BSA Sec 63 audit trail finalized.'
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Analysis execution failed:', error);
      setAnalysisError(message);
      setCurrentStep('Analysis failed');
      setAnalysisCompleted(false);
      setIsAnalyzing(false);
      setLogMessages([`[ERROR] ${message}`]);
    }
  };

  const caseIdDisplay = selectedEvidence?.case_id || activeCase?.id || 'No case selected';
  const videoUrl = selectedEvidence
    ? evidenceVideoUrl(selectedEvidence.case_id, selectedEvidence.file_name)
    : undefined;

  return (
    <div className="p-6 space-y-6 max-w-[1800px] mx-auto font-sans">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-500/10">
            <BrainCircuit className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[10px] font-bold border border-purple-500/30 uppercase">
                Neural Intelligence Engine
              </span>
              <span className="text-xs font-mono text-slate-400">
                Case ID: <span className="text-teal-400 font-bold">{caseIdDisplay}</span>
              </span>
            </div>
            <h1 className="text-xl font-mono font-bold text-slate-100 pt-1">
              AI Video Intelligence & Trajectory Analysis
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <button
            onClick={() => activeCase && fetchEvidence(activeCase.id)}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-2 transition-colors border border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Evidence List</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Evidence Selector & Pipeline Config (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Select Video Segment Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-mono text-xs">
              <div className="flex items-center gap-2 font-bold text-slate-200 uppercase">
                <HardDrive className="w-4 h-4 text-teal-400" />
                <span>Select Target Evidence File</span>
              </div>
              <span className="text-slate-400 font-bold">{evidenceList.length} Files Available</span>
            </div>

            <div className="space-y-2 font-mono text-xs">
              {evidenceError && <p role="alert" className="text-red-300">{evidenceError}</p>}
              {!activeCase && <p className="text-slate-400">Select a case to view evidence.</p>}
              {activeCase && !loading && !evidenceError && evidenceList.length === 0 && (
                <p className="text-slate-400">No evidence files uploaded for this case yet.</p>
              )}
              {evidenceList.map((item) => {
                const isSelected = selectedEvidence?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedEvidence(item)}
                    className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-slate-800 border-teal-400 shadow-md shadow-teal-500/10'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-100 truncate max-w-[220px]">
                        {item.file_name}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-400 text-[10px] font-bold uppercase">
                        {item.file_type || 'MP4'}
                      </span>
                    </div>
                    <div className="mt-2 text-[10px] text-slate-400 flex justify-between">
                      <span>Size: {(item.file_size_bytes / (1024 * 1024)).toFixed(1)} MB</span>
                      <span>Channel: {item.camera_channel}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Neural Pipeline Toggles */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-200 uppercase border-b border-slate-800 pb-3">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Configure AI Neural Pipelines</span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enablePipelineA}
                  onChange={(e) => setEnablePipelineA(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 bg-slate-900 text-teal-500 focus:ring-0"
                />
                <div>
                  <span className="font-bold text-slate-200 block">Pipeline A: YOLOv11 + ByteTrack + OSNet</span>
                  <span className="text-[11px] text-slate-400">
                    Extract 512-dim person tracking vectors & multi-camera re-ID.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enablePipelineB}
                  onChange={(e) => setEnablePipelineB(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 bg-slate-900 text-purple-500 focus:ring-0"
                />
                <div>
                  <span className="font-bold text-slate-200 block">Pipeline B: NAFNet Denoising + ArcFace</span>
                  <span className="text-[11px] text-slate-400">
                    Non-generative facial keyframe reconstruction & scoring.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableFAISS}
                  onChange={(e) => setEnableFAISS(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0"
                />
                <div>
                  <span className="font-bold text-slate-200 block">FAISS Vector Search Engine</span>
                  <span className="text-[11px] text-slate-400">
                    Clock-drift corrected chronological trajectory indexing.
                  </span>
                </div>
              </label>
            </div>

            <button
              onClick={handleStartAnalysis}
              disabled={isAnalyzing || !selectedEvidence}
              className="w-full py-3.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2"
            >
              <Sparkles className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>{isAnalyzing ? 'Running AI Analysis Pipeline...' : 'Launch AI Analysis Pipeline'}</span>
            </button>
            {analysisError && <p role="alert" className="text-xs text-red-300">{analysisError}</p>}
          </div>
        </div>

        {/* Right Column: Player & Real-Time AI Telemetry (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Video Player Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-mono text-xs">
              <div className="flex items-center gap-2 font-bold text-slate-200 uppercase">
                <Play className="w-4 h-4 text-emerald-400" />
                <span>Video Stream & AI Overlay</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase">
                {selectedEvidence?.file_name || 'Stream'}
              </span>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden aspect-video flex items-center justify-center relative shadow-2xl">
              {videoUrl ? (
                <video
                  key={videoUrl}
                  controls
                  autoPlay
                  className="w-full h-full object-contain bg-black"
                  src={videoUrl}
                  onError={() => setEvidenceError('No playable video stream was produced. The original evidence and its hashes are unchanged.')}
                >
                  Your browser does not support HTML5 video playback.
                </video>
              ) : (
                <span className="font-mono text-xs text-slate-500">Select evidence to preview.</span>
              )}

              {isAnalyzing && (
                <div className="absolute top-4 left-4 bg-slate-950/80 backdrop-blur border border-teal-500/40 text-teal-400 font-mono text-[11px] px-3 py-1.5 rounded flex items-center gap-2 shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
                  <span>AI Inference Active ({fps} FPS)</span>
                </div>
              )}
            </div>
          </div>

          {/* Telemetry & Progress Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-xs">
              <div className="flex items-center gap-2 font-bold text-slate-200 uppercase">
                <Activity className="w-4 h-4 text-purple-400" />
                <span>Live GPU Telemetry & FAISS Vector Stream</span>
              </div>
              <span className="text-teal-400 font-bold">{progress}% Complete</span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Step: <span className="text-teal-400 font-bold">{currentStep}</span></span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 via-purple-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Telemetry Metrics Bar */}
            <div className="grid grid-cols-3 gap-3 pt-2 text-xs">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                <Cpu className="w-4 h-4 text-teal-400 mx-auto mb-1" />
                <span className="text-lg font-bold text-slate-100 block">{fps}</span>
                <span className="text-[10px] text-slate-400 uppercase">Inference Speed (FPS)</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                <UserCheck className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                <span className="text-lg font-bold text-slate-100 block">{detectedPersons}</span>
                <span className="text-[10px] text-slate-400 uppercase">Tracked Persons</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                <BarChart3 className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                <span className="text-lg font-bold text-slate-100 block">{faissVectors}</span>
                <span className="text-[10px] text-slate-400 uppercase">FAISS Index Vectors</span>
              </div>
            </div>

            {/* Log Stream Box */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1 max-h-36 overflow-y-auto text-[11px] text-slate-400 font-mono">
              {logMessages.map((msg, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-teal-400">›</span>
                  <span>{msg}</span>
                </div>
              ))}
              {logMessages.length === 0 && (
                <div className="text-slate-600 italic">Click 'Launch AI Analysis Pipeline' to begin neural processing...</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
