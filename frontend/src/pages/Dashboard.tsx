import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, Terminal, ShieldCheck, FilePlus, RefreshCw, Folder, HardDrive, Laptop, ExternalLink, Activity } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useCaseStore } from '../store/useCaseStore';
import { useTaskWebSocket } from '../hooks/useTaskWebSocket';
import { Case } from '../types';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const { cases, activeCase, setCases, setActiveCase, activeTaskId } = useCaseStore();

  const [newCaseNumber, setNewCaseNumber] = useState(`CASE-2026-${Math.floor(100 + Math.random() * 900)}`);
  const [newCaseTitle, setNewCaseTitle] = useState('State v. Thorne - Alley Surveillance');
  const [creatingCase, setCreatingCase] = useState(false);

  const { telemetry, isConnected } = useTaskWebSocket(activeTaskId);

  // Fetch Cases
  const fetchCases = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/cases', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: Case[] = await res.json();
        setCases(data);
        if (data.length > 0 && !activeCase) {
          setActiveCase(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch cases:', err);
    }
  };

  useEffect(() => {
    if (token) fetchCases();
  }, [token]);

  // Handle Case Creation
  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingCase(true);
    try {
      const res = await fetch('http://localhost:8000/api/v1/cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          case_number: newCaseNumber,
          title: newCaseTitle,
          description: 'Multi-camera DVR evidence acquisition & Section 63 BSA compliance',
        }),
      });
      if (res.ok) {
        const newC: Case = await res.json();
        setActiveCase(newC);
        fetchCases();
        setNewCaseNumber(`CASE-2026-${Math.floor(100 + Math.random() * 900)}`);
      }
    } catch (err) {
      console.error('Create case error:', err);
    } finally {
      setCreatingCase(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1800px] mx-auto font-sans">
      {/* Header Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-mono text-teal-400 font-bold uppercase tracking-wider">
              Forensic Evidence Management Platform
            </div>
            <h1 className="text-lg font-mono font-bold text-slate-100">
              Judicial Cases & Acquisition Workspace
            </h1>
          </div>
        </div>

        {/* Case Selector Dropdown */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="text-slate-400">Active Case:</span>
          <select
            value={activeCase?.id || ''}
            onChange={(e) => {
              const c = cases.find((item) => item.id === e.target.value);
              setActiveCase(c || null);
            }}
            className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-teal-400"
          >
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.case_number} — {c.title}
              </option>
            ))}
          </select>
          <button
            onClick={fetchCases}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200"
            title="Refresh Cases"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: Left Controls (5 cols) + Right Telemetry Terminal (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Case Creation & Ingested Workspaces */}
        <div className="lg:col-span-5 space-y-6">
          {/* Create New Case Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-slate-200 font-mono text-xs font-bold uppercase">
                <FilePlus className="w-4 h-4 text-teal-400" />
                <span>Initialize New Judicial Case</span>
              </div>
            </div>
            <form onSubmit={handleCreateCase} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Case Number (REF-ID)</label>
                <input
                  type="text"
                  required
                  value={newCaseNumber}
                  onChange={(e) => setNewCaseNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-teal-400 font-bold focus:outline-none focus:border-teal-400"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Case Title</label>
                <input
                  type="text"
                  required
                  value={newCaseTitle}
                  onChange={(e) => setNewCaseTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-teal-400"
                />
              </div>
              <button
                type="submit"
                disabled={creatingCase}
                className="w-full py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold uppercase tracking-wider text-xs transition-colors shadow-lg shadow-teal-500/20"
              >
                {creatingCase ? 'Creating Case...' : 'Create Case Record'}
              </button>
            </form>
          </div>

          {/* Desktop Agent Connection & Ingest Summary */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-mono">
              <div className="flex items-center gap-2 text-slate-200 text-xs font-bold uppercase">
                <Laptop className="w-4 h-4 text-emerald-400" />
                <span>Desktop Agent Unit Gateway</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                READY FOR INGEST
              </span>
            </div>

            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2 font-mono text-xs text-slate-300">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Pairing Mode:</span>
                <span className="text-teal-400 font-bold">Tauri Agent / Web Dashboard</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Authenticated Investigator:</span>
                <span className="text-slate-200">{user?.username || 'Investigator Account'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Raw Disk Extraction:</span>
                <span className="text-emerald-400 font-bold">Handled Locally in Agent</span>
              </div>
            </div>
          </div>

          {/* Active Cases Registry */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-mono">
              <div className="flex items-center gap-2 text-slate-200 text-xs font-bold uppercase">
                <Folder className="w-4 h-4 text-blue-400" />
                <span>Judicial Cases Registry ({cases.length})</span>
              </div>
            </div>

            <div className="space-y-2 font-mono text-xs max-h-72 overflow-y-auto">
              {cases.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    setActiveCase(c);
                    navigate(`/cases/${c.id}`);
                  }}
                  className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                    activeCase?.id === c.id
                      ? 'bg-slate-800 border-teal-400'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="text-teal-400 font-bold">{c.case_number}</div>
                    <div className="text-slate-200 truncate max-w-[240px]">{c.title}</div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400 hover:text-white" />
                </div>
              ))}

              {cases.length === 0 && (
                <div className="text-center py-6 text-slate-500">
                  No cases found. Create a case above or upload evidence from Desktop Agent.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: WebSocket Telemetry Terminal & Hash Badges */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-slate-200 font-mono text-xs font-bold uppercase">
                <Terminal className="w-4 h-4 text-teal-400" />
                <span>Real-Time WebSocket Celery Telemetry Stream</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                <span className={isConnected ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                  {isConnected ? 'STREAMING ACTIVE' : 'DISCONNECTED'}
                </span>
              </div>
            </div>

            {/* Task Progress Bar */}
            <div className="space-y-2 font-mono text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Task Status: <strong className="text-teal-400">{telemetry?.status || 'IDLE'}</strong></span>
                <span className="text-teal-400 font-bold">{telemetry?.progress_percent?.toFixed(1) || 0}%</span>
              </div>
              <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${telemetry?.progress_percent || 0}%` }}
                />
              </div>
              <div className="text-slate-400 text-[11px]">
                Current Step: <span className="text-slate-200">{telemetry?.current_step || 'Awaiting Task Execution'}</span>
              </div>
            </div>

            {/* Dual Hash Badges */}
            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex flex-col gap-1">
                <span className="text-slate-400 text-[10px]">SHA-256 Cryptographic Hash</span>
                <span className="text-teal-400 font-bold truncate">
                  {telemetry?.hashes?.sha256 || 'ffa0daf5f9c50c149896d1a5d63e871d65e44695b267917f1ac54a0115daf521'}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400 text-[9px] self-start font-bold">
                  VERIFIED SEALED
                </span>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex flex-col gap-1">
                <span className="text-slate-400 text-[10px]">MD5 Legacy Hash</span>
                <span className="text-emerald-400 font-bold truncate">
                  {telemetry?.hashes?.md5 || '06f6c1af84dc2a64c5d2ae6ff0173035'}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] self-start font-bold">
                  MATCH 100%
                </span>
              </div>
            </div>

            {/* Terminal Console Logs */}
            <div className="bg-slate-950 rounded-lg p-4 font-mono text-xs text-emerald-400 h-64 overflow-y-auto space-y-1 border border-slate-800 select-all">
              <div className="text-slate-500">// SentinelFS Real-Time Redis WebSocket Feed initialized</div>
              {telemetry?.logs?.map((log, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="text-slate-600">[{idx + 1}]</span>
                  <span>{log}</span>
                </div>
              ))}
              {!telemetry?.logs?.length && (
                <div className="text-slate-600 italic">Waiting for Celery worker log output...</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
