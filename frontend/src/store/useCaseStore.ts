import { create } from 'zustand';
import { Case, Evidence, TimelineEvent } from '../types';

interface CaseState {
  cases: Case[];
  activeCase: Case | null;
  evidences: Evidence[];
  timelineEvents: TimelineEvent[];
  activeTaskId: string | null;

  setCases: (cases: Case[]) => void;
  setActiveCase: (activeCase: Case | null) => void;
  setEvidences: (evidences: Evidence[]) => void;
  setTimelineEvents: (events: TimelineEvent[]) => void;
  setActiveTaskId: (taskId: string | null) => void;
}

export const useCaseStore = create<CaseState>((set) => ({
  cases: [],
  activeCase: null,
  evidences: [],
  timelineEvents: [],
  activeTaskId: null,

  setCases: (cases) => set({ cases }),
  setActiveCase: (activeCase) => set({ activeCase }),
  setEvidences: (evidences) => set({ evidences }),
  setTimelineEvents: (timelineEvents) => set({ timelineEvents }),
  setActiveTaskId: (activeTaskId) => set({ activeTaskId }),
}));
