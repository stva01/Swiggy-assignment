"""Idempotent local demo cohort for Post-Offer HQ.

Run from backend/: python -m app.seed
"""
import asyncio
from datetime import date, datetime, timedelta

from sqlalchemy import select

from app.db import SessionLocal, initialize_database
from app.models import Candidate, CandidateJourneyStep, CandidateStatus, Interaction, InteractionDirection, JourneyStatus, RiskLevel

FIRST_NAMES = ["Aarav", "Diya", "Kabir", "Sana", "Ishaan", "Meera", "Rohan", "Ananya", "Vihaan", "Tara", "Arjun", "Naina"]
LAST_NAMES = ["Mehta", "Sharma", "Menon", "Kapoor", "Reddy"]
ROLES = [("Senior Product Designer", "Design"), ("Software Engineer", "Engineering"), ("Growth Manager", "Growth"), ("Data Analyst", "Analytics"), ("Operations Lead", "Operations"), ("Product Manager", "Product")]
RECRUITERS = ["Nisha Rao", "Kabir Menon", "Sana Kapoor", "Riya Shah", "Dev Malhotra", "Aditi Iyer"]
LOCATIONS = ["Bengaluru", "Mumbai", "Gurugram"]
STEP_TEMPLATE = [("offer_accepted", "Offer accepted"), ("welcome", "Welcome note"), ("documentation", "Documentation"), ("manager_intro", "Manager intro"), ("pre_joining_checkin", "Pre-joining check-in"), ("joining", "Joining day")]


def risk_for(index: int) -> RiskLevel:
    if index % 10 == 0:
        return RiskLevel.high
    if index % 4 == 0:
        return RiskLevel.medium
    return RiskLevel.low


async def seed() -> int:
    await initialize_database()
    created = 0
    today = date.today()
    async with SessionLocal() as session:
        for index in range(60):
            external_id = f"seed-{index + 1:03d}"
            if await session.scalar(select(Candidate.id).where(Candidate.external_id == external_id)):
                continue
            first = FIRST_NAMES[index % len(FIRST_NAMES)]
            last = LAST_NAMES[(index // len(FIRST_NAMES)) % len(LAST_NAMES)]
            role, department = ROLES[index % len(ROLES)]
            risk = risk_for(index)
            candidate_status = CandidateStatus.joined if index in {45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57} else CandidateStatus.dropped if index in {58, 59} else CandidateStatus.active
            joining_date = today + timedelta(days=(index % 42) - 10)
            candidate = Candidate(external_id=external_id, name=f"{first} {last}", email=f"{first.lower()}.{last.lower()}{index}@example.com", role=role, department=department, location=LOCATIONS[index % len(LOCATIONS)], recruiter=RECRUITERS[index % len(RECRUITERS)], offer_date=today - timedelta(days=20 + (index % 40)), joining_date=joining_date, status=candidate_status, ai_risk=risk, effective_risk=risk)
            session.add(candidate)
            await session.flush()
            completed = 3 if candidate_status == CandidateStatus.active else 6
            steps = []
            for step_index, (key, label) in enumerate(STEP_TEMPLATE):
                step_status = JourneyStatus.completed if step_index < completed else JourneyStatus.overdue if risk == RiskLevel.high and step_index == completed else JourneyStatus.pending
                steps.append(CandidateJourneyStep(candidate_id=candidate.id, step_key=key, label=label, status=step_status))
            session.add_all(steps)
            days_ago = 7 if risk == RiskLevel.high else 4 if risk == RiskLevel.medium else 1
            conversation = "I am still figuring out relocation and accommodation." if risk == RiskLevel.high else "Thank you for the update. I am looking forward to joining."
            session.add_all([
                Interaction(candidate_id=candidate.id, channel="WhatsApp", direction=InteractionDirection.outbound, body="Checking in before your joining day. Let us know what we can unblock.", tone="Friendly check-in", source="seed", occurred_at=datetime.utcnow() - timedelta(days=days_ago + 1)),
                Interaction(candidate_id=candidate.id, channel="Email", direction=InteractionDirection.inbound, body=conversation, tone="Candidate reply", source="seed", occurred_at=datetime.utcnow() - timedelta(days=days_ago)),
            ])
            created += 1
        await session.commit()
    return created


if __name__ == "__main__":
    print(f"Seeded {asyncio.run(seed())} new demo candidates.")
