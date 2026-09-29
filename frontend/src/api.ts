export const API_BASE_URL = (
  (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000'
).replace(/\/$/, '');

export const evidenceVideoUrl = (caseId: string, fileName: string): string => {
  return `${API_BASE_URL}/evidence_vault/${encodeURIComponent(caseId)}/${encodeURIComponent(fileName)}`;
};