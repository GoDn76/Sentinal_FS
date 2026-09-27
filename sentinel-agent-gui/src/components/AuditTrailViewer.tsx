import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import type { AuditLogEntry } from '../types';

interface AuditTrailViewerProps {
  logs: AuditLogEntry[];
  isVerified: boolean;
}

export const AuditTrailViewer: React.FC<AuditTrailViewerProps> = ({ logs, isVerified }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-[#1a1d27] border border-[#2d3148] rounded-sm overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-[#202433] transition-colors"
      >
        <div className="flex items-center space-x-3">
          <Lock className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-slate-200">
            Cryptographic Audit Ledger (BSA Section 63)
          </span>
          <span className="text-xs text-slate-400">({logs.length} blocks recorded)</span>
        </div>

        <div className="flex items-center space-x-3">
          {isVerified ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
              CHAIN INTACT
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 tracking-wider">
              <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
              CHAIN BROKEN
            </span>
          )}

          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-5 border-t border-[#2d3148] bg-[#0f1117] max-h-80 overflow-y-auto space-y-3 font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-slate-500 italic text-center py-4">No audit ledger entries available</p>
          ) : (
            logs.map((entry) => (
              <div
                key={entry.seq}
                className="flex items-start justify-between p-2.5 bg-[#1a1d27] border border-[#2d3148] rounded-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="bg-blue-600/30 text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-bold">
                      #{entry.seq}
                    </span>
                    <span className="font-semibold text-slate-200 uppercase tracking-wide">
                      {entry.action}
                    </span>
                    <span className="text-[10px] text-slate-500">{entry.timestamp}</span>
                  </div>
                  <p className="text-slate-400 font-sans text-xs">{entry.details}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">HASH:</span>
                  <span className="text-blue-400 text-[10px]" title={entry.current_block_hash}>
                    {entry.current_block_hash.slice(0, 16)}...
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
