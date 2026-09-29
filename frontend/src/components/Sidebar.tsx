import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, HardDrive, Activity, FileText, Cpu, ShieldAlert, BrainCircuit } from 'lucide-react';

export const Sidebar: React.FC = () => {
  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-slate-900 border-r border-slate-800 z-50 flex flex-col justify-between">
      <div className="flex flex-col">
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-teal-400" />
            <span className="font-mono text-sm font-bold uppercase tracking-wider text-slate-100">
              SentinelFS
            </span>
          </div>
          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-teal-400 font-mono text-[10px]">
            v2.0
          </span>
        </div>

        <div className="px-6 pt-5 pb-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
            Forensic Command & Control
          </span>
        </div>

        <nav className="px-3 space-y-1 flex flex-col text-xs font-medium">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? 'bg-slate-800 text-teal-400 font-bold'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`
            }
          >
            <LayoutDashboard className="w-4 h-4 mr-3" />
            Extraction Command
          </NavLink>

          <NavLink
            to="/evidence"
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? 'bg-slate-800 text-teal-400 font-bold'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`
            }
          >
            <HardDrive className="w-4 h-4 mr-3" />
            Evidence Vault & Hashes
          </NavLink>

          <NavLink
            to="/analysis"
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? 'bg-slate-800 text-purple-400 font-bold'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`
            }
          >
            <BrainCircuit className="w-4 h-4 mr-3 text-purple-400" />
            AI Intelligence & Analysis
          </NavLink>

          <NavLink
            to="/timeline"
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? 'bg-slate-800 text-teal-400 font-bold'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`
            }
          >
            <Activity className="w-4 h-4 mr-3" />
            Multi-Track Timeline
          </NavLink>

          <NavLink
            to="/compliance"
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? 'bg-slate-800 text-teal-400 font-bold'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`
            }
          >
            <FileText className="w-4 h-4 mr-3 text-teal-400" />
            BSA Sec 63 Certificates
          </NavLink>
        </nav>
      </div>

      <div className="p-4 border-t border-slate-800">
        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col gap-1 text-[11px] font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 font-bold">NODE: LAB-STATION-01</span>
          </div>
          <span className="text-slate-500">BSA Sec 63(4) Compliant Engine</span>
        </div>
      </div>
    </aside>
  );
};
