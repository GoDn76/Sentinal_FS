import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, KeyRound, ArrowRight, Laptop, RefreshCw } from 'lucide-react';
import { open } from '@tauri-apps/plugin-shell';
import { hostname } from '@tauri-apps/plugin-os';
import { useCaseStore } from '../store/caseStore';
import { ClaimLinkBox } from '../components/ClaimLinkBox';

// 1. Explicit Service Base URLs:
const WEB_DASHBOARD_URL = import.meta.env.VITE_WEB_DASHBOARD_URL || 'http://localhost:3000';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const DeviceLinkPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    claimToken,
    setClaimToken,
    setPersistentAuth,
    setPlatformUrl,
    persistentAuth,
  } = useCaseStore();

  const [pcName, setPcName] = useState<string>('Forensic Workstation');
  const [claimUrl, setClaimUrl] = useState<string>('');
  const [claimStatus, setClaimStatus] = useState<'generating' | 'pending' | 'claimed' | 'unreachable' | 'expired'>('generating');
  const [claimedBy, setClaimedBy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customApiUrl, setCustomApiUrl] = useState<string>(API_BASE_URL);
  const [customDashboardUrl, setCustomDashboardUrl] = useState<string>(WEB_DASHBOARD_URL);
  const [showSettings, setShowSettings] = useState(false);

  // Fetch PC Hostname using @tauri-apps/plugin-os
  useEffect(() => {
    const fetchHostInfo = async () => {
      try {
        if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
          const name = await hostname();
          if (name) {
            setPcName(name);
            return;
          }
        }
      } catch (e) {
        console.warn('Could not fetch OS hostname:', e);
      }
      setPcName(window.location.hostname || 'Localhost PC');
    };
    fetchHostInfo();
  }, []);

  // 2. Single Token Initialization & Backend Registration:
  const initPairingToken = useCallback(async (forceRefresh = false) => {
    setClaimStatus('generating');
    setError(null);

    try {
      const activeApiUrl = customApiUrl.trim() || API_BASE_URL;
      const activeDashUrl = customDashboardUrl.trim() || WEB_DASHBOARD_URL;
      setPlatformUrl(activeApiUrl);

      let tokenToUse = claimToken;

      if (!tokenToUse || forceRefresh) {
        tokenToUse = crypto.randomUUID();
        setClaimToken(tokenToUse);
      }

      // Register token with FastAPI backend (Redis storage with 900s TTL)
      await fetch(`${activeApiUrl.replace(/\/$/, '')}/api/v1/claim/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenToUse,
          device_info: pcName,
        }),
      });

      const formattedClaimUrl = `${activeDashUrl.replace(/\/$/, '')}/claim/${tokenToUse}`;
      setClaimUrl(formattedClaimUrl);
      setClaimStatus('pending');
    } catch (err) {
      setClaimStatus('unreachable');
      setError('Could not connect to SentinelFS Platform API server.');
    }
  }, [claimToken, customApiUrl, customDashboardUrl, pcName, setClaimToken, setPlatformUrl]);

  useEffect(() => {
    if (!persistentAuth) {
      initPairingToken(false);
    }
  }, []); // Run strictly once on mount

  // 3. Backend Redis Polling Loop:
  useEffect(() => {
    if (!claimToken || claimStatus === 'claimed' || persistentAuth) return;

    let isSubscribed = true;
    let timerId: NodeJS.Timeout;

    const pollStatus = async () => {
      try {
        const activeApiUrl = customApiUrl.trim() || API_BASE_URL;
        const response = await fetch(`${activeApiUrl.replace(/\/$/, '')}/api/v1/claim/${claimToken}/status`);
        
        if (!isSubscribed) return;

        if (response.ok) {
          const res = await response.json();
          if (res.status === 'claimed' && res.platform_jwt) {
            setClaimStatus('claimed');
            setClaimedBy(res.claimed_by);
            setPersistentAuth({
              jwt: res.platform_jwt,
              username: res.claimed_by || 'Investigator Account',
              linkedAt: new Date().toISOString(),
            });
            return;
          } else if (res.status === 'expired') {
            setClaimStatus('expired');
          } else if (res.status === 'pending') {
            setClaimStatus('pending');
          } else {
            setClaimStatus('unreachable');
          }
        } else if (response.status === 404) {
          setClaimStatus('expired');
        } else {
          setClaimStatus('unreachable');
        }
      } catch {
        if (isSubscribed) setClaimStatus('unreachable');
      }

      if (isSubscribed) {
        timerId = setTimeout(pollStatus, 3000);
      }
    };

    pollStatus();

    return () => {
      isSubscribed = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [claimToken, customApiUrl, persistentAuth, setPersistentAuth]);

  // 4. Breakout Navigation to Native OS Browser:
  const handleOpenLink = async () => {
    if (!claimUrl) return;
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      await open(claimUrl);
    } else {
      window.open(claimUrl, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col justify-center items-center p-6 font-sans">
      <div className="max-w-2xl w-full bg-[#1a1d27] border border-[#2d3148] p-8 rounded-sm shadow-2xl space-y-8">
        {/* Header */}
        <div className="flex items-center space-x-4 border-b border-[#2d3148] pb-6">
          <div className="p-3 bg-blue-600/20 border border-blue-500/30 rounded-sm text-blue-400">
            <Laptop className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-100 tracking-tight">
                SentinelFS Device Authentication
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Setup Step 1
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Pair this desktop investigation unit with your SentinelFS Website Account.
            </p>
          </div>
        </div>

        {/* If already linked */}
        {persistentAuth || claimStatus === 'claimed' ? (
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-emerald-400">Device Linked to Website Account!</h2>
              <p className="text-xs text-slate-300">
                Authenticated as: <span className="font-semibold text-white">{claimedBy || persistentAuth?.username || 'Investigator'}</span>
              </p>
              <p className="text-xs text-slate-400">
                This device can now run forensic disk carving and ingest evidence packages into your account.
              </p>
            </div>

            <div className="pt-4 border-t border-[#2d3148]">
              <button
                onClick={() => navigate('/case-setup')}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-3 px-6 rounded-sm flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/20 transition-all"
              >
                <span>Continue to Case Selection</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Display Host PC Name & Manual Refresh Control */}
            <div className="flex items-center justify-between bg-[#0f1117] border border-[#2d3148] px-4 py-3 rounded-sm">
              <div className="flex items-center space-x-2 text-xs">
                <Laptop className="w-4 h-4 text-teal-400" />
                <span className="text-slate-400">Station Host:</span>
                <span className="font-mono font-bold text-white bg-slate-800/60 px-2.5 py-0.5 rounded border border-slate-700">{pcName}</span>
              </div>
              <button
                onClick={() => initPairingToken(true)}
                className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 rounded-sm text-xs font-semibold text-blue-300 flex items-center space-x-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Generate New Pairing Code</span>
              </button>
            </div>

            {/* Warning banner */}
            <div className="bg-amber-950/40 border border-amber-500/40 p-4 rounded-sm flex items-start space-x-3 text-xs text-amber-200">
              <KeyRound className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Device Pair Required:</strong> Scan the QR code or click the Claim URL to open your system&apos;s native web browser (Chrome/Edge) at <span className="font-mono text-teal-300">{WEB_DASHBOARD_URL}</span> and authorize this device.
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-sm text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* QR Code & Claim Link */}
            {claimUrl ? (
              <ClaimLinkBox
                claimUrl={claimUrl}
                claimToken={claimToken}
                onOpenExternalUrl={handleOpenLink}
              />
            ) : (
              <div className="bg-[#0f1117] p-8 border border-[#2d3148] rounded-sm text-center text-xs text-slate-400 animate-pulse">
                Generating unique device pairing token...
              </div>
            )}

            {/* Connection Live Status */}
            <div className="bg-[#0f1117] border border-[#2d3148] p-4 rounded-sm flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Pairing Status:
              </span>

              {claimStatus === 'pending' && (
                <div className="flex items-center space-x-2 text-amber-400 text-xs font-semibold">
                  <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />
                  <span>Waiting for authorization on Web Dashboard...</span>
                </div>
              )}

              {claimStatus === 'unreachable' && (
                <div className="flex items-center space-x-2 text-amber-400 text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Server unreachable — Retrying...</span>
                  <button
                    onClick={() => initPairingToken(true)}
                    className="ml-2 text-blue-400 hover:underline text-xs flex items-center space-x-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Retry</span>
                  </button>
                </div>
              )}

              {claimStatus === 'expired' && (
                <div className="flex items-center space-x-2 text-red-400 text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Token expired in Redis</span>
                  <button
                    onClick={() => initPairingToken(true)}
                    className="ml-2 text-blue-400 hover:underline text-xs"
                  >
                    Generate New Token
                  </button>
                </div>
              )}
            </div>

            {/* Server options */}
            <div>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="text-xs text-slate-400 hover:text-blue-400 flex items-center space-x-1 transition-colors"
              >
                <span>Change SentinelFS Service & Platform URLs</span>
              </button>

              {showSettings && (
                <div className="mt-3 p-4 bg-[#0f1117] border border-[#2d3148] rounded-sm space-y-3 font-mono text-xs">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Web Dashboard URL (QR Target)
                    </label>
                    <input
                      type="text"
                      value={customDashboardUrl}
                      onChange={(e) => setCustomDashboardUrl(e.target.value)}
                      className="w-full bg-[#1a1d27] border border-[#2d3148] focus:border-blue-500 text-slate-100 px-3 py-2 rounded-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      FastAPI Backend API URL
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={customApiUrl}
                        onChange={(e) => setCustomApiUrl(e.target.value)}
                        className="flex-1 bg-[#1a1d27] border border-[#2d3148] focus:border-blue-500 text-slate-100 px-3 py-2 rounded-sm outline-none"
                      />
                      <button
                        onClick={() => initPairingToken(true)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-sm font-sans font-semibold"
                      >
                        Update
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


