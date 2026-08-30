from datetime import date, datetime
from enum import Enum
from uuid import uuid4

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def new_id() -> str:
    return str(uuid4())


def utcnow() -> datetime:
    return datetime.utcnow()


class Base(DeclarativeBase):
    pass


class RiskLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class CandidateStatus(str, Enum):
    active = "active"
    joined = "joined"
    dropped = "dropped"


class JourneyStatus(str, Enum):
    completed = "completed"
    pending = "pending"
    overdue = "overdue"


class InteractionDirection(str, Enum):
    inbound = "in"
    outbound = "out"


class TaskStatus(str, Enum):
    open = "open"
    completed = "completed"
    dismissed = "dismissed"


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    external_id: Mapped[str | None] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str | None] = mapped_column(String(254), index=True)
    role: Mapped[str] = mapped_column(String(120))
    department: Mapped[str | None] = mapped_column(String(120))
    location: Mapped[str | None] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(32))
    recruiter: Mapped[str | None] = mapped_column(String(120), index=True)
    offer_date: Mapped[date | None] = mapped_column(Date)
    joining_date: Mapped[date | None] = mapped_column(Date, index=True)
    status: Mapped[CandidateStatus] = mapped_column(default=CandidateStatus.active, index=True)
    ai_risk: Mapped[RiskLevel] = mapped_column(default=RiskLevel.low, index=True)
    effective_risk: Mapped[RiskLevel] = mapped_column(default=RiskLevel.low, index=True)
    override_reason: Mapped[str | None] = mapped_column(Text)
    row_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    journey_steps: Mapped[list["CandidateJourneyStep"]] = relationship(back_populates="candidate", cascade="all, delete-orphan")
    interactions: Mapped[list["Interaction"]] = relationship(back_populates="candidate", cascade="all, delete-orphan")
    ai_analyses: Mapped[list["AIAnalysis"]] = relationship(back_populates="candidate", cascade="all, delete-orphan")
    risk_overrides: Mapped[list["RiskOverride"]] = relationship(back_populates="candidate", cascade="all, delete-orphan")
    tasks: Mapped[list["Task"]] = relationship(back_populates="candidate", cascade="all, delete-orphan")


class CandidateJourneyStep(Base):
    __tablename__ = "candidate_journey_steps"
    __table_args__ = (UniqueConstraint("candidate_id", "step_key", name="uq_candidate_journey_step"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    candidate_id: Mapped[str] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"), index=True)
    step_key: Mapped[str] = mapped_column(String(64))
    label: Mapped[str] = mapped_column(String(120))
    due_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[JourneyStatus] = mapped_column(default=JourneyStatus.pending, index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)

    candidate: Mapped[Candidate] = relationship(back_populates="journey_steps")


class Interaction(Base):
    __tablename__ = "interactions"
    __table_args__ = (Index("ix_interactions_candidate_occurred", "candidate_id", "occurred_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    candidate_id: Mapped[str] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"), index=True)
    channel: Mapped[str] = mapped_column(String(32))
    direction: Mapped[InteractionDirection] = mapped_column(index=True)
    body: Mapped[str] = mapped_column(Text)
    tone: Mapped[str | None] = mapped_column(String(40))
    source: Mapped[str] = mapped_column(String(32), default="manual")
    occurred_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    candidate: Mapped[Candidate] = relationship(back_populates="interactions")


class AIAnalysis(Base):
    __tablename__ = "ai_analyses"
    __table_args__ = (Index("ix_ai_analyses_candidate_created", "candidate_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    candidate_id: Mapped[str] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"), index=True)
    analysis_type: Mapped[str] = mapped_column(String(48))
    model: Mapped[str] = mapped_column(String(120))
    prompt_version: Mapped[str] = mapped_column(String(32))
    input_fingerprint: Mapped[str] = mapped_column(String(64), index=True)
    output: Mapped[dict] = mapped_column(JSON)
    guard_score: Mapped[float | None] = mapped_column()
    validation_status: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    candidate: Mapped[Candidate] = relationship(back_populates="ai_analyses")


class RiskOverride(Base):
    __tablename__ = "risk_overrides"
    __table_args__ = (Index("ix_risk_overrides_candidate_created", "candidate_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    candidate_id: Mapped[str] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"), index=True)
    previous_risk: Mapped[RiskLevel] = mapped_column()
    new_risk: Mapped[RiskLevel] = mapped_column()
    reason: Mapped[str] = mapped_column(Text)
    overridden_by: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    candidate: Mapped[Candidate] = relationship(back_populates="risk_overrides")


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (Index("ix_tasks_status_due", "status", "due_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    candidate_id: Mapped[str] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(240))
    source: Mapped[str] = mapped_column(String(32), default="manual")
    status: Mapped[TaskStatus] = mapped_column(default=TaskStatus.open, index=True)
    assigned_to: Mapped[str | None] = mapped_column(String(120), index=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)

    candidate: Mapped[Candidate] = relationship(back_populates="tasks")


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_recipient_read", "recipient", "read_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    recipient: Mapped[str] = mapped_column(String(120), index=True)
    kind: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text)
    entity_type: Mapped[str | None] = mapped_column(String(40))
    entity_id: Mapped[str | None] = mapped_column(String(36))
    read_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
