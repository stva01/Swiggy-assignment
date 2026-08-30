from datetime import date, datetime, timedelta
from typing import Any
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models import (
    Candidate,
    CandidateJourneyStep,
    CandidateStatus,
    Interaction,
    InteractionDirection,
    Notification,
    RiskLevel,
    RiskOverride,
    Task,
    TaskStatus,
)
from app.schemas import CandidateContext, GenerateMessageRequest, Channel, Tone
from app.services.groq_service import GroqHRService


async def get_candidate_last_interaction(session: AsyncSession, candidate_id: str) -> datetime | None:
    return await session.scalar(
        select(Interaction.occurred_at)
        .where(Interaction.candidate_id == candidate_id)
        .order_by(Interaction.occurred_at.desc())
        .limit(1)
    )


async def generate_personalized_followup_message(
    candidate: Candidate,
    days_to_join: int,
    last_contact_days: int,
    settings: Settings,
) -> str:
    first_name = candidate.name.split()[0] if candidate.name else "there"
    joining_day_str = candidate.joining_date.strftime("%d %b") if candidate.joining_date else "soon"
    role_str = candidate.role or "your new role"
    recruiter_str = candidate.recruiter or "our HR team"
    
    # Try using Groq if configured
    if settings.groq_api_key:
        try:
            service = GroqHRService(settings)
            payload = GenerateMessageRequest(
                candidateId=candidate.external_id or candidate.id,
                candidateName=candidate.name,
                role=candidate.role,
                location=candidate.location,
                joiningDate=candidate.joining_date.strftime("%d %b %Y") if candidate.joining_date else "Upcoming",
                daysToJoin=days_to_join,
                risk=RiskLevel(candidate.effective_risk.value),
                nextAction=f"Check in before {joining_day_str} start after {last_contact_days} days of no interaction",
                channel=Channel.whatsapp,
                tone=Tone.friendly,
                interactions=[]
            )
            draft = await service.generate_message(payload)
            if draft and len(draft.strip()) > 10:
                return draft
        except Exception:
            pass  # Fall back to high-quality template

    # High quality fallback message
    return (
        f"Hi {first_name} — with your joining date just {days_to_join} days away on {joining_day_str}, "
        f"I wanted to personally reach out and see how your preparations for joining as {role_str} are going. "
        f"Is there anything we can clarify or assist with regarding documentation, IT setup, or your day-one plan? "
        f"Looking forward to having you on the team! — {recruiter_str}"
    )


async def evaluate_engagement_rules(session: AsyncSession, settings: Settings) -> dict[str, Any]:
    """
    Executes automated engagement rules:
    Rule 1: Final-Stretch Silence Escalation
    - If a candidate joins in <= 7 days AND has had no interaction in the last >= 5 days:
      1. Flag the candidate (escalate effective risk to high).
      2. Generate a personalized check-in message.
      3. Create an urgent follow-up task for the recruiter.
      4. Create an in-app notification for the recruiter.
    """
    today = date.today()
    active_candidates = (
        await session.scalars(
            select(Candidate).where(Candidate.status == CandidateStatus.active)
        )
    ).all()

    evaluated_count = len(active_candidates)
    flagged_candidates: list[dict[str, Any]] = []
    tasks_created_count = 0
    notifications_created_count = 0

    for candidate in active_candidates:
        if not candidate.joining_date:
            continue

        days_to_join = (candidate.joining_date - today).days
        # Check rule trigger: joins in 7 days (0 to 7 days away)
        if not (0 <= days_to_join <= 7):
            continue

        last_interaction_time = await get_candidate_last_interaction(session, candidate.id)
        if last_interaction_time:
            last_contact_days = max(0, (today - last_interaction_time.date()).days)
        else:
            last_contact_days = 999  # No interaction ever recorded

        # Trigger condition: no interaction in last 5 days
        if last_contact_days >= 5:
            # 1. Check if candidate already has an active open automated task for this rule to prevent spamming
            existing_open_task = await session.scalar(
                select(Task).where(
                    and_(
                        Task.candidate_id == candidate.id,
                        Task.status == TaskStatus.open,
                        Task.source == "automation"
                    )
                )
            )

            # Generate personalized message draft
            draft_message = await generate_personalized_followup_message(
                candidate=candidate,
                days_to_join=days_to_join,
                last_contact_days=last_contact_days,
                settings=settings,
            )

            previous_risk = candidate.effective_risk
            # 2. Flag candidate & elevate risk to high if not already high
            flag_applied = False
            if candidate.effective_risk != RiskLevel.high:
                candidate.effective_risk = RiskLevel.high
                candidate.override_reason = (
                    f"Automated Rule Flag: Joining in {days_to_join} days with {last_contact_days} days of silence."
                )
                candidate.row_version += 1
                session.add(
                    RiskOverride(
                        candidate_id=candidate.id,
                        previous_risk=previous_risk,
                        new_risk=RiskLevel.high,
                        reason=f"Automated escalation rule: joining in {days_to_join} days and no interaction in {last_contact_days} days.",
                        overridden_by="Automation Engine",
                    )
                )
                flag_applied = True

            created_task = None
            if not existing_open_task:
                # 3. Create follow-up action for HR
                task_title = (
                    f"Urgent Outreach: {candidate.name} joins in {days_to_join}d ({last_contact_days}d silent)"
                )
                created_task = Task(
                    candidate_id=candidate.id,
                    title=task_title,
                    source="automation",
                    status=TaskStatus.open,
                    assigned_to=candidate.recruiter or "Recruiter",
                    due_at=datetime.utcnow(),
                    suggested_message=draft_message,
                    rule_name="Final-Stretch Silence Escalation",
                )
                session.add(created_task)
                tasks_created_count += 1

                # 4. Create in-app HR notification
                session.add(
                    Notification(
                        recipient=candidate.recruiter or "All Recruiters",
                        kind="risk",
                        title=f"Automated Engagement Alert: {candidate.name}",
                        body=f"{candidate.name} joins in {days_to_join} days and hasn't been contacted in {last_contact_days} days. Personalized outreach draft is ready.",
                        entity_type="candidate",
                        entity_id=candidate.external_id or candidate.id,
                    )
                )
                notifications_created_count += 1

            flagged_candidates.append({
                "candidate_id": candidate.external_id or candidate.id,
                "candidate_name": candidate.name,
                "role": candidate.role,
                "recruiter": candidate.recruiter,
                "days_to_join": days_to_join,
                "last_contact_days": last_contact_days,
                "previous_risk": previous_risk.value,
                "current_risk": candidate.effective_risk.value,
                "flag_applied": flag_applied,
                "draft_message": draft_message,
                "task_created": bool(created_task),
                "existing_task": bool(existing_open_task),
            })

    if flagged_candidates or tasks_created_count > 0:
        await session.commit()

    return {
        "rule_name": "Final-Stretch Silence Escalation (Joining <= 7d & Silent >= 5d)",
        "evaluated_candidates_count": evaluated_count,
        "flagged_count": len(flagged_candidates),
        "tasks_created_count": tasks_created_count,
        "notifications_created_count": notifications_created_count,
        "flagged_candidates": flagged_candidates,
        "summary": (
            f"Evaluated {evaluated_count} candidates. Flagged {len(flagged_candidates)} candidates meeting the rule criteria, "
            f"generated {len(flagged_candidates)} personalized check-in drafts, and created {tasks_created_count} new HR follow-up tasks."
        ),
    }
