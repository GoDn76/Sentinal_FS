import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { CaseDetails } from './pages/CaseDetails';
import { EvidenceVault } from './pages/EvidenceVault';
import { AIAnalysis } from './pages/AIAnalysis';
import { TimelineAnalysis } from './pages/TimelineAnalysis';
import { ComplianceReport } from './pages/ComplianceReport';
import { ClaimRedemption } from './pages/ClaimRedemption';

const ProtectedLayout: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    const redirectUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirectUrl}`} replace />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <Sidebar />
      <Navbar />
      <div className="pl-64 pt-16">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/cases" element={<Dashboard />} />
          <Route path="/cases/:id" element={<CaseDetails />} />
          <Route path="/evidence" element={<EvidenceVault />} />
          <Route path="/analysis" element={<AIAnalysis />} />
          <Route path="/timeline" element={<TimelineAnalysis />} />
          <Route path="/compliance" element={<ComplianceReport />} />
          <Route path="/compliance/:id" element={<ComplianceReport />} />
        </Routes>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/claim/:token" element={<ClaimRedemption />} />
        <Route path="/*" element={<ProtectedLayout />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
