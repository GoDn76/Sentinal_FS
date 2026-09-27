import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CaseSession, CarvedSegmentUI, CarvingProgress } from '../types';

interface CaseStore {
  session: CaseSession | null;
  segments: CarvedSegmentUI[];
  progress: CarvingProgress | null;
  jobId: string | null;
  platformUrl: string;

  setSession: (session: CaseSession) => void;
  updateJWT: (jwt: string) => void;
  setSegments: (segments: CarvedSegmentUI[]) => void;
  addSegments: (newSegments: CarvedSegmentUI[]) => void; // merges by filename
  setProgress: (progress: CarvingProgress) => void;
  setJobId: (jobId: string | null) => void;
  setPlatformUrl: (url: string) => void;
  reset: () => void;
}

export const useCaseStore = create<CaseStore>()(
  persist(
    (set) => ({
      session: null,
      segments: [],
      progress: null,
      jobId: null,
      platformUrl: 'http://localhost:8000',

      setSession: (session) => set({ session }),
      updateJWT: (jwt) =>
        set((state) => ({
          session: state.session ? { ...state.session, platform_jwt: jwt } : null,
        })),
      setSegments: (segments) => set({ segments }),
      addSegments: (newSegments) =>
        set((state) => {
          const existingMap = new Map(state.segments.map((s) => [s.filename, s]));
          for (const seg of newSegments) {
            existingMap.set(seg.filename, seg);
          }
          return { segments: Array.from(existingMap.values()) };
        }),
      setProgress: (progress) => set({ progress }),
      setJobId: (jobId) => set({ jobId }),
      setPlatformUrl: (platformUrl) => set({ platformUrl }),
      reset: () => set({ session: null, segments: [], progress: null, jobId: null }),
    }),
    {
      name: 'sentinelfs-case-storage',
      partialize: (state) => ({ session: state.session, platformUrl: state.platformUrl }),
    }
  )
);
