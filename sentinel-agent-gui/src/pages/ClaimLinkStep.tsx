import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Clock, Search, FolderPlus, ArrowLeft } from 'lucide-react';
import { api } from '../api/client';
import { useCaseStore } from '../store/caseStore';
import { StepBar } from '../components/StepBar';
import { ClaimLinkBox } from '../components/ClaimLinkBox';

export const ClaimLinkStep: React.FC = () => {
  const navigate = useNavigate();
  const { session, platformUrl, updateJWT, setSession, setPersistentAuth } = useCaseStore();

  const [claimStatus, setClaimStatus] = useState<'pending' | 'claimed' | 'unreachable' | 'expired'>(
    'pending'
  );
  const [claimedBy, setClaimedBy] = useState<string | null>(null);

  // Poll claim status every 4 seconds until claimed or expired
  useEffect(() => {
    if (!session?.claim_token) return;

    let isSubscribed = true;
    let timerId: NodeJS.Timeout;

    const poll = async () => {
      try {
        const res = await api.pollClaimStatus(session.claim_token, platformUrl);
        if (!isSubscribed) return;

        if (res.status === 'claimed') {
          setClaimStatus('claimed');
          if (res.platform_jwt) {
            setClaimedBy(res.claimed_by);
            updateJWT(res.platform_jwt);
            setPersistentAuth({
              jwt: res.platform_jwt,
              username: res.claimed_by || 'Investigator',
              linkedAt: new Date().toISOString(),
            });
          }
          return; // Stop polling on success
        } else if (res.status === 'expired') {
          setClaimStatus('expired');
          return; // Stop polling on expiration
        } else if (res.status === 'pending') {
          setClaimStatus('pending');
        } else {
          setClaimStatus('unreachable');
        }
      } catch (err: unknown) {
        if (isSubscribed) {
          setClaimStatus('unreachable');
        }
      }

      if (isSubscribed) {
        timerId = setTimeout(poll, 4000);
      }
    };

    poll();

    return () => {
      isSubscribed = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [session?.claim_token, platformUrl, updateJWT, setPersistentAuth]);

  if (!session) {
    navigate('/');
    return null;
  }

  const handleChooseFlow = (flow: 'carving' | 'manual') => {
    setSession({
      ...session,
      flow,
      step: 3,
    });

    if (flow === 'carving') {
      navigate('/drive');
    } else {
      navigate('/manual');
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col">
      <StepBar currentStep={2} flow={session.flow} />

      <main className="flex-1 max-w-4xl w-full mx-auto p-8 space-y-6 flex flex-col justify-center">
        <div className="bg-[#1a1d27] border border-[#2d3148] p-8 rounded-sm shadow-xl space-y-8">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-slate-100">Step 2: Link Session to SentinelFS Platform</h2>
            <p className="text-xs text-slate-400">
              Scan the QR code or open the claim URL in your browser to authenticate and link this local investigation session.
            </p>
          </div>

          <ClaimLinkBox claimUrl={session.claim_url} claimToken={session.claim_token} />

          {/* Status Badge */}
          <div className="bg-[#0f1117] border border-[#2d3148] p-4 rounded-sm flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Connection Status:
            </span>

            {claimStatus === 'pending' && (
              <div className="flex items-center space-x-2 text-amber-400 text-xs font-semibold">
                <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />
                <span>Waiting for platform authentication...</span>
              </div>
            )}

            {claimStatus === 'unreachable' && (
              <div className="flex items-center space-x-2 text-amber-400 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4" />
                <span>Platform unreachable ({platformUrl}) — retrying...</span>
              </div>
            )}

            {claimStatus === 'claimed' && (
              <div className="flex items-center space-x-2 text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Linked & Authenticated as: {claimedBy || 'Investigator'}</span>
              </div>
            )}

            {claimStatus === 'expired' && (
              <div className="flex items-center space-x-2 text-red-400 text-xs font-semibold">
                <Clock className="w-4 h-4" />
                <span>Token expired</span>
              </div>
            )}
          </div>

          {/* Next Steps (Enabled after claiming or allow dev bypass) */}
          <div className="space-y-4 pt-4 border-t border-[#2d3148]">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Select Evidence Acquisition Workflow:
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                disabled={claimStatus !== 'claimed'}
                onClick={() => handleChooseFlow('carving')}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white p-5 rounded-sm flex flex-col items-start space-y-2 transition-all text-left shadow-lg shadow-blue-600/20"
              >
                <div className="flex items-center space-x-2 font-semibold text-sm">
                  <Search className="w-5 h-5" />
                  <span>Run Forensic Disk Carving</span>
                </div>
                <p className="text-xs text-blue-100 opacity-90 leading-relaxed">
                  Scan raw disk image, partition, or seized DVR hard drive to carve missing/deleted video stream segments.
                </p>
              </button>

              <button
                disabled={claimStatus !== 'claimed'}
                onClick={() => handleChooseFlow('manual')}
                className="bg-[#2d3148] hover:bg-[#393e5b] disabled:opacity-50 text-white p-5 rounded-sm flex flex-col items-start space-y-2 transition-all text-left border border-[#3e4464]"
              >
                <div className="flex items-center space-x-2 font-semibold text-sm text-purple-400">
                  <FolderPlus className="w-5 h-5" />
                  <span>Upload Existing Video Files</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Select video files (.mp4, .avi, .dav, .h264) directly from your computer for dual-hashing and platform upload.
                </p>
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-slate-400 hover:text-white text-xs px-4 py-2 rounded-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Case Setup</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
