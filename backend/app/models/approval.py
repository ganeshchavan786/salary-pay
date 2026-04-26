from sqlalchemy import Column, String, DateTime, Integer, Boolean, ForeignKey, Text, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.database import Base

class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    ESCALATED = "escalated"

class ApprovalWorkflow(Base):
    __tablename__ = "approval_workflows"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workflow_name = Column(String(100), nullable=False)
    workflow_type = Column(String(50), nullable=False)
    steps = Column(JSON, nullable=False, default=list)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class ApprovalRequest(Base):
    __tablename__ = "approval_requests"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workflow_id = Column(String(36), ForeignKey("approval_workflows.id"), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(String(36), nullable=False)
    current_step = Column(Integer, default=1)
    status = Column(SQLEnum(ApprovalStatus), default=ApprovalStatus.PENDING)
    requested_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    requested_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

class ApprovalAction(Base):
    __tablename__ = "approval_actions"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    request_id = Column(String(36), ForeignKey("approval_requests.id"), nullable=False)
    step_number = Column(Integer, nullable=False)
    approver_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    action = Column(String(20), nullable=False)  # approved / rejected / delegated / escalated
    comments = Column(Text, nullable=True)
    action_date = Column(DateTime, default=datetime.utcnow)
