from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# ─── Auth Schemas ─────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    agency_name: Optional[str] = "Metro Cyber & Major Crimes"
    badge_number: Optional[str] = "#4792"

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    role: str
    agency_name: str
    badge_number: str
    is_active: bool

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# ─── Case Schemas ─────────────────────────────────────────────────────────────
class CaseCreate(BaseModel):
    case_number: str
    title: str
    description: Optional[str] = None
    jurisdiction: Optional[str] = "Metro Cyber Division"

class CaseResponse(BaseModel):
    id: str
    case_number: str
    title: str
    description: Optional[str]
    jurisdiction: str
    status: str
    merkle_root_sha256: Optional[str]
    sealed_package_path: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# ─── Evidence Schemas ─────────────────────────────────────────────────────────
class EvidenceCreate(BaseModel):
    case_id: str
    file_name: str
    file_path: str
    file_type: Optional[str] = "raw_disk"
    raw_sha256: str
    raw_md5: str
    file_size_bytes: Optional[int] = 0

class EvidenceResponse(BaseModel):
    id: str
    case_id: str
    file_name: str
    file_path: str
    file_type: str
    raw_sha256: str
    raw_md5: str
    integrity_status: str
    file_size_bytes: int
    created_at: datetime

    class Config:
        from_attributes = True

# ─── Task & Telemetry Schemas ─────────────────────────────────────────────────
class TaskDispatchResponse(BaseModel):
    task_id: str
    case_id: str
    task_type: str
    status: str = "PENDING"
    message: str

class TaskTelemetry(BaseModel):
    task_id: str
    task_type: str
    status: str
    progress_percent: float
    current_step: str
    fps: Optional[float] = 0.0
    bytes_processed: Optional[int] = 0
    hashes: Optional[Dict[str, str]] = None
    logs: List[str] = []
    error: Optional[str] = None

# ─── Timeline Schemas ─────────────────────────────────────────────────────────
class TimelineEventResponse(BaseModel):
    id: str
    case_id: str
    evidence_id: Optional[str]
    entity_class: str
    track_id: str
    camera_channel: int
    start_sec: float
    end_sec: float
    temporal_offset_sec: float
    confidence_avg: float
    bounding_box: List[float]
    metadata_json: Dict[str, Any]

    class Config:
        from_attributes = True

class TemporalDriftUpdate(BaseModel):
    camera_channel: int
    temporal_offset_sec: float
