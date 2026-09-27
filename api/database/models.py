import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from api.database.connection import Base

def default_claim_expiration():
    return datetime.now(timezone.utc) + timedelta(days=7)

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(64), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(32), default="investigator")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    cases = relationship("Case", back_populates="owner")

class ClaimToken(Base):
    __tablename__ = "claim_tokens"

    token = Column(String(36), primary_key=True)   # UUID string from agent
    case_id = Column(String(36), nullable=False)
    operator_name = Column(String(128), nullable=False)
    case_reference = Column(String(128), nullable=False)
    status = Column(String(16), default="pending")  # pending | claimed
    claimed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    claimed_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), default=default_claim_expiration)

    claimed_by_user = relationship("User")

class Case(Base):
    __tablename__ = "cases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_reference = Column(String(128), nullable=False)
    operator_name = Column(String(128), nullable=False)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    claim_token = Column(String(36), ForeignKey("claim_tokens.token"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String(32), default="active")

    owner = relationship("User", back_populates="cases")
