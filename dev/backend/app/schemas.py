from datetime import date
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Tone(str, Enum):
    friendly = "Friendly"
    formal = "Formal"
    urgent = "Urgent"


class Channel(str, Enum):
    whatsapp = "WhatsApp"
    email = "Email"


class RiskLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class Interaction(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    channel: str = Field(min_length=1, max_length=32)
    direction: str = Field(pattern="^(in|out)$")
    timestamp: str = Field(min_length=1, max_length=80)
    text: str = Field(min_length=1, max_length=1_500)


class CandidateContext(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    candidate_id: str = Field(alias="candidateId", min_length=1, max_length=80)
    candidate_name: str = Field(alias="candidateName", min_length=1, max_length=120)
    role: str | None = Field(default=None, max_length=120)
    location: str | None = Field(default=None, max_length=120)
    joining_date: str = Field(alias="joiningDate", min_length=1, max_length=32)
    days_to_join: int = Field(alias="daysToJoin", ge=0, le=730)
    risk: RiskLevel
    next_action: str = Field(alias="nextAction", min_length=1, max_length=400)
    interactions: list[Interaction] = Field(default_factory=list, max_length=12)


class GenerateMessageRequest(CandidateContext):
    channel: Channel
    tone: Tone


class EvidenceSignal(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: str = Field(min_length=1, max_length=60)
    quote: str = Field(min_length=1, max_length=400)
    severity: RiskLevel


class CandidateAnalysis(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str = Field(min_length=1, max_length=700)
    risk: RiskLevel
    evidence: list[EvidenceSignal] = Field(max_length=5)
    recommended_action: str = Field(min_length=1, max_length=350)
    confidence: float = Field(ge=0, le=1)
    limitations: list[str] = Field(min_length=1, max_length=4)


class GenerateMessageResponse(BaseModel):
    draft: str = Field(min_length=1, max_length=1_200)
    model: str
    request_id: str = Field(serialization_alias="requestId")


class AnalysisResponse(CandidateAnalysis):
    model: str
    request_id: str = Field(serialization_alias="requestId")


class HealthResponse(BaseModel):
    status: str
    groq_configured: bool = Field(serialization_alias="groqConfigured")


class ErrorResponse(BaseModel):
    code: str
    message: str
    request_id: str = Field(serialization_alias="requestId")


class PersistedJourneyStep(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    key: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=120)
    status: str = Field(pattern="^(completed|pending|overdue)$")


class BootstrapInteraction(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    channel: str = Field(min_length=1, max_length=32)
    direction: str = Field(pattern="^(in|out)$")
    text: str = Field(min_length=1, max_length=1_500)
    tone: str | None = Field(default=None, max_length=40)


class CandidateBootstrapRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    candidate_id: str = Field(alias="candidateId", min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=120)
    email: str | None = Field(default=None, max_length=254)
    role: str = Field(min_length=1, max_length=120)
    department: str | None = Field(default=None, max_length=120)
    location: str | None = Field(default=None, max_length=120)
    recruiter: str | None = Field(default=None, max_length=120)
    offer_date: str | None = Field(alias="offerDate", default=None, max_length=32)
    joining_date: str | None = Field(alias="joiningDate", default=None, max_length=32)
    risk: RiskLevel
    ai_risk: RiskLevel = Field(alias="aiRisk")
    steps: list[PersistedJourneyStep] = Field(min_length=1, max_length=12)
    interactions: list[BootstrapInteraction] = Field(default_factory=list, max_length=30)


class ManualInteractionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    channel: str = Field(min_length=1, max_length=32)
    text: str = Field(min_length=1, max_length=1_500)
    tone: str | None = Field(default="Manual log", max_length=40)


class RiskOverrideRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    risk: RiskLevel
    reason: str = Field(min_length=1, max_length=1_000)
    overridden_by: str = Field(alias="overriddenBy", default="Recruiter", min_length=1, max_length=120)


class JourneyStatusRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str = Field(pattern="^(completed|pending|overdue)$")


class PersistedInteractionResponse(BaseModel):
    id: str
    channel: str
    direction: str
    timestamp: str
    text: str
    tone: str


class CandidatePersistenceResponse(BaseModel):
    candidate_id: str = Field(serialization_alias="candidateId")
    risk: RiskLevel
    ai_risk: RiskLevel = Field(serialization_alias="aiRisk")
    override_reason: str | None = Field(serialization_alias="overrideReason")
    steps: dict[str, str]
    interactions: list[PersistedInteractionResponse]


class DashboardJourneyStep(BaseModel):
    key: str
    label: str
    short_label: str = Field(serialization_alias="shortLabel")
    due: str
    status: str


class DashboardCandidateResponse(BaseModel):
    id: str
    name: str
    initials: str
    role: str
    department: str
    location: str
    recruiter: str
    recruiter_initials: str = Field(serialization_alias="recruiterInitials")
    offer_date: str = Field(serialization_alias="offerDate")
    joining_date: str = Field(serialization_alias="joiningDate")
    joining_day_label: str = Field(serialization_alias="joiningDayLabel")
    days_to_join: int = Field(serialization_alias="daysToJoin")
    risk: RiskLevel
    ai_risk: RiskLevel = Field(serialization_alias="aiRisk")
    engagement: str
    last_contact_days: int = Field(serialization_alias="lastContactDays")
    next_action: str = Field(serialization_alias="nextAction")
    email: str
    steps: list[DashboardJourneyStep]


class CandidatePageResponse(BaseModel):
    items: list[DashboardCandidateResponse]
    total: int
    page: int
    page_size: int = Field(serialization_alias="pageSize")
    total_pages: int = Field(serialization_alias="totalPages")
