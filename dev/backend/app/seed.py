"""Idempotent local demo cohort for Post-Offer HQ with realistic timeline data.

Run from backend/: python -m app.seed
"""
import asyncio
from datetime import date, datetime, timedelta

from sqlalchemy import delete, select

from app.db import SessionLocal, initialize_database
from app.models import (
    Candidate,
    CandidateJourneyStep,
    CandidateStatus,
    Interaction,
    InteractionDirection,
    JourneyStatus,
    RiskLevel,
    Task,
    TaskStatus,
)

CANDIDATE_DATA = [
    # Final Stretch Candidates (1 - 7 Days to Join)
    {"name": "Aarav Mehta", "role": "Senior Product Designer", "dept": "Design", "loc": "Bengaluru", "recruiter": "Nisha Rao", "days_to_join": 3, "risk": RiskLevel.high, "silence": 6, "completed_steps": 4, "conv": "I haven't received confirmation on the transit accommodation near the Bellandur office yet."},
    {"name": "Diya Sharma", "role": "Senior Frontend Engineer", "dept": "Engineering", "loc": "Bengaluru", "recruiter": "Nisha Rao", "days_to_join": 4, "risk": RiskLevel.medium, "silence": 4, "completed_steps": 4, "conv": "Background verification documents uploaded. Awaiting final clearance confirmation."},
    {"name": "Kabir Menon", "role": "Product Manager II", "dept": "Product", "loc": "Gurugram", "recruiter": "Kabir Menon", "days_to_join": 5, "risk": RiskLevel.low, "silence": 1, "completed_steps": 5, "conv": "Laptop preference submitted! Looking forward to meeting the team on Monday."},
    {"name": "Sana Kapoor", "role": "Data Scientist", "dept": "Analytics", "loc": "Bengaluru", "recruiter": "Sana Kapoor", "days_to_join": 6, "risk": RiskLevel.high, "silence": 5, "completed_steps": 3, "conv": "Still negotiating notice period release with my current employer. Might need a 3-day extension."},
    {"name": "Ishaan Reddy", "role": "Growth Operations Lead", "dept": "Operations", "loc": "Mumbai", "recruiter": "Riya Shah", "days_to_join": 7, "risk": RiskLevel.low, "silence": 2, "completed_steps": 4, "conv": "Relocation flight booked. Excited to join the Mumbai hub next week."},
    {"name": "Meera Joshi", "role": "Backend Engineer (Go)", "dept": "Engineering", "loc": "Bengaluru", "recruiter": "Aditi Iyer", "days_to_join": 7, "risk": RiskLevel.medium, "silence": 3, "completed_steps": 4, "conv": "Signed the offer letter. Reviewing the tech stack documentation provided by the hiring manager."},

    # Mid Runway Candidates (8 - 15 Days to Join)
    {"name": "Rohan Verma", "role": "Staff Software Engineer", "dept": "Engineering", "loc": "Bengaluru", "recruiter": "Nisha Rao", "days_to_join": 9, "risk": RiskLevel.low, "silence": 1, "completed_steps": 3, "conv": "HR induction session schedule received. Everything looks great."},
    {"name": "Ananya Nair", "role": "Product Marketing Manager", "dept": "Growth", "loc": "Mumbai", "recruiter": "Dev Malhotra", "days_to_join": 10, "risk": RiskLevel.medium, "silence": 4, "completed_steps": 3, "conv": "Need clarification on the hybrid working policy for the Mumbai office."},
    {"name": "Vihaan Patel", "role": "Engineering Manager", "dept": "Engineering", "loc": "Bengaluru", "recruiter": "Kabir Menon", "days_to_join": 11, "risk": RiskLevel.low, "silence": 2, "completed_steps": 3, "conv": "Had a great sync with the Director of Engineering yesterday. Ready for Day 1."},
    {"name": "Tara Iyer", "role": "UI/UX Designer", "dept": "Design", "loc": "Bengaluru", "recruiter": "Sana Kapoor", "days_to_join": 12, "risk": RiskLevel.high, "silence": 7, "completed_steps": 2, "conv": "No response received to my email regarding insurance enrollment for dependents."},
    {"name": "Arjun Rao", "role": "Data Platform Engineer", "dept": "Analytics", "loc": "Hyderabad", "recruiter": "Aditi Iyer", "days_to_join": 14, "risk": RiskLevel.low, "silence": 1, "completed_steps": 3, "conv": "Documentation completed. Looking forward to orientation."},
    {"name": "Naina Singhania", "role": "Category Lead", "dept": "Operations", "loc": "Gurugram", "recruiter": "Riya Shah", "days_to_join": 15, "risk": RiskLevel.low, "silence": 2, "completed_steps": 3, "conv": "Introductory call with the team lead was inspiring. All clear for the 15th."},

    # Long Runway Candidates (16 - 45 Days to Join)
    {"name": "Aditya Kulkarni", "role": "Senior DevOps Engineer", "dept": "Engineering", "loc": "Bengaluru", "recruiter": "Nisha Rao", "days_to_join": 18, "risk": RiskLevel.medium, "silence": 3, "completed_steps": 2, "conv": "Handover in progress at current company."},
    {"name": "Pooja Hegde", "role": "Financial Analyst", "dept": "Finance", "loc": "Bengaluru", "recruiter": "Dev Malhotra", "days_to_join": 20, "risk": RiskLevel.low, "silence": 2, "completed_steps": 2, "conv": "Submitted tax declaration forms and bank details."},
    {"name": "Karthik Sundaram", "role": "Principal Architect", "dept": "Engineering", "loc": "Bengaluru", "recruiter": "Kabir Menon", "days_to_join": 22, "risk": RiskLevel.low, "silence": 1, "completed_steps": 2, "conv": "Reviewing system architecture overview."},
    {"name": "Rhea Chakraborty", "role": "Brand Strategist", "dept": "Growth", "loc": "Mumbai", "recruiter": "Riya Shah", "days_to_join": 25, "risk": RiskLevel.high, "silence": 8, "completed_steps": 1, "conv": "Counter-offer received from current employer, currently evaluating options."},
    {"name": "Siddharth Bose", "role": "iOS Developer", "dept": "Engineering", "loc": "Gurugram", "recruiter": "Sana Kapoor", "days_to_join": 28, "risk": RiskLevel.low, "silence": 2, "completed_steps": 2, "conv": "Device requisitions completed."},
    {"name": "Tanvi Deshmukh", "role": "HR Business Partner", "dept": "HR", "loc": "Mumbai", "recruiter": "Nisha Rao", "days_to_join": 30, "risk": RiskLevel.low, "silence": 1, "completed_steps": 2, "conv": "Offer accepted. Serving 30-day notice period."},
    {"name": "Varun Nambiar", "role": "Security Engineer", "dept": "Engineering", "loc": "Bengaluru", "recruiter": "Aditi Iyer", "days_to_join": 34, "risk": RiskLevel.medium, "silence": 4, "completed_steps": 1, "conv": "Awaiting background check portal credentials."},
    {"name": "Kavya Murthy", "role": "Content Strategist", "dept": "Growth", "loc": "Bengaluru", "recruiter": "Dev Malhotra", "days_to_join": 38, "risk": RiskLevel.low, "silence": 2, "completed_steps": 1, "conv": "Signed offer and shared emergency contact details."},
    {"name": "Nikhil Agarwal", "role": "Supply Chain Specialist", "dept": "Operations", "loc": "Delhi NCR", "recruiter": "Riya Shah", "days_to_join": 42, "risk": RiskLevel.low, "silence": 2, "completed_steps": 1, "conv": "Planning relocation from Pune to Gurugram."},
    {"name": "Ananya Sen", "role": "Full Stack Engineer", "dept": "Engineering", "loc": "Bengaluru", "recruiter": "Kabir Menon", "days_to_join": 45, "risk": RiskLevel.low, "silence": 1, "completed_steps": 1, "conv": "Accepted offer. Serving notice period gracefully."},
]

STEP_TEMPLATE = [
    ("offer_accepted", "Offer accepted"),
    ("welcome", "Welcome note"),
    ("documentation", "Documentation"),
    ("manager_intro", "Manager intro"),
    ("pre_joining_checkin", "Pre-joining check-in"),
    ("joining", "Joining day"),
]


async def seed(force_refresh: bool = True) -> int:
    await initialize_database()
    today = date.today()
    created = 0

    async with SessionLocal() as session:
        if force_refresh:
            # Cleanly wipe existing records to ensure immaculate, consistent state
            await session.execute(delete(Interaction))
            await session.execute(delete(CandidateJourneyStep))
            await session.execute(delete(Task))
            await session.execute(delete(Candidate))
            await session.commit()

        # 1. Seed Main Cohort (22 Handcrafted + 38 Procedural for 60+ candidates total)
        all_candidates = list(CANDIDATE_DATA)
        
        # Expand procedural records up to 55 active candidates
        first_names = ["Harsh", "Pranav", "Sneha", "Kiran", "Abhinav", "Neha", "Gaurav", "Ritika", "Sameer", "Deepa", "Manish", "Shreya"]
        last_names = ["Choudhury", "Bhattacharya", "Trivedi", "Saxena", "Dasgupta", "Pillai"]
        roles = [
            ("Senior Backend Engineer", "Engineering"),
            ("Product Analyst", "Analytics"),
            ("Operations Manager", "Operations"),
            ("Associate Product Manager", "Product"),
            ("QA Automation Lead", "Engineering"),
            ("Growth Associate", "Growth"),
        ]
        recruiters = ["Nisha Rao", "Kabir Menon", "Sana Kapoor", "Riya Shah", "Dev Malhotra", "Aditi Iyer"]
        locations = ["Bengaluru", "Mumbai", "Gurugram", "Hyderabad"]

        for i in range(len(CANDIDATE_DATA), 52):
            fname = first_names[i % len(first_names)]
            lname = last_names[i % len(last_names)]
            r_role, r_dept = roles[i % len(roles)]
            d_join = 5 + (i * 2) % 38
            r_risk = RiskLevel.high if i % 7 == 0 else RiskLevel.medium if i % 3 == 0 else RiskLevel.low
            r_silence = 6 if r_risk == RiskLevel.high and d_join <= 7 else 4 if r_risk == RiskLevel.medium else 2
            c_steps = 4 if d_join <= 7 else 3 if d_join <= 15 else 2
            all_candidates.append({
                "name": f"{fname} {lname}",
                "role": r_role,
                "dept": r_dept,
                "loc": locations[i % len(locations)],
                "recruiter": recruiters[i % len(recruiters)],
                "days_to_join": d_join,
                "risk": r_risk,
                "silence": r_silence,
                "completed_steps": c_steps,
                "conv": "All pre-joining checkpoints moving according to schedule.",
            })

        # 2. Insert Active Candidates
        for index, item in enumerate(all_candidates):
            external_id = f"cand-{index + 1:03d}"
            joining_date = today + timedelta(days=item["days_to_join"])
            offer_date = today - timedelta(days=25 + (index % 20))
            email = f"{item['name'].lower().replace(' ', '.')}@example.com"
            phone = f"+9198{index:02d}54{index:02d}10"

            candidate = Candidate(
                external_id=external_id,
                name=item["name"],
                email=email,
                phone=phone,
                role=item["role"],
                department=item["dept"],
                location=item["loc"],
                recruiter=item["recruiter"],
                offer_date=offer_date,
                joining_date=joining_date,
                status=CandidateStatus.active,
                ai_risk=item["risk"],
                effective_risk=item["risk"],
            )
            session.add(candidate)
            await session.flush()

            # Add strictly sequential steps
            steps = []
            for step_index, (key, label) in enumerate(STEP_TEMPLATE):
                if step_index < item["completed_steps"]:
                    status = JourneyStatus.completed
                elif step_index == item["completed_steps"] and item["risk"] == RiskLevel.high:
                    status = JourneyStatus.overdue
                else:
                    status = JourneyStatus.pending
                steps.append(CandidateJourneyStep(candidate_id=candidate.id, step_key=key, label=label, status=status))
            session.add_all(steps)

            # Add realistic interaction history
            silence_days = item["silence"]
            session.add_all([
                Interaction(
                    candidate_id=candidate.id,
                    channel="WhatsApp",
                    direction=InteractionDirection.outbound,
                    body=f"Hi {item['name'].split()[0]}, sharing an update regarding your onboarding at Swiggy for the {item['role']} role.",
                    tone="Friendly check-in",
                    source="seed",
                    occurred_at=datetime.utcnow() - timedelta(days=silence_days + 2),
                ),
                Interaction(
                    candidate_id=candidate.id,
                    channel="Email",
                    direction=InteractionDirection.inbound,
                    body=item["conv"],
                    tone="Candidate update",
                    source="seed",
                    occurred_at=datetime.utcnow() - timedelta(days=silence_days),
                ),
            ])

            created += 1

        # Seed realistic task distribution across Overdue, Today, and Upcoming
        candidate_map = {c.external_id: c for c in (await session.scalars(select(Candidate))).all()}
        
        task_specs = [
            # 1. Overdue Tasks (Action needed now)
            {
                "cand_id": "cand-001",
                "title": "Urgent call: Resolve transit accommodation blocker before Day 1",
                "source": "automation",
                "rule_name": "Final-Stretch Silence Escalation",
                "due_at": datetime.utcnow() - timedelta(days=1),
                "msg": "Hi Aarav, reaching out regarding your transit accommodation in Bengaluru. I'll call you shortly to make sure everything is sorted for your joining on 2nd Sep.",
            },
            {
                "cand_id": "cand-010",
                "title": "Follow up on dependent health insurance enrollment",
                "source": "automation",
                "rule_name": "Milestone Document Checklist",
                "due_at": datetime.utcnow() - timedelta(days=2),
                "msg": "Hi Tara, checking in on the health insurance forms for your dependents. Let me know if you need any clarification on the benefits package.",
            },
            # 2. Today Tasks (Actions for today)
            {
                "cand_id": "cand-002",
                "title": "Confirm background verification clearance with HR Ops",
                "source": "manual",
                "rule_name": "Readiness Review",
                "due_at": datetime.utcnow(),
                "msg": "Hi Diya, your background verification documents are cleared! Excited to have you on board as Senior Frontend Engineer this week.",
            },
            {
                "cand_id": "cand-004",
                "title": "Align notice period release letter & joining day schedule",
                "source": "automation",
                "rule_name": "Final-Stretch Silence Escalation",
                "due_at": datetime.utcnow(),
                "msg": "Hi Sana, with your joining coming up on 5th Sep, wanted to connect on your notice period release letter. Let's align today.",
            },
            # 3. Upcoming Tasks (Runway checks)
            {
                "cand_id": "cand-003",
                "title": "IT desk check: Confirm MacBook Pro courier dispatch",
                "source": "manual",
                "rule_name": "Asset Provisioning",
                "due_at": datetime.utcnow() + timedelta(days=1),
                "msg": "Hi Kabir, your laptop has been provisioned and is out for delivery. Tracking details have been sent to your email!",
            },
            {
                "cand_id": "cand-005",
                "title": "Send Mumbai hub Day-1 welcome schedule and buddy intro",
                "source": "manual",
                "rule_name": "Orientation Prep",
                "due_at": datetime.utcnow() + timedelta(days=2),
                "msg": "Hi Ishaan, here is the orientation schedule for Monday at our Mumbai hub. Your onboarding buddy Rahul is eager to welcome you.",
            },
            {
                "cand_id": "cand-007",
                "title": "Send engineering architecture reading kit and manager intro",
                "source": "manual",
                "rule_name": "Pre-boarding Welcome",
                "due_at": datetime.utcnow() + timedelta(days=3),
                "msg": "Hi Rohan, sharing the tech stack orientation guide before your start on the 8th. Feel free to browse through!",
            },
        ]

        for spec in task_specs:
            cand = candidate_map.get(spec["cand_id"])
            if cand:
                session.add(
                    Task(
                        candidate_id=cand.id,
                        title=spec["title"],
                        source=spec["source"],
                        status=TaskStatus.open,
                        assigned_to=cand.recruiter,
                        due_at=spec["due_at"],
                        rule_name=spec.get("rule_name"),
                        suggested_message=spec["msg"],
                    )
                )

        # 3. Seed 8 Past Joined Candidates for accurate funnel/analytics
        for j in range(8):
            ext_id = f"joined-{j + 1:03d}"
            j_date = today - timedelta(days=10 + j * 5)
            o_date = j_date - timedelta(days=30)
            joined_candidate = Candidate(
                external_id=ext_id,
                name=f"Alum {first_names[j % len(first_names)]} {last_names[j % len(last_names)]}",
                email=f"alum.{j}@swiggy.in",
                phone=f"+91990000{j:04d}",
                role=roles[j % len(roles)][0],
                department=roles[j % len(roles)][1],
                location="Bengaluru",
                recruiter="Nisha Rao",
                offer_date=o_date,
                joining_date=j_date,
                status=CandidateStatus.joined,
                ai_risk=RiskLevel.low,
                effective_risk=RiskLevel.low,
            )
            session.add(joined_candidate)
            await session.flush()
            for key, label in STEP_TEMPLATE:
                session.add(CandidateJourneyStep(candidate_id=joined_candidate.id, step_key=key, label=label, status=JourneyStatus.completed))
            created += 1

        await session.commit()

    return created


if __name__ == "__main__":
    count = asyncio.run(seed(force_refresh=True))
    print(f"Successfully seeded {count} realistic candidate records in SQLite database.")
