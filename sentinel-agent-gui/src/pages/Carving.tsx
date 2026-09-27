import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldAlert, RefreshCw, ArrowRight } from 'lucide-react';
import { api } from '../api/client';
import { useCaseStore } from '../store/caseStore';
import { StepBar } from '../components/StepBar';
import { ProgressRing } from '../components/ProgressRing';

export const Carving: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, setJobId, setProgress, setSegments } = useCaseStore();

  const inputPath = location.state?.inputPath || session?.output_dir || '';
  const vendorHint = location.state?.vendorHint || '';

  const [logs, setLogs] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const [localProgress, setLocalProgress] = useState({
    percentage: 0,
    segmentsFound: 0,
    currentAction: 'Starting carver engine...',
    status: 'running',
  });

  useEffect(() => {
    if (!session) {
      navigate('/');
      return;
    }

    let activeJobId: string | null = null;
    let intervalId: NodeJS.Timeout | null = null;

    const start = async () => {
      try {
        const id = await api.startCarving(
          inputPath,
          session.output_dir,
          session.operator_name,
          session.case_id,
          vendorHint
        );

        activeJobId = id;
        setJobId(id);

        intervalId = setInterval(async () => {
          if (!activeJobId) return;

          try {
            const p = await api.getCarvingProgress(activeJobId);
            setProgress(p);

            const pct = p.total_bytes > 0 ? (p.bytes_scanned / p.total_bytes) * 100 : 0;
            setLocalProgress({
              percentage: Math.min(100, Math.max(0, pct)),
              segmentsFound: p.segments_found,
              currentAction: p.current_action,
              status: p.status,
            });

            if (p.current_action) {
              setLogs((prev) => {
                if (prev[prev.length - 1] === p.current_action) return prev;
                return [...prev.slice(-49), p.current_action];
              });
            }

            if (p.status === 'complete') {
              if (intervalId) clearInterval(intervalId);
              setIsDone(true);
              const segs = await api.getCarvedSegments(session.output_dir);
              setSegments(segs);
              setTimeout(() => {
                navigate('/preview');
              }, 1500);
            } else if (p.status === 'error') {
              if (intervalId) clearInterval(intervalId);
              setErrorMsg(p.error_message || 'An unknown error occurred during carving.');
            }
          } catch (e: unknown) {
            console.error('Error polling progress:', e);
          }
        }, 500);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      }
    };

    start();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [session, inputPath, vendorHint, navigate, setJobId, setProgress, setSegments]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col">
      <StepBar currentStep={3} flow="carving" />

      <main className="flex-1 max-w-4xl w-full mx-auto p-8 space-y-8 flex flex-col justify-center">
        <div className="bg-[#1a1d27] border border-[#2d3148] p-8 rounded-sm shadow-xl space-y-8">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-slate-100">Forensic Video Carving in Progress</h2>
            <p className="text-xs text-slate-400 font-mono">Source: {inputPath}</p>
          </div>

          <ProgressRing
            percentage={localProgress.percentage}
            statusText={isDone ? 'Carving Complete! Loading evidence...' : localProgress.currentAction}
          />

          <div className="flex items-center justify-around bg-[#0f1117] border border-[#2d3148] p-4 rounded-sm">
            <div className="text-center">
              <span className="text-xs text-slate-400 font-semibold uppercase block">
                Carved Segments
              </span>
              <span className="text-2xl font-bold font-mono text-emerald-400">
                {localProgress.segmentsFound}
              </span>
            </div>
            <div className="h-8 w-px bg-[#2d3148]" />
            <div className="text-center">
              <span className="text-xs text-slate-400 font-semibold uppercase block">
                Status
              </span>
              <span className="text-sm font-semibold uppercase tracking-wider text-blue-400">
                {localProgress.status}
              </span>
            </div>
          </div>

          {errorMsg ? (
            <div className="bg-red-500/10 border border-red-500/30 p-5 rounded-sm space-y-4">
              <div className="flex items-start space-x-3 text-red-400 text-sm">
                <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold">Carving Error Encountered</h4>
                  <p className="text-xs text-red-300/90 mt-1 font-mono">{errorMsg}</p>
                </div>
              </div>
              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => navigate('/drive')}
                  className="bg-[#2d3148] hover:bg-[#3d4261] text-white px-4 py-2 rounded-sm text-xs font-semibold flex items-center space-x-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Try Again</span>
                </button>
                <button
                  onClick={async () => {
                    if (session) {
                      const segs = await api.getCarvedSegments(session.output_dir);
                      setSegments(segs);
                    }
                    navigate('/preview');
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-sm text-xs font-semibold flex items-center space-x-1.5"
                >
                  <span>Continue Anyway</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Live Audit & Scanner Log:
              </span>
              <div className="bg-[#0f1117] border border-[#2d3148] p-4 rounded-sm h-36 overflow-y-auto font-mono text-xs text-slate-300 space-y-1">
                {logs.map((line, idx) => (
                  <div key={idx} className="leading-relaxed">
                    <span className="text-blue-400 select-none mr-2">&gt;</span>
                    {line}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          )}

          {!isDone && !errorMsg && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => navigate('/drive')}
                className="text-xs text-red-400 hover:text-red-300 font-semibold px-4 py-2 rounded border border-red-500/20 hover:border-red-500/40 transition-colors"
              >
                Cancel Job & Return to Source Selection
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
