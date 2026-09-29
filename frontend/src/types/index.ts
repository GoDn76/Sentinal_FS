export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  agency_name: string;
  badge_number: string;
  is_active: boolean;
}

export interface Case {
  id: string;
  case_number: string;
  title: string;
  description?: string;
  jurisdiction: string;
  status: 'active' | 'locked' | 'archived';
  merkle_root_sha256?: string;
  sealed_package_path?: string;
  created_at: string;
}

export interface Evidence {
  id: string;
  case_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  raw_sha256: string;
  raw_md5: string;
  verified_sha256?: string;
  verified_md5?: string;
  integrity_status: 'verified' | 'tampered' | 'pending' | 'missing';
  file_size_bytes: number;
  camera_channel?: number;
  created_at: string;
}

export interface TimelineEvent {
  id: string;
  case_id: string;
  evidence_id?: string;
  entity_class: 'Person' | 'Vehicle' | 'Face' | 'Object';
  track_id: string;
  camera_channel: number;
  start_sec: number;
  end_sec: number;
  temporal_offset_sec: number;
  confidence_avg: number;
  bounding_box: [number, number, number, number];
  metadata_json?: Record<string, any>;
}

export interface TaskTelemetry {
  task_id: string;
  task_type: string;
  status: 'PENDING' | 'PROGRESS' | 'SUCCESS' | 'FAILURE';
  progress_percent: number;
  current_step: string;
  fps?: number;
  bytes_processed?: number;
  hashes?: {
    sha256?: string;
    md5?: string;
  };
  logs: string[];
  error?: string;
}
