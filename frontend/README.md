# SentinelFS Command & Control Web Dashboard (Layer 4)

The **SentinelFS Web Dashboard** is a web application built using **React 18, Vite, TypeScript, Tailwind CSS, Recharts, and Zustand**. It provides investigators with interactive case management, live evidence previewing, per-camera clock-drift calibration sliders ($\Delta t_i$), multi-channel timeline analysis, suspect cross-camera trajectory correlation, and court package report download.

---

## 📂 Subsystem Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Navbar.tsx             # Main navigation bar with case switcher & status
│   │   ├── Sidebar.tsx            # Navigation menu (Cases, Dashboard, Timeline, Audit Logs)
│   │   ├── VideoPlayer.tsx        # HTML5 video player with seek controls & frame inspection
│   │   ├── HashBadge.tsx          # Dual-hash (SHA-256 / MD5) integrity status badge
│   │   └── ClockDriftSlider.tsx   # Interactive temporal offset adjustment slider (Δt_i)
│   ├── pages/
│   │   ├── Cases.tsx              # Case management & QR claim device pairing screen
│   │   ├── CaseDashboard.tsx      # Case evidence overview, channel stats, and analysis trigger
│   │   ├── TimelineAnalysis.tsx   # Interactive multi-camera timeline & suspect trajectory
│   │   └── AuditLogs.tsx          # Chain-of-custody audit log ledger
│   ├── store/
│   │   ├── useCaseStore.ts        # Case & evidence Zustand state
│   │   └── useAuthStore.ts        # Investigator authentication & JWT session state
│   ├── services/
│   │   └── api.ts                 # Axios / Fetch client for FastAPI backend communication
│   ├── App.tsx                    # React Router configuration
│   └── main.tsx                   # React root mounting
├── index.html                     # Application entry point
├── vite.config.ts                 # Vite bundler & dev server config
└── package.json                   # Web dashboard dependencies
```

---

## 🚀 Key Features

1. **Interactive Multi-Channel Timeline**: Visualizes person and vehicle detection tracks across camera channels with synchronized timestamp alignment.
2. **Clock-Drift Calibration**: Allows investigators to adjust temporal offsets ($\Delta t_i$) per camera channel to sync out-of-phase DVR clocks before FAISS vector search.
3. **Suspect Search & Trajectory Correlation**: Perform cross-camera vector queries using 512-dim facial/body embeddings to reconstruct suspect movements across feeds.
4. **Court Package Sealing**: Trigger one-click generation of court-admissible `.case.zip` packages containing Section 63(4) BSA certificates and Polygon Merkle seals.

---

## 🛠 Local Development Commands

```bash
# Install dependencies
npm install

# Start Vite development server on http://localhost:5173
npm run dev

# Build production bundle
npm run build
```
