import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Welcome } from './pages/Welcome';
import { ClaimLinkStep } from './pages/ClaimLinkStep';
import { DriveSelect } from './pages/DriveSelect';
import { Carving } from './pages/Carving';
import { Preview } from './pages/Preview';
import { ManualUpload } from './pages/ManualUpload';
import { ClaimUpload } from './pages/ClaimUpload';
import { DeviceLinkPage } from './pages/DeviceLinkPage';
import { useCaseStore } from './store/caseStore';

export const App: React.FC = () => {
  const { persistentAuth } = useCaseStore();

  return (
    <Router>
      <Routes>
        {/* If device is not linked yet, default page is Device Pairing */}
        <Route path="/" element={persistentAuth ? <Welcome /> : <DeviceLinkPage />} />
        <Route path="/link-device" element={<DeviceLinkPage />} />
        <Route path="/case-setup" element={<Welcome />} />
        {/* Step 2: Claim & Link Session */}
        <Route path="/claim" element={<ClaimLinkStep />} />
        {/* Carving flow */}
        <Route path="/drive" element={<DriveSelect />} />
        <Route path="/carving" element={<Carving />} />
        <Route path="/preview" element={<Preview />} />
        {/* Manual upload flow */}
        <Route path="/manual" element={<ManualUpload />} />
        {/* Final step */}
        <Route path="/upload" element={<ClaimUpload />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
