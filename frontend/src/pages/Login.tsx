import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, Lock, User as UserIcon, Building, BadgeCheck } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('det_vance');
  const [email, setEmail] = useState('m.vance@cyber.gov');
  const [password, setPassword] = useState('Investigator123!');
  const [agencyName, setAgencyName] = useState('Metro Cyber & Major Crimes');
  const [badgeNumber, setBadgeNumber] = useState('#4792');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        const res = await fetch('http://localhost:8000/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            email,
            password,
            agency_name: agencyName,
            badge_number: badgeNumber,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.detail || 'Registration failed');
        }
      }

      // Login
      const loginRes = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!loginRes.ok) {
        const data = await loginRes.json();
        throw new Error(data.detail || 'Login failed');
      }

      const tokenData = await loginRes.json();
      setAuth(tokenData.user, tokenData.access_token);

      const redirectUrl = searchParams.get('redirect') || '/dashboard';
      navigate(redirectUrl, { replace: true });
    } catch (err: any) {

      setError(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10 space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-teal-400 shadow-inner">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-mono font-bold text-slate-100 uppercase tracking-tight">
            SentinelFS Console Access
          </h1>
          <p className="text-xs font-mono text-slate-400">
            Unified Multi-Vendor DVR/NVR Forensic Analysis Platform
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          <div>
            <label className="block text-slate-400 mb-1">Investigator Username</label>
            <div className="relative">
              <UserIcon className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-slate-200 focus:outline-none focus:border-teal-400"
              />
            </div>
          </div>

          {isRegister && (
            <>
              <div>
                <label className="block text-slate-400 mb-1">Agency Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Agency Name</label>
                  <input
                    type="text"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Badge Number</label>
                  <input
                    type="text"
                    value={badgeNumber}
                    onChange={(e) => setBadgeNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-400"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-slate-400 mb-1">Secure Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-slate-200 focus:outline-none focus:border-teal-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <BadgeCheck className="w-4 h-4" />
            <span>{loading ? 'Authenticating...' : isRegister ? 'Register Account' : 'Investigator Sign In'}</span>
          </button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            className="text-xs font-mono text-teal-400 hover:underline"
          >
            {isRegister ? 'Already registered? Sign In' : 'Need Agency Account? Register'}
          </button>
        </div>
      </div>
    </div>
  );
};
