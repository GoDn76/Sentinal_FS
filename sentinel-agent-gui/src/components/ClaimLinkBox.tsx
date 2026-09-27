import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, ExternalLink } from 'lucide-react';

interface ClaimLinkBoxProps {
  claimUrl: string;
  claimToken: string;
}

export const ClaimLinkBox: React.FC<ClaimLinkBoxProps> = ({ claimUrl, claimToken }) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const copyUrl = () => {
    navigator.clipboard.writeText(claimUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const copyToken = () => {
    navigator.clipboard.writeText(claimToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <div className="bg-[#1a1d27] border border-[#2d3148] p-6 rounded-sm space-y-6 flex flex-col items-center">
      <div className="bg-[#0f1117] p-4 rounded-sm border border-[#2d3148] shadow-inner">
        <QRCodeSVG
          value={claimUrl}
          size={160}
          bgColor="#0f1117"
          fgColor="#ffffff"
          level="H"
          includeMargin={false}
        />
      </div>

      <div className="w-full space-y-3">
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Claim URL:
          </label>
          <div className="flex items-center space-x-2 bg-[#0f1117] border border-[#2d3148] px-3 py-2 rounded-sm">
            <span className="font-mono text-xs text-blue-400 truncate flex-1" title={claimUrl}>
              {claimUrl}
            </span>
            <button
              onClick={copyUrl}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-[#2d3148]"
              title="Copy URL"
            >
              {copiedUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <a
              href={claimUrl}
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-blue-400 transition-colors p-1 rounded hover:bg-[#2d3148]"
              title="Open link"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Token String:
          </label>
          <div className="flex items-center space-x-2 bg-[#0f1117] border border-[#2d3148] px-3 py-1.5 rounded-sm">
            <span className="font-mono text-xs text-slate-300 truncate flex-1" title={claimToken}>
              {claimToken}
            </span>
            <button
              onClick={copyToken}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-[#2d3148]"
              title="Copy Token"
            >
              {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400 text-center leading-relaxed border-t border-[#2d3148] pt-4">
        Scan this QR code or open the URL in any browser to link your SentinelFS web platform account to this investigation session.
      </p>
    </div>
  );
};
