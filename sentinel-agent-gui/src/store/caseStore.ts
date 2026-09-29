import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CaseSession, CarvedSegmentUI, CarvingProgress, DriveInfo } from '../types';

export interface PersistentAuth {
  jwt: string;
  username: string;
  linkedAt: string;
}

export interface CaseState {
  operatorName: string;
  caseReference: string;
  claimToken: string;
  selectedDrive: DriveInfo | null;
  carvingProgress: CarvingProgress | null;
  segments: CarvedSegmentUI[];
  isLinked: boolean;

  session: CaseSession | null;
  progress: CarvingProgress | null;
  jobId: string | null;
  platformUrl: string;
  persistentAuth: PersistentAuth | null;

  setOperator: (name: string, reference?: string) => void;
  setClaimToken: (token: string) => void;
  setSelectedDrive: (drive: DriveInfo | null) => void;
  updateProgress: (progress: CarvingProgress) => void;
  setProgress: (progress: CarvingProgress) => void;
  addSegment: (segment: CarvedSegmentUI) => void;
  updateSegment: (segment: CarvedSegmentUI) => void;
  setSegments: (segments: CarvedSegmentUI[]) => void;
  addSegments: (newSegments: CarvedSegmentUI[]) => void;
  setSession: (session: CaseSession) => void;
  updateJWT: (jwt: string) => void;
  setJobId: (jobId: string | null) => void;
  setPlatformUrl: (url: string) => void;
  setPersistentAuth: (auth: PersistentAuth | null) => void;
  logoutPersistentAuth: () => void;
  resetWorkspace: () => void;
  reset: () => void;
}


export const useCaseStore = create<CaseState>()(
  persist(
    (set) => ({
      operatorName: '',
      caseReference: '',
      claimToken: '',
      selectedDrive: null,
      carvingProgress: null,
      segments: [],
      isLinked: false,
      session: null,
      progress: null,
      jobId: null,
      platformUrl: 'http://localhost:8000',
      persistentAuth: null,

      setOperator: (operatorName, caseReference) =>
        set((state) => ({
          operatorName,
          caseReference: caseReference !== undefined ? caseReference : state.caseReference,
        })),
      setClaimToken: (claimToken) => set({ claimToken }),
      setSelectedDrive: (selectedDrive) => set({ selectedDrive }),
      updateProgress: (progress) => set({ carvingProgress: progress, progress }),
      setProgress: (progress) => set({ carvingProgress: progress, progress }),
      addSegment: (segment) =>
        set((state) => {
          const existing = state.segments.filter((s) => s.filename !== segment.filename);
          return { segments: [...existing, segment] };
        }),
      updateSegment: (segment) =>
        set((state) => {
          const existing = state.segments.filter((s) => s.filename !== segment.filename);
          return { segments: [...existing, segment] };
        }),

      setSegments: (segments) => set({ segments }),
      addSegments: (newSegments) =>
        set((state) => {
          const existingMap = new Map(state.segments.map((s) => [s.filename, s]));
          for (const seg of newSegments) {
            existingMap.set(seg.filename, seg);
          }
          return { segments: Array.from(existingMap.values()) };
        }),
      setSession: (session) => set({ session }),
      updateJWT: (jwt) =>
        set((state) => ({
          session: state.session ? { ...state.session, platform_jwt: jwt } : null,
          persistentAuth: {
            jwt,
            username: state.session?.operator_name || 'Investigator',
            linkedAt: new Date().toISOString(),
          },
        })),
      setJobId: (jobId) => set({ jobId }),
      setPlatformUrl: (platformUrl) => set({ platformUrl }),
      setPersistentAuth: (persistentAuth) => set({ persistentAuth, isLinked: !!persistentAuth }),
      logoutPersistentAuth: () => set({ persistentAuth: null, isLinked: false }),
      resetWorkspace: () =>
        set({
          session: null,
          segments: [],
          progress: null,
          carvingProgress: null,
          jobId: null,
          selectedDrive: null,
          operatorName: '',
          caseReference: '',
          claimToken: '',
        }),
      reset: () =>
        set({ session: null, segments: [], progress: null, carvingProgress: null, jobId: null }),
    }),
    {
      name: 'sentinelfs-case-storage',
      partialize: (state) => ({
        session: state.session,
        platformUrl: state.platformUrl,
        persistentAuth: state.persistentAuth,
        operatorName: state.operatorName,
        caseReference: state.caseReference,
        claimToken: state.claimToken,
        isLinked: state.isLinked,
      }),
    }
  )
);
