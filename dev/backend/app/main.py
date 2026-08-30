from contextlib import asynccontextmanager
from datetime import date, datetime
from hashlib import sha256
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import engine, get_session, initialize_database
from app.models import AIAnalysis, Candidate, CandidateJourneyStep, Interaction, InteractionDirection, JourneyStatus, RiskLevel, RiskOverride
from app.schemas import AnalysisResponse, CandidateBootstrapRequest, CandidateContext, CandidatePageResponse, CandidatePersistenceResponse, DashboardCandidateResponse, DashboardJourneyStep, ErrorResponse, GenerateMessageRequest, GenerateMessageResponse, HealthResponse, JourneyStatusRequest, ManualInteractionRequest, PersistedInteractionResponse, RiskOverrideRequest
from app.services.groq_service import AIServiceError, GroqHRService


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.settings = get_settings()
    await initialize_database()
    try:
        yield
    finally:
        await engine.dispose()


app = FastAPI(title="Post-Offer HQ API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH"],
    allow_headers=["Content-Type", "X-Request-ID"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request.state.request_id = request.headers.get("X-Request-ID", str(uuid4()))
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    return response


@app.exception_handler(AIServiceError)
async def ai_service_error_handler(request: Request, error: AIServiceError):
    return JSONResponse(
        status_code=error.status_code,
        content=ErrorResponse(code=error.code, message=error.message, request_id=request.state.request_id).model_dump(by_alias=True),
    )


@app.exception_handler(HTTPException)
async def http_error_handler(request: Request, error: HTTPException):
    detail = error.detail if isinstance(error.detail, dict) else {"code": "request_rejected", "message": str(error.detail)}
    return JSONResponse(
        status_code=error.status_code,
        content=ErrorResponse(code=detail["code"], message=detail["message"], request_id=request.state.request_id).model_dump(by_alias=True),
    )


@app.exception_handler(RequestValidationError)
async def request_validation_error_handler(request: Request, _error: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=ErrorResponse(code="invalid_request", message="Request data failed validation.", request_id=request.state.request_id).model_dump(by_alias=True),
    )


@app.get("/api/v1/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    return HealthResponse(status="ok", groq_configured=bool(request.app.state.settings.groq_api_key))


async def get_candidate_or_404(session: AsyncSession, external_id: str) -> Candidate:
    candidate = await session.scalar(select(Candidate).where(Candidate.external_id == external_id))
    if not candidate:
        raise HTTPException(status_code=404, detail={"code": "candidate_not_found", "message": "Candidate was not found."})
    return candidate


async def candidate_snapshot(session: AsyncSession, candidate: Candidate) -> CandidatePersistenceResponse:
    steps = (await session.scalars(select(CandidateJourneyStep).where(CandidateJourneyStep.candidate_id == candidate.id))).all()
    interactions = (await session.scalars(select(Interaction).where(Interaction.candidate_id == candidate.id).order_by(Interaction.occurred_at.desc()))).all()
    return CandidatePersistenceResponse(
        candidate_id=candidate.external_id or candidate.id,
        risk=candidate.effective_risk,
        ai_risk=candidate.ai_risk,
        override_reason=candidate.override_reason,
        steps={step.step_key: step.status.value for step in steps},
        interactions=[PersistedInteractionResponse(id=item.id, channel=item.channel, direction=item.direction.value, timestamp=item.occurred_at.isoformat(), text=item.body, tone=item.tone or "Manual log") for item in interactions],
    )


def parse_display_date(value: str | None) -> date | None:
    if not value:
        return None
    for pattern in ("%d %b %Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, pattern).date()
        except ValueError:
            continue
    return None


def initials(name: str) -> str:
    return "".join(part[0] for part in name.split()[:2]).upper()


def engagement_for(risk: RiskLevel) -> str:
    return "at risk" if risk == RiskLevel.high else "needs attention" if risk == RiskLevel.medium else "on track"


def next_action_for(risk: RiskLevel) -> str:
    return "Call today to unblock joining concerns" if risk == RiskLevel.high else "Send a short check-in this week" if risk == RiskLevel.medium else "Keep the next journey step moving"


async def dashboard_candidate(session: AsyncSession, candidate: Candidate) -> DashboardCandidateResponse:
    steps = (await session.scalars(select(CandidateJourneyStep).where(CandidateJourneyStep.candidate_id == candidate.id).order_by(CandidateJourneyStep.step_key))).all()
    last_interaction = await session.scalar(select(Interaction.occurred_at).where(Interaction.candidate_id == candidate.id).order_by(Interaction.occurred_at.desc()).limit(1))
    days_to_join = max(0, (candidate.joining_date - date.today()).days) if candidate.joining_date else 0
    last_contact_days = max(0, (date.today() - last_interaction.date()).days) if last_interaction else 999
    return DashboardCandidateResponse(
        id=candidate.external_id or candidate.id,
        name=candidate.name,
        initials=initials(candidate.name),
        role=candidate.role,
        department=candidate.department or "General",
        location=candidate.location or "Not set",
        recruiter=candidate.recruiter or "Unassigned",
        recruiter_initials=initials(candidate.recruiter or "Unassigned"),
        offer_date=candidate.offer_date.strftime("%d %b %Y") if candidate.offer_date else "Not set",
        joining_date=candidate.joining_date.strftime("%d %b %Y") if candidate.joining_date else "Not set",
        joining_day_label=candidate.joining_date.strftime("%d %b") if candidate.joining_date else "TBD",
        days_to_join=days_to_join,
        risk=candidate.effective_risk,
        ai_risk=candidate.ai_risk,
        engagement=engagement_for(candidate.effective_risk),
        last_contact_days=last_contact_days,
        next_action=next_action_for(candidate.effective_risk),
        email=candidate.email or "",
        steps=[DashboardJourneyStep(key=step.step_key, label=step.label, short_label=step.label.split()[0], due="", status=step.status.value) for step in steps],
    )


@app.get("/api/v1/candidates", response_model=CandidatePageResponse)
async def list_candidates(
    search: str | None = Query(default=None, max_length=120),
    risk: RiskLevel | None = None,
    recruiter: str | None = Query(default=None, max_length=120),
    role: str | None = Query(default=None, max_length=120),
    month: int | None = Query(default=None, ge=1, le=12),
    engagement: str | None = Query(default=None, pattern="^(on track|needs attention|at risk)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, alias="pageSize", ge=1, le=100),
    sort: str = Query(default="joining", pattern="^(joining|risk)$"),
    session: AsyncSession = Depends(get_session),
) -> CandidatePageResponse:
    statement = select(Candidate).where(Candidate.status == "active")
    if search:
        term = f"%{search.lower()}%"
        statement = statement.where(func.lower(Candidate.name).like(term) | func.lower(Candidate.role).like(term) | func.lower(Candidate.location).like(term))
    if risk:
        statement = statement.where(Candidate.effective_risk == risk)
    if recruiter:
        statement = statement.where(Candidate.recruiter == recruiter)
    if role:
        statement = statement.where(Candidate.role == role)
    if month:
        statement = statement.where(func.strftime("%m", Candidate.joining_date) == f"{month:02d}")
    if engagement:
        mapping = {"on track": RiskLevel.low, "needs attention": RiskLevel.medium, "at risk": RiskLevel.high}
        statement = statement.where(Candidate.effective_risk == mapping[engagement])
    total = await session.scalar(select(func.count()).select_from(statement.subquery())) or 0
    if sort == "risk":
        statement = statement.order_by(Candidate.effective_risk.desc(), Candidate.joining_date.asc())
    else:
        statement = statement.order_by(Candidate.joining_date.asc())
    records = (await session.scalars(statement.offset((page - 1) * page_size).limit(page_size))).all()
    return CandidatePageResponse(items=[await dashboard_candidate(session, candidate) for candidate in records], total=total, page=page, page_size=page_size, total_pages=max(1, (total + page_size - 1) // page_size))


@app.put("/api/v1/candidates/{external_id}/bootstrap", response_model=CandidatePersistenceResponse, status_code=status.HTTP_200_OK)
async def bootstrap_candidate(external_id: str, payload: CandidateBootstrapRequest, session: AsyncSession = Depends(get_session)) -> CandidatePersistenceResponse:
    if external_id != payload.candidate_id:
        raise HTTPException(status_code=422, detail={"code": "candidate_id_mismatch", "message": "Candidate id must match the URL."})
    candidate = await session.scalar(select(Candidate).where(Candidate.external_id == external_id))
    if not candidate:
        candidate = Candidate(external_id=external_id, name=payload.name, email=payload.email, role=payload.role, department=payload.department, location=payload.location, recruiter=payload.recruiter, offer_date=parse_display_date(payload.offer_date), joining_date=parse_display_date(payload.joining_date), ai_risk=RiskLevel(payload.ai_risk.value), effective_risk=RiskLevel(payload.risk.value))
        session.add(candidate)
        await session.flush()
        session.add_all([CandidateJourneyStep(candidate_id=candidate.id, step_key=step.key, label=step.label, status=JourneyStatus(step.status)) for step in payload.steps])
        session.add_all([Interaction(candidate_id=candidate.id, channel=item.channel, direction=InteractionDirection(item.direction), body=item.text, tone=item.tone, source="seed") for item in payload.interactions])
        await session.commit()
    elif not candidate.joining_date:
        candidate.offer_date = parse_display_date(payload.offer_date)
        candidate.joining_date = parse_display_date(payload.joining_date)
        await session.commit()
    return await candidate_snapshot(session, candidate)


@app.get("/api/v1/candidates/{external_id}/state", response_model=CandidatePersistenceResponse)
async def get_candidate_state(external_id: str, session: AsyncSession = Depends(get_session)) -> CandidatePersistenceResponse:
    return await candidate_snapshot(session, await get_candidate_or_404(session, external_id))


@app.get("/api/v1/candidates/{external_id}", response_model=DashboardCandidateResponse)
async def get_candidate_detail(external_id: str, session: AsyncSession = Depends(get_session)) -> DashboardCandidateResponse:
    return await dashboard_candidate(session, await get_candidate_or_404(session, external_id))


@app.post("/api/v1/candidates/{external_id}/interactions", response_model=PersistedInteractionResponse, status_code=status.HTTP_201_CREATED)
async def add_manual_interaction(external_id: str, payload: ManualInteractionRequest, session: AsyncSession = Depends(get_session)) -> PersistedInteractionResponse:
    candidate = await get_candidate_or_404(session, external_id)
    interaction = Interaction(candidate_id=candidate.id, channel=payload.channel, direction=InteractionDirection.outbound, body=payload.text, tone=payload.tone, source="manual")
    session.add(interaction)
    await session.commit()
    await session.refresh(interaction)
    return PersistedInteractionResponse(id=interaction.id, channel=interaction.channel, direction=interaction.direction.value, timestamp=interaction.occurred_at.isoformat(), text=interaction.body, tone=interaction.tone or "Manual log")


@app.patch("/api/v1/candidates/{external_id}/journey-steps/{step_key}", response_model=CandidatePersistenceResponse)
async def update_journey_step(external_id: str, step_key: str, payload: JourneyStatusRequest, session: AsyncSession = Depends(get_session)) -> CandidatePersistenceResponse:
    candidate = await get_candidate_or_404(session, external_id)
    step = await session.scalar(select(CandidateJourneyStep).where(CandidateJourneyStep.candidate_id == candidate.id, CandidateJourneyStep.step_key == step_key))
    if not step:
        raise HTTPException(status_code=404, detail={"code": "journey_step_not_found", "message": "Journey step was not found."})
    step.status = JourneyStatus(payload.status)
    candidate.row_version += 1
    await session.commit()
    return await candidate_snapshot(session, candidate)


@app.post("/api/v1/candidates/{external_id}/risk-overrides", response_model=CandidatePersistenceResponse)
async def override_risk(external_id: str, payload: RiskOverrideRequest, session: AsyncSession = Depends(get_session)) -> CandidatePersistenceResponse:
    candidate = await get_candidate_or_404(session, external_id)
    previous = candidate.effective_risk
    candidate.effective_risk = RiskLevel(payload.risk.value)
    candidate.override_reason = payload.reason
    candidate.row_version += 1
    session.add(RiskOverride(candidate_id=candidate.id, previous_risk=previous, new_risk=RiskLevel(payload.risk.value), reason=payload.reason, overridden_by=payload.overridden_by))
    await session.commit()
    return await candidate_snapshot(session, candidate)


@app.post("/api/v1/ai/messages/generate", response_model=GenerateMessageResponse)
async def generate_message(request: Request, payload: GenerateMessageRequest) -> GenerateMessageResponse:
    service = GroqHRService(request.app.state.settings)
    draft = await service.generate_message(payload)
    return GenerateMessageResponse(draft=draft, model=request.app.state.settings.groq_main_model, request_id=request.state.request_id)


@app.post("/api/v1/ai/candidates/analyze", response_model=AnalysisResponse)
async def analyze_candidate(request: Request, payload: CandidateContext, session: AsyncSession = Depends(get_session)) -> AnalysisResponse:
    service = GroqHRService(request.app.state.settings)
    analysis = await service.analyze_candidate(payload)
    candidate = await session.scalar(select(Candidate).where(Candidate.external_id == payload.candidate_id))
    if candidate:
        candidate.ai_risk = RiskLevel(analysis.risk.value)
        if not candidate.override_reason:
            candidate.effective_risk = RiskLevel(analysis.risk.value)
        session.add(AIAnalysis(candidate_id=candidate.id, analysis_type="risk", model=request.app.state.settings.groq_main_model, prompt_version="v1", input_fingerprint=sha256(payload.model_dump_json().encode()).hexdigest(), output=analysis.model_dump(mode="json"), guard_score=None, validation_status="validated"))
        await session.commit()
    return AnalysisResponse(**analysis.model_dump(), model=request.app.state.settings.groq_main_model, request_id=request.state.request_id)
