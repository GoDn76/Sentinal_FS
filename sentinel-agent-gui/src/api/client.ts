import { invoke } from '@tauri-apps/api/core';
import type {
  ClaimTokenResponse,
  ClaimStatusResponse,
  DriveInfo,
  CarvingProgress,
  CarvedSegmentUI,
  FileHashResult,
  VideoProbeResult,
  UploadResult,
} from '../types';

export const isTauriEnv = (): boolean => {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
};

export const api = {
  generateClaimToken: async (operatorName: string, caseReference: string): Promise<ClaimTokenResponse> => {
    if (isTauriEnv()) {
      return invoke<ClaimTokenResponse>('generate_claim_token', {
        operatorName,
        caseReference,
      });
    }

    // Web browser fallback
    const claim_token = crypto.randomUUID();
    const case_id = crypto.randomUUID();
    const platform_url = (import.meta.env as any).VITE_API_BASE_URL || localStorage.getItem('sentinelfs_platform_url') || 'http://localhost:8000';
    const dashboard_url = (import.meta.env as any).VITE_WEB_DASHBOARD_URL || localStorage.getItem('sentinelfs_dashboard_url') || 'http://localhost:3000';
    const claim_url = `${dashboard_url.replace(/\/$/, '')}/claim/${claim_token}`;
    const generated_at = new Date().toISOString();



    // Register token with local backend server if reachable
    try {
      await fetch(`${platform_url}/api/v1/claim/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: claim_token,
          case_id,
          operator_name: operatorName,
          case_reference: caseReference,
        }),
      });
    } catch (e) {
      console.warn('Backend claim registration notice:', e);
    }

    return {
      claim_token,
      claim_url,
      case_id,
      operator: operatorName,
      generated_at,
    };
  },

  pollClaimStatus: async (claimToken: string, apiBaseUrl: string): Promise<ClaimStatusResponse> => {
    if (isTauriEnv()) {
      return invoke<ClaimStatusResponse>('poll_claim_status', {
        claimToken,
        apiBaseUrl,
      });
    }

    // Web browser fallback via standard fetch
    try {
      const res = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/api/v1/claim/${claimToken}/status`);
      if (res.ok) {
        return (await res.json()) as ClaimStatusResponse;
      }
      return { status: 'unreachable', claimed_by: null, platform_jwt: null };
    } catch {
      return { status: 'unreachable', claimed_by: null, platform_jwt: null };
    }
  },

  listDrives: async (): Promise<DriveInfo[]> => {
    if (isTauriEnv()) {
      return invoke<DriveInfo[]>('list_drives');
    }

    // Web browser fallback
    return [
      { path: '/dev/sda1', label: 'DVR HardDrive 1 (Seized)', size_bytes: 500107862016, is_removable: false },
      { path: '/dev/sdb1', label: 'USB Evidence Drive', size_bytes: 32000000000, is_removable: true },
      { path: 'FILE_PICKER', label: 'Open disk image file...', size_bytes: 0, is_removable: false },
    ];
  },

  startCarving: async (
    inputPath: string,
    outputDir: string,
    operator: string,
    caseId: string,
    vendorHint?: string
  ): Promise<string> => {
    if (isTauriEnv()) {
      return invoke<string>('start_carving', {
        inputPath,
        outputDir,
        operator,
        caseId,
        vendorHint: vendorHint || null,
      });
    }

    return `browser-job-${Date.now()}`;
  },

  getCarvingProgress: async (jobId: string): Promise<CarvingProgress> => {
    if (isTauriEnv()) {
      return invoke<CarvingProgress>('get_carving_progress', { jobId });
    }

    // Web browser mock progress
    return {
      status: 'complete',
      bytes_scanned: 500107862016,
      total_bytes: 500107862016,
      segments_found: 3,
      current_action: 'Carving complete. Manifest sealed.',
      error_message: null,
    };
  },

  getCarvedSegments: async (outputDir: string): Promise<CarvedSegmentUI[]> => {
    if (isTauriEnv()) {
      return invoke<CarvedSegmentUI[]>('get_carved_segments', { outputDir });
    }

    return [
      {
        filename: 'recovered_cam_01.dav',
        camera_channel: 1,
        tier_used: 'Dahua (DHAV)',
        timestamp_start: '2026-09-19T14:00:00Z',
        timestamp_end: '2026-09-19T14:15:00Z',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        md5: 'd41d8cd98f00b204e9800998ecf8427e',
        frame_count: 1800,
        is_deleted: true,
        size_bytes: 130432743,
        local_path: `${outputDir}/recovered_cam_01.dav`,
        can_preview: false,
        source: 'carved',
      },
      {
        filename: 'recovered_hik_stream_001.mp4',
        camera_channel: 0,
        tier_used: 'Hikvision',
        timestamp_start: 'SCR_MS:10452',
        timestamp_end: 'SCR_MS:98234',
        sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        md5: '5d41402abc4b2a76b9719d911017c592',
        frame_count: 2400,
        is_deleted: false,
        size_bytes: 201905291,
        local_path: `${outputDir}/recovered_hik_stream_001.mp4`,
        can_preview: true,
        source: 'carved',
      },
    ];
  },

  hashFile: async (filePath: string): Promise<FileHashResult> => {
    if (isTauriEnv()) {
      return invoke<FileHashResult>('hash_file', { filePath });
    }

    return {
      sha256: 'a3f9e018b2c45d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e',
      md5: '5d41402abc4b2a76b9719d911017c592',
      size_bytes: 45000000,
    };
  },

  prepareVideoPreview: async (filePath: string): Promise<string | null> => {
    if (isTauriEnv()) {
      return invoke<string | null>('prepare_video_preview', { filePath });
    }
    return null;
  },

  probeVideo: async (filePath: string): Promise<VideoProbeResult> => {
    if (isTauriEnv()) {
      return invoke<VideoProbeResult>('probe_video', { filePath });
    }

    return {
      duration_sec: 120.5,
      width: 1920,
      height: 1080,
      codec: 'h264',
      creation_time: '2026-09-19T14:30:00Z',
      frame_rate: 30.0,
    };
  },

  extractPreviewThumbnail: async (filePath: string): Promise<string> => {
    if (isTauriEnv()) {
      return invoke<string>('extract_preview_thumbnail', { filePath });
    }

    throw new Error('Thumbnail extraction unavailable in browser mode');
  },

  uploadEvidence: async (
    manifestPath: string,
    outputDir: string,
    apiBaseUrl: string,
    platformJwt: string,
    caseId: string,
    caseReference: string,
    segments: CarvedSegmentUI[]
  ): Promise<UploadResult> => {
    if (isTauriEnv()) {
      return invoke<UploadResult>('upload_evidence', {
        manifestPath,
        outputDir,
        apiBaseUrl,
        platformJwt,
        caseId,
        caseReference,
        segments,
      });
    }

    throw new Error('Uploading selected local files requires the SentinelFS desktop agent.');
  },
};
