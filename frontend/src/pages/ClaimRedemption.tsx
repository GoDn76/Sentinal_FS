import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, ShieldAlert, Laptop, Loader2, ArrowRight, ShieldCheck, HardDrive } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

interface ClaimDetails {
  status: string;
  claimed_by?: string;
  device_info?: string;
}

export const ClaimRedemption: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const tokenAuth = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  const [details, setDetails] = useState<ClaimDetails | null>(null);
  const [fetching, setFetching] = useState<boolean>(true);
  const [redeeming, setRedeeming] = useState<boolean>(false);
  const [status, setStatus] = useState<'pending' | 'success' | 'error' | 'already_claimed'>('pending');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch pending claim details on mount
  useEffect(() => {
    if (!isAuthenticated || !tokenAuth) {
      const redirectPath = encodeURIComponent(`/claim/${token}`);
      navigate(`/login?redirect=${redirectPath}`, { replace: true });
      return;
    }

    if (!token) {
      setStatus('error');
      setErrorMsg('Invalid claim pairing token string');
      setFetching(false);
      return;
    }

    let isMounted = true;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/v1/claim/${token}/status`, {
          headers: { Authorization: `Bearer ${tokenAuth}` },
        });

        if (!res.ok) {
          throw new Error(`Could not fetch pairing token status (${res.status})`);
        }

        const data: ClaimDetails = await res.json();
        if (isMounted) {
          setDetails(data);
          if (data.status === 'claimed') {
            setStatus('already_claimed');
          } else if (data.status === 'expired') {
            setStatus('error');
            setErrorMsg('Pairing claim token has expired. Generate a new token in the Desktop Agent.');
          } else if (data.status === 'not_found') {
            setStatus('error');
            setErrorMsg('Pairing token not found on backend platform server.');
          } else {
            setStatus('pending');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setStatus('error');
          setErrorMsg(err.message || 'Failed to fetch claim request details.');
        }
      } finally {
        if (isMounted) setFetching(false);
      }
    };

    fetchStatus();

    return () => {
      isMounted = false;
    };
  }, [token, isAuthenticated, tokenAuth, navigate]);

  // Handle "Grant Access to this Device" action click
  const handleGrantAccess = async () => {
    if (!token || !tokenAuth) return;
    setRedeeming(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`http://localhost:8000/api/v1/claim/${token}/quick-redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAuth}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail?.detail || errData.detail || `Granting access failed with status ${res.status}`);
      }

      setErrorMsg(null);
      setStatus('success');
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message || 'Failed to grant device access.');
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-6 text-slate-100 font-sans relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10 space-y-6 text-center font-mono">
        <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center mx-auto text-teal-400 shadow-inner">
          <Laptop className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-bold uppercase tracking-tight text-slate-100">
            Device Pairing Request
          </h1>
          <p className="text-xs text-slate-400">
            A local agent unit is requesting to connect to your SentinelFS workspace.
          </p>
        </div>

        {fetching ? (
          <div className="py-8 space-y-4">
            <Loader2 className="w-12 h-12 text-teal-400 animate-spin mx-auto" />
            <p className="text-xs text-teal-300 font-semibold">Fetching Device Request Details...</p>
          </div>
        ) : status === 'pending' ? (
          <div className="space-y-6 text-left bg-slate-950 border border-slate-800 p-5 rounded-xl">
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-800">
                <span className="text-slate-500 uppercase">Target Workspace:</span>
                <span className="text-teal-400 font-bold">{user?.username || 'Investigator Account'}</span>
              </div>
              <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-800">
                <span className="text-slate-500 uppercase">Device Host:</span>
                <span className="text-slate-200">{details?.device_info || 'Desktop Agent'}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 uppercase">Claim Token:</span>
                <span className="text-slate-400 font-mono text-[11px] truncate max-w-[200px]" title={token}>
                  {token}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                disabled={redeeming}
                onClick={handleGrantAccess}
                className="w-full py-3.5 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-bold uppercase tracking-wider text-xs flex items-center justify-center space-x-2 shadow-lg shadow-teal-500/20 transition-all"
              >
                {redeeming ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Granting Access...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Grant Access to this Device</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : status === 'success' || status === 'already_claimed' ? (
          <div className="py-6 space-y-6">
            <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto text-emerald-400 animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-emerald-400">✅ Device Successfully Paired</h2>
              <p className="text-xs text-slate-300 font-medium">
                You may now return to the SentinelFS Desktop Agent.
              </p>
              <p className="text-[11px] text-slate-400">
                The desktop unit has received authorization and will automatically unlock.
              </p>
            </div>

            <button
              onClick={() => navigate('/dashboard', { replace: true })}
              className="w-full py-3.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs uppercase flex items-center justify-center space-x-2 shadow-lg shadow-teal-500/20 transition-all"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="py-6 space-y-6">
            <div className="w-16 h-16 bg-red-500/20 border border-red-500/40 rounded-full flex items-center justify-center mx-auto text-red-400">
              <ShieldAlert className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-red-400">Pairing Request Failed</h2>
              <p className="text-xs text-red-300/90">{errorMsg}</p>
            </div>

            <button
              onClick={() => navigate('/dashboard', { replace: true })}
              className="w-full py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
