import React from 'react';
import { Shield, Lock, User as UserIcon, LogOut, Cpu } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useCaseStore } from '../store/useCaseStore';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { activeCase } = useCaseStore();

  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-slate-900/90 backdrop-blur-md z-40 border-b border-slate-800 px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-teal-400" />
          <span className="font-mono text-sm font-bold text-slate-100 uppercase tracking-tight">
            SentinelFS Platform v2.0
          </span>
          <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-400 font-mono text-[10px] uppercase font-bold">
            REST + WS Architecture
          </span>
        </div>
      </div>

      {activeCase && (
        <div className="hidden xl:flex items-center gap-3 px-4 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
          <span className="text-xs font-mono font-bold text-slate-200">
            CASE: {activeCase.case_number}
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono text-emerald-400 uppercase font-semibold">
            {activeCase.status}
          </span>
          <span className="text-xs text-slate-400 font-mono truncate max-w-xs">
            {activeCase.title}
          </span>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-md bg-slate-950 text-emerald-400 text-xs font-mono border border-emerald-500/20">
          <Lock className="w-3.5 h-3.5" />
          <span>WRITE-BLOCKER ACTIVE (READ-ONLY)</span>
        </div>

        {user && (
          <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
            <div className="flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-200">
                {user.username} <span className="text-slate-500 font-mono">{user.badge_number}</span>
              </span>
              <span className="text-[10px] text-slate-400">{user.agency_name}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-teal-500 text-slate-950 flex items-center justify-center font-bold text-xs">
              <UserIcon className="w-4 h-4" />
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
