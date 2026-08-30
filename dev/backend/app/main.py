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
from app.models import AIAnalysis, Candidate, CandidateJourneyStep, Interaction, InteractionDirection, JourneyStatus, Notification, RiskLevel, RiskOverride, Task, TaskStatus
from app.schemas import (
    AnalysisResponse,
    CandidateBootstrapRequest,
    CandidateContext,
    CandidatePageResponse,
    CandidatePersistenceResponse,
    DashboardCandidateResponse,
    DashboardJourneyStep,
    ErrorResponse,
    EvaluateRulesResponse,
    GenerateMessageRequest,
    GenerateMessageResponse,
    HealthResponse,
    JourneyStatusRequest,
    ManualInteractionRequest,
    NotificationResponse,
    PersistedInteractionResponse,
    RiskOverrideRequest,
    SendMessageRequest,
    SendMessageResponse,
    TaskResponse,
)
from app.services.automation_service import evaluate_engagement_rules
from app.services.communication_service import CommunicationService
from app.services.groq_service import AIServiceError, GroqHRService


import logging
import time
from logging.handlers import RotatingFileHandler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        RotatingFileHandler("post_offer_hq.log", maxBytes=10_000_000, backupCount=5, encoding="utf-8"),
    ],
)
logger = logging.getLogger("post_offer_hq")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Post-Offer HQ backend...")
    app.state.settings = get_settings()
    await initialize_database()
    logger.info("Database initialized successfully.")
    try:
        yield
    finally:
        logger.info("Shutting down Post-Offer HQ backend...")
        await engine.dispose()


app = FastAPI(title="Post-Offer HQ API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "OPTIONS", "DELETE"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_id_and_logging_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid4()))
    request.state.request_id = request_id
    start_time = time.perf_counter()
    
    try:
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.info(
            f"[{request_id[:8]}] {request.method} {request.url.path} -> {response.status_code} ({duration_ms:.1f}ms)"
        )
        response.headers["X-Request-ID"] = request_id
        return response
    except Exception as exc:
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.exception(f"[{request_id[:8]}] Uncaught exception during {request.method} {request.url.path} ({duration_ms:.1f}ms): {exc}")
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(code="internal_error", message=f"Server error: {str(exc)}", request_id=request_id).model_dump(by_alias=True),
        )


@app.exception_handler(AIServiceError)
async def ai_service_error_handler(request: Request, error: AIServiceError):
    logger.warning(f"AIServiceError [{error.code}]: {error.message}")
    return JSONResponse(
        status_code=error.status_code,
        content=ErrorResponse(code=error.code, message=error.message, request_id=request.state.request_id).model_dump(by_alias=True),
    )


@app.exception_handler(HTTPException)
async def http_error_handler(request: Request, error: HTTPException):
    detail = error.detail if isinstance(error.detail, dict) else {"code": "request_rejected", "message": str(error.detail)}
    logger.warning(f"HTTPException [{error.status_code}] on {request.method} {request.url.path}: {detail}")
    return JSONResponse(
        status_code=error.status_code,
        content=ErrorResponse(code=detail.get("code", "error"), message=detail.get("message", "Error"), request_id=request.state.request_id).model_dump(by_alias=True),
    )


@app.exception_handler(RequestValidationError)
async def request_validation_error_handler(request: Request, error: RequestValidationError):
    logger.warning(f"Validation error on {request.method} {request.url.path}: {error.errors()}")
    return JSONResponse(
        status_code=422,
        content=ErrorResponse(code="invalid_request", message=f"Validation failed: {error.errors()[:2]}", request_id=request.state.request_id).model_dump(by_alias=True),
    )


@app.get("/api/v1/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    return HealthResponse(status="ok", groq_configured=bool(request.app.state.settings.groq_api_key))


async def get_candidate_or_404(session: AsyncSession, external_id: str) -> Candidate:
    candidate = await session.scalar(select(Candidate).where(Candidate.external_id == external_id))
    if not candidate:
        raise HTTPException(status_code=404, detail={"code": "candidate_not_found", "message": "Candidate was not found."})
    return candidate


STEP_ORDER = {
    "offer_accepted": 0,
    "welcome": 1,
    "documentation": 2,
    "manager_intro": 3,
    "pre_joining_checkin": 4,
    "joining": 5,
}


async def candidate_snapshot(session: AsyncSession, candidate: Candidate) -> CandidatePersistenceResponse:
    raw_steps = (await session.scalars(select(CandidateJourneyStep).where(CandidateJourneyStep.candidate_id == candidate.id))).all()
    steps = sorted(raw_steps, key=lambda step: STEP_ORDER.get(step.step_key, 99))
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
    raw_steps = (await session.scalars(select(CandidateJourneyStep).where(CandidateJourneyStep.candidate_id == candidate.id))).all()
    steps = sorted(raw_steps, key=lambda step: STEP_ORDER.get(step.step_key, 99))
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
        candidate = Candidate(
            external_id=external_id,
            name=payload.name,
            email=payload.email,
            role=payload.role,
            department=payload.department,
            location=payload.location,
            recruiter=payload.recruiter,
            offer_date=parse_display_date(payload.offer_date),
            joining_date=parse_display_date(payload.joining_date),
            ai_risk=RiskLevel(payload.ai_risk.value),
            effective_risk=RiskLevel(payload.risk.value),
        )
        session.add(candidate)
        await session.flush()
        session.add_all([
            CandidateJourneyStep(candidate_id=candidate.id, step_key=step.key, label=step.label, status=JourneyStatus(step.status))
            for step in payload.steps
        ])
        session.add_all([
            Interaction(
                candidate_id=candidate.id,
                channel=item.channel,
                direction=InteractionDirection.inbound if item.direction in ("in", "inbound") else InteractionDirection.outbound,
                body=item.text,
                tone=item.tone,
                source="seed",
            )
            for item in payload.interactions
        ])
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


def format_task(task: Task, candidate: Candidate | None = None) -> TaskResponse:
    cand_name = candidate.name if candidate else "Candidate"
    cand_id = (candidate.external_id or candidate.id) if candidate else task.candidate_id
    cand_init = initials(cand_name)
    
    today = date.today()
    if task.due_at:
        due_date = task.due_at.date()
        diff = (due_date - today).days
        if diff < 0:
            due_group = "Overdue"
            due_label = f"{abs(diff)} day{'s' if abs(diff) > 1 else ''} overdue"
            accent = "tomato"
        elif diff == 0:
            due_group = "Today"
            due_label = "Due today"
            accent = "orange"
        else:
            due_group = "Upcoming"
            due_label = f"In {diff} days" if diff > 1 else "Tomorrow"
            accent = "sage"
    else:
        due_group = "Today"
        due_label = "Due today"
        accent = "orange"

    if task.source == "automation":
        accent = "tomato"

    return TaskResponse(
        id=task.id,
        candidate_id=cand_id,
        candidate=cand_name,
        candidate_initials=cand_init,
        role=candidate.role if candidate else None,
        location=candidate.location if candidate else None,
        due_label=due_label,
        due_group=due_group,
        action=task.title,
        source=task.source,
        accent=accent,
        status=task.status.value,
        assigned_to=task.assigned_to,
        suggested_message=task.suggested_message,
        rule_name=task.rule_name,
        created_at=task.created_at.isoformat(),
    )


@app.post("/api/v1/automations/run-engagement-rules", response_model=EvaluateRulesResponse)
async def trigger_engagement_rules(request: Request, session: AsyncSession = Depends(get_session)) -> EvaluateRulesResponse:
    """Runs automated engagement rules across active candidates and creates follow-ups."""
    result = await evaluate_engagement_rules(session, request.app.state.settings)
    return EvaluateRulesResponse(
        rule_name=result["rule_name"],
        evaluated_candidates_count=result["evaluated_candidates_count"],
        flagged_count=result["flagged_count"],
        tasks_created_count=result["tasks_created_count"],
        notifications_created_count=result["notifications_created_count"],
        flagged_candidates=result["flagged_candidates"],
        summary=result["summary"],
    )


@app.get("/api/v1/tasks", response_model=list[TaskResponse])
async def list_tasks(status: str = "open", session: AsyncSession = Depends(get_session)) -> list[TaskResponse]:
    statement = select(Task).where(Task.status == TaskStatus(status)).order_by(Task.due_at.asc().nulls_last(), Task.created_at.desc())
    tasks = (await session.scalars(statement)).all()
    
    # If no tasks exist yet in the database, seed standard mock tasks
    if not tasks and status == "open":
        candidates = (await session.scalars(select(Candidate).where(Candidate.status == "active").limit(6))).all()
        if candidates:
            sample_titles = [
                ("Confirm relocation support", "AI", date.today() - datetime.timedelta(days=2)),
                ("Resolve laptop preference", "system", date.today() - datetime.timedelta(days=1)),
                ("Nudge for signed documentation", "human", date.today()),
                ("Send manager introduction", "system", date.today()),
                ("Share Bengaluru office guide", "AI", date.today() + datetime.timedelta(days=1)),
                ("Send first-week calendar preview", "AI", date.today() + datetime.timedelta(days=3)),
            ]
            for idx, cand in enumerate(candidates):
                title, src, due_d = sample_titles[idx % len(sample_titles)]
                task_item = Task(
                    candidate_id=cand.id,
                    title=title,
                    source=src,
                    status=TaskStatus.open,
                    assigned_to=cand.recruiter,
                    due_at=datetime.datetime.combine(due_d, datetime.time(9, 0)),
                )
                session.add(task_item)
            await session.commit()
            tasks = (await session.scalars(statement)).all()

    results: list[TaskResponse] = []
    for task in tasks:
        candidate = await session.scalar(select(Candidate).where(Candidate.id == task.candidate_id))
        results.append(format_task(task, candidate))
    return results


@app.post("/api/v1/tasks/{task_id}/complete", response_model=TaskResponse)
async def complete_task(task_id: str, session: AsyncSession = Depends(get_session)) -> TaskResponse:
    task = await session.scalar(select(Task).where(Task.id == task_id))
    if not task:
        raise HTTPException(status_code=404, detail={"code": "task_not_found", "message": "Task was not found."})
    task.status = TaskStatus.completed
    task.completed_at = datetime.utcnow()
    await session.commit()
    candidate = await session.scalar(select(Candidate).where(Candidate.id == task.candidate_id))
    return format_task(task, candidate)


@app.post("/api/v1/tasks/{task_id}/dismiss", response_model=TaskResponse)
async def dismiss_task(task_id: str, session: AsyncSession = Depends(get_session)) -> TaskResponse:
    task = await session.scalar(select(Task).where(Task.id == task_id))
    if not task:
        raise HTTPException(status_code=404, detail={"code": "task_not_found", "message": "Task was not found."})
    task.status = TaskStatus.dismissed
    await session.commit()
    candidate = await session.scalar(select(Candidate).where(Candidate.id == task.candidate_id))
    return format_task(task, candidate)


@app.post("/api/v1/tasks/{task_id}/assign", response_model=TaskResponse)
async def assign_task(task_id: str, assignee: str = "Nisha Rao", session: AsyncSession = Depends(get_session)) -> TaskResponse:
    task = await session.scalar(select(Task).where(Task.id == task_id))
    if not task:
        raise HTTPException(status_code=404, detail={"code": "task_not_found", "message": "Task was not found."})
    task.assigned_to = assignee
    task.source = "human"
    await session.commit()
    candidate = await session.scalar(select(Candidate).where(Candidate.id == task.candidate_id))
    return format_task(task, candidate)


@app.get("/api/v1/notifications", response_model=list[NotificationResponse])
async def list_notifications(session: AsyncSession = Depends(get_session)) -> list[NotificationResponse]:
    notifications = (await session.scalars(select(Notification).order_by(Notification.created_at.desc()).limit(25))).all()
    return [
        NotificationResponse(
            id=n.id,
            kind=n.kind,
            title=n.title,
            body=n.body,
            created_at=n.created_at.strftime("%d %b, %H:%M") if (datetime.utcnow() - n.created_at).days > 0 else "Today",
            read=n.read_at is not None,
            recipient=n.recipient,
            entity_type=n.entity_type,
            entity_id=n.entity_id,
        )
        for n in notifications
    ]


@app.post("/api/v1/notifications/mark-read")
async def mark_notifications_read(session: AsyncSession = Depends(get_session)):
    notifications = (await session.scalars(select(Notification).where(Notification.read_at.is_(None)))).all()
    for n in notifications:
        n.read_at = datetime.utcnow()
    await session.commit()
    return {"status": "ok", "marked_count": len(notifications)}


@app.post("/api/v1/candidates/{external_id}/send-message", response_model=SendMessageResponse)
async def send_candidate_message(
    external_id: str,
    payload: SendMessageRequest,
    session: AsyncSession = Depends(get_session),
) -> SendMessageResponse:
    try:
        res = await CommunicationService.dispatch_message(
            session=session,
            candidate_id=external_id,
            channel=payload.channel,
            message_text=payload.message,
            subject=payload.subject,
            recipient_override=payload.recipient_override,
            simulated=payload.simulated,
        )
        return SendMessageResponse(
            success=res["success"],
            channel=res["channel"],
            status=res["status"],
            details=res["details"],
            deep_link=res["deep_link"],
            interaction_id=res["interaction_id"],
            timestamp=res["timestamp"],
            candidate_id=res["candidate_id"],
            candidate_name=res["candidate_name"],
            recipient=res["recipient"],
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail={"code": "candidate_not_found", "message": str(e)})


