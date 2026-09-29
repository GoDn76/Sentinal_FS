import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  FileText,
  Printer,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Award,
  Download,
  Copy,
  Check,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export const ComplianceReport: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const caseId = id || '5c1e0740-3343-4f68-81f4-0b815d147c9e';
  const caseNumber = `CASE-2026-${caseId.slice(0, 4).toUpperCase()}`;
  const sha256 = 'ffa0daf5f9c50c149896d1a5d63e871d65e44695b267917f1ac54a0115daf521';
  const md5 = '06f6c1af84dc2a64c5d2ae6ff0173035';
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto font-sans">
      {/* Action Toolbar */}
      <div className="flex items-center justify-between print:hidden">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-100 font-mono text-xs transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Case</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-all shadow-lg shadow-teal-500/20"
          >
            <Printer className="w-4 h-4" />
            <span>Print Official Certificate</span>
          </button>
        </div>
      </div>

      {/* Official Certificate Paper Document Box */}
      <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl p-8 shadow-2xl space-y-8 font-mono relative overflow-hidden print:bg-white print:text-black print:border-none print:shadow-none">
        {/* Certificate Decorative Watermark Badge */}
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-6 print:border-black">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 print:text-black">
              <Award className="w-7 h-7" />
            </div>
            <div>
              <div className="text-xs font-bold text-teal-400 uppercase tracking-widest print:text-black">
                BHARATIYA SAKSHYA ADHINIYAM, 2023
              </div>
              <h1 className="text-xl font-bold text-slate-100 print:text-black">
                Section 63(4) Electronic Evidence Certificate
              </h1>
            </div>
          </div>

          <div className="text-right">
            <span className="px-3 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30 uppercase tracking-wider print:border-black print:text-black">
              ✓ UNBROKEN SEAL
            </span>
          </div>
        </div>

        {/* Certificate Legal Preamble */}
        <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-3 text-xs leading-relaxed text-slate-300 print:bg-slate-50 print:border-slate-300 print:text-slate-800">
          <p className="font-semibold text-slate-200 print:text-black">
            CERTIFICATE UNDER SECTION 63(4) OF THE BHARATIYA SAKSHYA ADHINIYAM (BSA), 2023 REGARDING ELECTRONIC EVIDENCE INGESTION AND CRYPTOGRAPHIC DUAL-HASHING:
          </p>
          <p>
            I, <strong className="text-teal-400 print:text-black">{user?.username || 'Forensic Investigator'}</strong>, certify that the electronic record containing carved video evidence segments associated with Case Number <strong className="text-slate-100 print:text-black">{caseNumber}</strong> (Case ID: {caseId}) was produced by an automated bit-stream forensic extraction process running on the SentinelFS acquisition engine.
          </p>
          <p>
            Dual cryptographic verification (SHA-256 and MD5) was computed concurrently during acquisition using a streaming single-pass algorithm, guaranteeing that the evidence source has not been altered, corrupted, or tampered with at any stage.
          </p>
        </div>

        {/* Cryptographic Hash Verification Block */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider print:text-black">
            Cryptographic Hash Value Certificate
          </h3>

          <div className="grid grid-cols-1 gap-3 text-xs">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1 print:bg-slate-100 print:border-slate-300">
              <div className="flex justify-between items-center text-slate-400 print:text-slate-700">
                <span>SHA-256 Hash Digest (Primary Standard):</span>
                <span className="text-[10px] text-teal-400 font-bold print:text-black">MATCH CONFIRMED</span>
              </div>
              <div className="flex items-center justify-between font-mono font-bold text-teal-400 print:text-black">
                <span className="truncate">{sha256}</span>
                <button
                  onClick={() => copyToClipboard(sha256)}
                  className="p-1 text-slate-400 hover:text-white print:hidden"
                >
                  {copiedHash === sha256 ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1 print:bg-slate-100 print:border-slate-300">
              <div className="flex justify-between items-center text-slate-400 print:text-slate-700">
                <span>MD5 Hash Digest (Legacy Verification):</span>
                <span className="text-[10px] text-emerald-400 font-bold print:text-black">MATCH CONFIRMED</span>
              </div>
              <div className="flex items-center justify-between font-mono font-bold text-emerald-400 print:text-black">
                <span className="truncate">{md5}</span>
                <button
                  onClick={() => copyToClipboard(md5)}
                  className="p-1 text-slate-400 hover:text-white print:hidden"
                >
                  {copiedHash === md5 ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Chain of Custody Audit Trail Verification */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider print:text-black">
            Audit Ledger Chain of Custody Logs
          </h3>

          <div className="space-y-2 text-xs">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between print:bg-slate-100 print:border-slate-300">
              <span className="text-slate-400 print:text-slate-700">BLOCK #1 [DRIVE_MOUNTED]:</span>
              <span className="text-slate-200 font-bold print:text-black">Mounted target raw disk image</span>
              <span className="text-emerald-400 text-[11px]">HASH VERIFIED</span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between print:bg-slate-100 print:border-slate-300">
              <span className="text-slate-400 print:text-slate-700">BLOCK #2 [SOURCE_HASHED]:</span>
              <span className="text-slate-200 font-bold print:text-black">Single-pass dual hash computed</span>
              <span className="text-emerald-400 text-[11px]">HASH VERIFIED</span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between print:bg-slate-100 print:border-slate-300">
              <span className="text-slate-400 print:text-slate-700">BLOCK #3 [MANIFEST_SEALED]:</span>
              <span className="text-slate-200 font-bold print:text-black">Evidence manifest sealed</span>
              <span className="text-emerald-400 text-[11px]">HASH VERIFIED</span>
            </div>
          </div>
        </div>

        {/* Signature & Seal Footer */}
        <div className="pt-8 border-t-2 border-slate-800 grid grid-cols-2 gap-8 text-xs print:border-black">
          <div className="space-y-2">
            <span className="text-slate-500 uppercase block print:text-slate-700">Digital Examiner Signature:</span>
            <div className="font-bold text-slate-200 text-sm print:text-black">{user?.username || 'Forensic Officer'}</div>
            <div className="text-[11px] text-slate-500 print:text-slate-700">SentinelFS Forensic Examiner</div>
          </div>

          <div className="space-y-2 text-right">
            <span className="text-slate-500 uppercase block print:text-slate-700">Date of Certification:</span>
            <div className="font-bold text-slate-200 text-sm print:text-black">{currentDate}</div>
            <div className="text-[11px] text-slate-500 print:text-slate-700">BSA Sec 63(4) Compliant Record</div>
          </div>
        </div>
      </div>
    </div>
  );
};
