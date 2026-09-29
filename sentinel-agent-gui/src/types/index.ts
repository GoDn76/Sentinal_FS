export interface ClaimTokenResponse {
  claim_token: string;
  claim_url: string;
  case_id: string;
  operator: string;
  generated_at: string;
}

export interface ClaimStatusResponse {
  status: 'pending' | 'claimed' | 'unreachable' | 'expired';
  claimed_by: string | null;
  platform_jwt: string | null;
}

export interface DriveInfo {
  path: string; // "FILE_PICKER" is the sentinel for file dialog
  label: string;
  size_bytes: number;
  is_removable: boolean;
}

export interface CarvingProgress {
  status: 'running' | 'complete' | 'error';
  bytes_scanned: number;
  total_bytes: number;
  segments_found: number;
  current_action: string;
  error_message: string | null;
}

export interface CarvedSegmentUI {
  filename: string;
  camera_channel: number; // 0 = unknown, 1+ = specific channel
  tier_used: string;
  timestamp_start: string | null;
  timestamp_end: string | null;
  sha256: string;
  md5: string;
  frame_count: number;
  is_deleted: boolean;
  size_bytes: number;
  local_path: string;
  preview_path?: string | null;
  can_preview: boolean;
  source: 'carved' | 'manual';
}

export interface FileHashResult {
  sha256: string;
  md5: string;
  size_bytes: number;
}

export interface VideoProbeResult {
  duration_sec: number;
  width: number;
  height: number;
  codec: string;
  creation_time: string | null;
  frame_rate: number;
}

export interface CaseSession {
  operator_name: string;
  case_reference: string;
  case_id: string;
  claim_token: string;
  claim_url: string;
  platform_jwt: string | null;
  output_dir: string;
  flow: 'carving' | 'manual';
  step: 1 | 2 | 3 | 4 | 5;
}

export interface AuditLogEntry {
  seq: number;
  timestamp: string;
  action: string;
  details: string;
  current_block_hash: string;
  previous_block_hash: string;
}

export interface UploadResult {
  success: boolean;
  case_url: string;
  segments_uploaded: number;
  upload_duration_sec: number;
  local_cleanup_complete: boolean;
}
