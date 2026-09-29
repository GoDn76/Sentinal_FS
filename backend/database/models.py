
from datetime import datetime, timezone, timedelta
import uuid
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from backend.database.connection import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="investigator")  # admin, investigator, auditor
    agency_name = Column(String, default="Metro Cyber & Major Crimes")
    badge_number = Column(String, default="#4792")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Case(Base):
    __tablename__ = "cases"

    id = Column(String, primary_key=True, default=generate_uuid)
    case_number = Column(String, unique=True, nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    jurisdiction = Column(String, default="Metro Cyber Division")
    status = Column(String, default="active")  # active, locked, archived
    lead_investigator_id = Column(String, ForeignKey("users.id"), nullable=True)
    merkle_root_sha256 = Column(String, nullable=True)
    sealed_package_path = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    evidences = relationship("Evidence", back_populates="case", cascade="all, delete-orphan")
    timeline_events = relationship("TimelineEvent", back_populates="case", cascade="all, delete-orphan")

class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(String, primary_key=True, default=generate_uuid)
    case_id = Column(String, ForeignKey("cases.id"), nullable=False)
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(String, default="raw_disk")  # raw_disk, carved_dav, normalized_mp4
    raw_sha256 = Column(String, nullable=False)
    raw_md5 = Column(String, nullable=False)
    verified_sha256 = Column(String, nullable=True)
    verified_md5 = Column(String, nullable=True)
    integrity_status = Column(String, default="verified")  # verified, tampered, pending
    file_size_bytes = Column(Integer, default=0)
    camera_channel = Column(Integer, default=1)
    metadata_json = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    case = relationship("Case", back_populates="evidences")

class TimelineEvent(Base):
    __tablename__ = "timeline_events"

    id = Column(String, primary_key=True, default=generate_uuid)
    case_id = Column(String, ForeignKey("cases.id"), nullable=False)
    evidence_id = Column(String, ForeignKey("evidence.id"), nullable=True)
    entity_class = Column(String, nullable=False)  # Person, Vehicle, Face, Object
    track_id = Column(String, nullable=False)
    camera_channel = Column(Integer, default=1)
    start_sec = Column(Float, nullable=False)
    end_sec = Column(Float, nullable=False)
    temporal_offset_sec = Column(Float, default=0.0)  # Clock-drift sync offset
    confidence_avg = Column(Float, default=0.90)
    bounding_box = Column(JSON, default=list)  # [x1, y1, x2, y2]
    embedding_512dim = Column(JSON, nullable=True)
    metadata_json = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    case = relationship("Case", back_populates="timeline_events")

class ClaimToken(Base):
    __tablename__ = "claim_tokens"

    id = Column(String, primary_key=True, default=generate_uuid)
    token = Column(String, unique=True, nullable=False, index=True)
    case_id = Column(String, nullable=False)
    operator_name = Column(String, nullable=False)
    case_reference = Column(String, nullable=False)
    status = Column(String, default="pending")  # pending, claimed, expired
    claimed_by = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc) + timedelta(days=7))


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id = Column(String, primary_key=True, default=generate_uuid)
    case_id = Column(String, nullable=False)
    status = Column(String, default="queued")  # queued, processing, done, failed
    segment_files = Column(JSON, default=list)
    camera_channel = Column(Integer, default=0)
    payload = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    finished_at = Column(DateTime(timezone=True), nullable=True)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    case_id = Column(String, nullable=True)
    phase = Column(String, nullable=False)
    action = Column(String, nullable=False)
    status = Column(String, nullable=False)
    details = Column(JSON, default=dict)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
