import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface HashBadgeProps {
  label: string;
  hash: string;
}

export const HashBadge: React.FC<HashBadgeProps> = ({ label, hash }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center space-x-2 bg-[#0f1117] border border-[#2d3148] px-2.5 py-1 rounded-sm text-xs">
      <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
        {label}:
      </span>
      <span className="font-mono text-blue-400 font-medium tracking-tight truncate max-w-[200px]" title={hash}>
        {hash}
      </span>
      <button
        onClick={copyToClipboard}
        className="text-slate-400 hover:text-white transition-colors p-0.5 rounded"
        title="Copy hash to clipboard"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
};
