import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowRight, Settings, AlertCircle, CheckCircle2, LogOut, KeyRound } from 'lucide-react';
import { api } from '../api/client';
import { useCaseStore } from '../store/caseStore';
import { StepBar } from '../components/StepBar';

export const Welcome: React.FC = () => {
  const navigate = useNavigate();
  const { setSession, setPlatformUrl, platformUrl, persistentAuth, logoutPersistentAuth } = useCaseStore();

  const [operatorName, setOperatorName] = useState(persistentAuth?.username || '');
  const [caseReference, setCaseReference] = useState('');
  const [customPlatformUrl, setCustomPlatformUrl] = useState(platformUrl || 'http://localhost:8000');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleStartSession = async () => {
    if (!operatorName.trim() || !caseReference.trim()) {
      setError('Please provide both Operator Name and Case Reference before proceeding.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      setPlatformUrl(customPlatformUrl.trim());
      const res = await api.generateClaimToken(operatorName.trim(), caseReference.trim());

      const sessionJwt = persistentAuth?.jwt || null;

      setSession({
        operator_name: operatorName.trim(),
        case_reference: caseReference.trim(),
        case_id: res.case_id,
        claim_token: res.claim_token,
        claim_url: res.claim_url,
        platform_jwt: sessionJwt,
        output_dir: '',
        flow: 'carving',
        step: sessionJwt ? 3 : 1,
      });

      // If already authenticated persistently (like Playit device link), skip QR claim!
      if (sessionJwt) {
        navigate('/drive');
      } else {
        navigate('/claim');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col">
      <StepBar currentStep={1} flow="carving" />

      <main className="flex-1 max-w-4xl w-full mx-auto p-8 flex flex-col justify-center">
        <div className="bg-[#1a1d27] border border-[#2d3148] p-8 rounded-sm shadow-xl space-y-8">
          <div className="flex items-center space-x-4 border-b border-[#2d3148] pb-6">
            <div className="p-3 bg-blue-600/20 border border-blue-500/30 rounded-sm text-blue-400">
              <Shield className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
                SentinelFS Agent GUI
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Forensic DVR Video Carver & BSA Section 63 Evidence Acquisition Toolkit
              </p>
            </div>
          </div>

          {/* Persistent Authentication Banner */}
          {persistentAuth ? (
            <div className="bg-emerald-950/40 border border-emerald-500/40 p-4 rounded-sm flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div>
                  <div className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                    Persistent Platform Connection Active
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    Authenticated as <span className="font-semibold text-white">{persistentAuth.username}</span> — New cases will auto-link to this account without re-authenticating.
                  </div>
                </div>
              </div>
              <button
                onClick={logoutPersistentAuth}
                className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-red-400 bg-[#0f1117] border border-[#2d3148] px-3 py-1.5 rounded-sm transition-colors"
                title="Disconnect Account / Switch Investigator"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            </div>
          ) : (
            <div className="bg-amber-950/30 border border-amber-500/30 p-4 rounded-sm flex items-center space-x-3">
              <KeyRound className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <div className="text-xs text-amber-200">
                <strong>Device Not Linked:</strong> You will be guided through a one-time platform claim link (QR / Web browser) on Step 2. Once linked, authentication will persist for future sessions.
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-sm flex items-center space-x-3 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Investigator / Operator Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Det. Smith #402"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                className="w-full bg-[#0f1117] border border-[#2d3148] focus:border-blue-500 text-slate-100 px-4 py-2.5 rounded-sm outline-none text-sm transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Case Reference / FIR Number <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. FIR-2026-001"
                value={caseReference}
                onChange={(e) => setCaseReference(e.target.value)}
                className="w-full bg-[#0f1117] border border-[#2d3148] focus:border-blue-500 text-slate-100 px-4 py-2.5 rounded-sm outline-none text-sm transition-colors"
              />
            </div>
          </div>

          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-slate-400 hover:text-blue-400 flex items-center space-x-1 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Advanced Platform Settings</span>
            </button>

            {showAdvanced && (
              <div className="mt-3 p-4 bg-[#0f1117] border border-[#2d3148] rounded-sm space-y-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                  SentinelFS Platform URL
                </label>
                <input
                  type="text"
                  value={customPlatformUrl}
                  onChange={(e) => setCustomPlatformUrl(e.target.value)}
                  className="w-full bg-[#1a1d27] border border-[#2d3148] focus:border-blue-500 text-slate-100 px-3 py-2 rounded-sm outline-none text-xs font-mono"
                />
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#2d3148] flex justify-end">
            <button
              disabled={loading}
              onClick={handleStartSession}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs px-6 py-3 rounded-sm flex items-center space-x-2 shadow-lg shadow-blue-600/20 transition-all"
            >
              <span>
                {persistentAuth ? 'Initialize Case & Proceed to Acquisition' : 'Initialize Case & Generate Claim Token'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
