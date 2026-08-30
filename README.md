# Post-Offer HQ — Intelligent Candidate Engagement Platform

> **Status — August 2026:** Production-ready full-stack HR workspace engineered to eliminate post-offer drop-offs and keep candidates warm between offer acceptance and Day 1.

---

## 📑 Table of Contents
1. [Executive Summary & Problem Statement](#1-executive-summary--problem-statement)
2. [Full-Stack Architecture & Tech Stack](#2-full-stack-architecture--tech-stack)
3. [Implemented Core Features](#3-implemented-core-features)
4. [Automated Engagement Rules Engine](#4-automated-engagement-rules-engine)
5. [WhatsApp & Email Communication Integrations](#5-whatsapp--email-communication-integrations)
6. [AI Engineering & Safety Guardrails](#6-ai-engineering--safety-guardrails)
7. [Database Schema & Seed Dataset](#7-database-schema--seed-dataset)
8. [API Reference & Verification Suite](#8-api-reference--verification-suite)
9. [Quickstart & Local Development](#9-quickstart--local-development)
10. [Deployment Guide (Production & Cloud)](#10-deployment-guide-production--cloud)
11. [1-Million Candidate Scaling Roadmap](#11-1-million-candidate-scaling-roadmap)

---

## 1. Executive Summary & Problem Statement

### The Problem
Between offer acceptance and joining day (often 30 to 90 days in Indian tech hiring), companies experience **15% to 30% offer drop-offs**. Candidates receive competing counter-offers, face anxiety over relocation, or disengage due to recruiter silence.

### The Solution: Post-Offer HQ
Post-Offer HQ is a specialized recruiter workspace built with the **Masala Ops** design philosophy (warm, high-density editorial UI with high human touch). It provides:
1. **Real-time visibility** over candidates across their notice period.
2. **Automated Engagement Rules** that proactively detect silence and flag risk.
3. **AI-assisted signal extraction** and contextual check-in drafts.
4. **Direct WhatsApp & Email dispatch** with automated timeline audit trails.
5. **Human-in-the-loop control**: AI recommendations remain strictly advisory with auditable recruiter overrides.

---

## 2. Full-Stack Architecture & Tech Stack

```text
Browser (React 19 + TypeScript + Vite + Tailwind CSS + Lucide)
   │
   ├─ Reverse Proxy / Client Routing (SPA)
   │
FastAPI (Python 3.11 Asynchronous Backend)
   ├─ Persistence Layer ─────── Async SQLAlchemy 2.0 + SQLite (WAL Mode, Foreign Keys)
   ├─ Automation Engine ──────── Engagement Rules Runner (Final-Stretch Silence Escalation)
   ├─ Communication Service ──── WhatsApp (wa.me) & Email (mailto:) with Interaction Logger
   └─ AI Service ─────────────── Groq API (LLaMA 3.3 70B & GPT-OSS) + Llama Prompt Guard
```

| Layer | Technology | Key Capabilities |
| --- | --- | --- |
| **Frontend UI** | React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Sonner | Sub-second rendering, keyboard shortcuts, high-density Masala Ops design palette, zero layout shifts. |
| **Backend API** | Python 3.11, FastAPI, Pydantic v2, Pydantic-Settings | Fully asynchronous, strict semantic validation, unified error envelopes, request ID tracing. |
| **Database** | SQLite with Async SQLAlchemy (`aiosqlite`) | WAL (Write-Ahead Logging) mode, foreign key enforcement, indexed lookups, zero external database dependencies for local dev/demo. |
| **AI Layer** | Groq Cloud SDK (`llama-3.3-70b-versatile`, `openai/gpt-oss-20b`) | Strict JSON schema structured output, recency-weighted prompt engineering, injection guardrails, deterministic local fallback. |
| **Containerization** | Docker, Docker Compose | Multi-stage slim container builds for backend and frontend, health check orchestration. |

---

## 3. Implemented Core Features

### 🏢 1. Candidate Roster & Live Dashboard (`/`)
* **Live SQLite Source of Truth**: Dynamically queries active offers from `post_offer_hq.db`.
* **Chronological 6-Stage Journey Pipeline**:
  $$\text{Offer Accepted} \rightarrow \text{Welcome Note} \rightarrow \text{Documentation} \rightarrow \text{Manager Intro} \rightarrow \text{Pre-joining Check-in} \rightarrow \text{Joining Day}$$
* **Multi-Dimensional Filters & Search**: Search by candidate name, role, city; filter by joining month, recruiter, or risk tier (`low`, `medium`, `high`).
* **Real-Time KPI Cards**:
  * **Total Offered**: Active offers in database.
  * **Joining in 7 Days**: Urgent candidates requiring immediate attention.
  * **Joining in 15 Days**: Mid-runway pipeline volume.
  * **High-Risk Count**: Live count of silent or flagged candidates.
  * **Offer $\rightarrow$ Join Rate**: Funnel conversion performance.
* **1-Click CSV Export**: Instant client-side CSV download matching the currently active filter view.

### 👤 2. Candidate Detail & Interaction Workspace (`/candidates/:id`)
* **Hero Overview Card**: Displays candidate role, location, recruiter, offer date, joining date, and days-to-join badge.
* **Effective Risk vs. AI Risk**: Side-by-side display of AI's raw risk score vs. Recruiter Effective Risk with full audit trail.
* **Human Override Modal**: Recruiter can override candidate risk with mandatory reason logging.
* **Interactive Service-Line Milestones**: 1-click step completion toggle persisted in SQLite.
* **Conversation Timeline**: Inbound/outbound history with channel badges (WhatsApp, Email, Notes, Calls).

### 📋 3. Recruiter Task Queue (`/tasks`)
* **Categorized Task Groups**: `Overdue`, `Today`, and `Upcoming`.
* **Automated Escalation Badges**: Demarcates tasks created automatically by the Rules Engine.
* **AI Draft Check-in Accordion**: Pre-generated personalized message drafts with **Copy Draft**, **WhatsApp**, and **Simulate** actions.
* **Task Actions**: 1-click complete, dismiss, and self-assign to recruiter.

### 🔔 4. Real-Time Recruiter Notifications
* **In-App Notification Feed**: Popover badge with unread counters and 1-click "Mark all as read".
* Automatically receives events from Automated Rules and Human Risk Overrides.

---

## 4. Automated Engagement Rules Engine

The platform features an automated rule evaluation engine implemented in [`dev/backend/app/services/automation_service.py`](file:///c:/Satva/Tech/Swiggy-assignment/dev/backend/app/services/automation_service.py).

### Active Rule: *Final-Stretch Silence Escalation*
* **Trigger Condition**:
  $$\text{days\_to\_join} \le 7 \quad \text{AND} \quad \text{last\_contact\_days} \ge 5$$
* **Automated Actions Executed**:
  1. **Flag Risk**: Automatically elevates candidate's effective risk to **High Risk** with `override_reason="Automated Rule Triggered: Final-Stretch Silence Escalation"`.
  2. **Generate AI Draft**: Contextually crafts a personalized check-in message tailored to the candidate's first name, role, joining date, and recruiter.
  3. **Create Recruiter Task**: Spawns an urgent task assigned to the candidate's recruiter with the suggested message attached.
  4. **Emit Notification**: Creates an in-app alert for the recruiter.
* **Idempotency Guarantee**: Checks for existing open automation tasks for each candidate to prevent redundant task creation.
* **Execution Endpoints**:
  * `POST /api/v1/automations/run-engagement-rules`
  * Frontend: **"Run Rule Check"** button on Dashboard & **"Run Engagement Rules"** button on Tasks page with modal execution summary.

---

## 5. WhatsApp & Email Communication Integrations

Implemented in [`dev/backend/app/services/communication_service.py`](file:///c:/Satva/Tech/Swiggy-assignment/dev/backend/app/services/communication_service.py).

### Features:
1. **Direct WhatsApp Dispatch (`wa.me`)**:
   * Cleans and formats phone numbers (`+91...`).
   * URL-encodes personalized message text into a `https://wa.me/{phone}?text={encoded_message}` deep link.
   * Opens WhatsApp Web or WhatsApp Desktop in one click.
2. **Direct Email Client Dispatch (`mailto:`)**:
   * Pre-fills recipient email, subject (`Swiggy Onboarding: Welcome {Name}!`), and body text.
3. **Automated Interaction Logging**:
   * Every message triggered (WhatsApp, Email, or Simulation) writes an outbound `Interaction` record to SQLite.
   * Instantly updates the candidate's last contact timestamp and conversation timeline.
4. **Live Provider Hooks**:
   * Production-ready stubs for Twilio WhatsApp Gateway and SMTP/Resend providers via environment variables.

---

## 6. AI Engineering & Safety Guardrails

### 1. Recency-Weighted Risk Analysis
Messages tagged `[LATEST — PRIMARY SIGNAL]` dominate the risk assessment over historical messages. A candidate whose recent touch expresses accommodation issues will be elevated in risk even if previous touches were positive.

### 2. Strict Structured Output
All LLM completions use forced JSON schema response formats:
* `candidate_analysis`: summary, risk tier, quote-backed evidence array, recommended action, confidence score (0–1), and model limitations.
* `candidate_message`: editable personalized draft.

### 3. Prompt Injection Defense & Safety Guardrails
* Candidate data is isolated into non-executable data blocks.
* Filter checks block prompt injections, coercive language, or policy leaks.
* Deterministic local fallback engine ensures the application works seamlessly if the AI provider is offline or rate-limited.

---

## 7. Database Schema & Seed Dataset

### Schema Overview (`post_offer_hq.db`):
* `candidates`: ID, name, email, phone, role, department, location, recruiter, offer date, joining date, status (`active`/`joined`/`dropped`), AI risk, effective risk, override reason.
* `candidate_journey_steps`: Candidate ID, step key, label, status (`completed`/`pending`/`overdue`).
* `interactions`: Candidate ID, channel (`WhatsApp`/`Email`/`Call`/`Note`), direction (`inbound`/`outbound`), body text, tone, source, timestamp.
* `tasks`: Candidate ID, title, source (`manual`/`automation`), status (`open`/`completed`/`dismissed`), assigned recruiter, due date, rule name, suggested message draft.
* `notifications`: Kind, title, body, recipient, read timestamp, entity references.
* `risk_overrides`: Candidate ID, previous risk, new risk, reason, overridden by, timestamp.

### Realistic Cohort Seeder (`app/seed.py`):
Contains **60 realistic candidate records**:
* **Final-Stretch Candidates (1–7 days to join)**: E.g., Aarav Mehta (3 days), Diya Sharma (4 days), Kabir Menon (5 days), Sana Kapoor (6 days), Ishaan Reddy (7 days).
* **Mid-Runway Candidates (8–15 days to join)**: E.g., Rohan Verma (9 days), Ananya Nair (10 days), Vihaan Patel (11 days), Tara Iyer (12 days).
* **Long-Runway Candidates (16–45 days to join)**: Spanning up to 45 days.
* **8 Past Joined Alumni**: For funnel rate calculations.

---

## 8. API Reference & Verification Suite

### Summary of Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/v1/health` | Service health status and Groq API readiness |
| `GET` | `/api/v1/candidates` | Paginated, filterable candidate roster from SQLite |
| `GET` | `/api/v1/candidates/{id}` | Candidate detail profile and metrics |
| `GET` | `/api/v1/candidates/{id}/state` | Step statuses and interaction history |
| `POST` | `/api/v1/candidates/{id}/interactions` | Append a manual or simulated interaction |
| `PATCH` | `/api/v1/candidates/{id}/journey-steps/{step}` | Update milestone step status |
| `POST` | `/api/v1/candidates/{id}/risk-overrides` | Apply recruiter risk override with audit reason |
| `POST` | `/api/v1/candidates/{id}/send-message` | Dispatch message via WhatsApp/Email & log to timeline |
| `POST` | `/api/v1/ai/messages/generate` | AI draft generation with Groq / fallback |
| `POST` | `/api/v1/ai/candidates/analyze` | AI risk analysis and evidence extraction |
| `POST` | `/api/v1/automations/run-engagement-rules` | Execute rule evaluation engine |
| `GET` | `/api/v1/tasks` | List actionable recruiter tasks |
| `POST` | `/api/v1/tasks/{id}/complete` | Mark task completed |
| `POST` | `/api/v1/tasks/{id}/dismiss` | Dismiss task |
| `POST` | `/api/v1/tasks/{id}/assign` | Assign task to recruiter |
| `GET` | `/api/v1/notifications` | Fetch recruiter notifications |
| `POST` | `/api/v1/notifications/mark-read` | Mark all notifications read |

### Automated API Test Suite
Run the test suite against the backend:
```bash
cd dev/backend
python test_api_endpoints.py
```
**Result**: Executes and verifies all 12 API route categories with 100% pass rate.

---

## 9. Quickstart & Local Development

### Option A: Running with Docker (Recommended)
```bash
# Clone the repository
git clone <repo-url>
cd Swiggy-assignment

# Build and start both frontend and backend
docker compose up --build
```
* **Frontend Application**: `http://localhost:3000`
* **FastAPI Swagger API Docs**: `http://localhost:8000/docs`
* **Health Endpoint**: `http://localhost:8000/api/v1/health`

### Option B: Running Locally without Docker

#### 1. Backend Setup:
```bash
cd dev/backend

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Seed the database
python -m app.seed

# Start backend server
uvicorn app.main:app --reload --port 8000
```

#### 2. Frontend Setup:
```bash
cd dev

# Install dependencies
pnpm install  # or npm install

# Start Vite development server
pnpm run dev
```

---

## 10. Deployment Guide (Production & Cloud)

### Architecture in Production

```text
[Internet / CDN]
      │
[Reverse Proxy / Cloud Load Balancer (HTTPS:443)]
      │
      ├─────────────────────────────┬─────────────────────────────┐
      │ /                           │ /api                        │ /docs
      ▼                             ▼                             ▼
[Frontend Container:3000]     [Backend Container:8000]      [FastAPI Docs]
(Node.js / Express SPA)       (FastAPI + Uvicorn Workers)
                                    │
                              [Persistent Volume / PostgreSQL]
```

### Deployment Strategy Options:

#### 1. Deploy on Render / Railway (Easiest Cloud Setup)
1. **Backend Service**:
   * Build Command: `pip install -r requirements.txt`
   * Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   * Environment Variables: `GROQ_API_KEY`, `DATABASE_URL=sqlite+aiosqlite:////data/post_offer_hq.db`
   * Add a Persistent Disk mounted to `/data` to persist SQLite data across deployments.
2. **Frontend Service**:
   * Build Command: `pnpm install && pnpm run build`
   * Start Command: `node dist/index.js`
   * Environment Variables: `VITE_API_URL=https://your-backend-service.onrender.com`

#### 2. Deploy with Docker on AWS ECS / DigitalOcean / Fly.io / GCP Cloud Run
* Use the provided root [`docker-compose.yml`](file:///c:/Satva/Tech/Swiggy-assignment/docker-compose.yml).
* Mount a persistent volume for the backend SQLite storage (`backend-data:/app/data`).

#### 3. Transitioning from SQLite to Managed PostgreSQL
To deploy with PostgreSQL (e.g. Amazon RDS, Supabase, Neon):
1. Install `asyncpg`: `pip install asyncpg`.
2. Update `DATABASE_URL` in environment:
   ```env
   DATABASE_URL=postgresql+asyncpg://user:password@hostname:5432/post_offer_hq
   ```
3. SQLAlchemy async models in [`app/models.py`](file:///c:/Satva/Tech/Swiggy-assignment/dev/backend/app/models.py) will work out of the box.

---

## 11. 1-Million Candidate Scaling Roadmap

When scaling Post-Offer HQ to support enterprise-scale candidate volume (1M+ active offers):

1. **Database Tier**:
   * Migrate to **PostgreSQL 16+** with table partitioning on `joining_date` and `status`.
   * Implement read replicas for high-frequency dashboard queries and analytics aggregations.
   * Add Redis caching layer for candidate snapshots and KPI counters.
2. **Asynchronous Automation & Background Workers**:
   * Offload the Engagement Rules Engine to background worker queues using **Celery** or **Temporal** backed by Redis/RabbitMQ.
   * Run evaluations on candidate state transition webhooks (e.g. from Workday, Greenhouse, or Darwinbox).
3. **AI Scalability & Cost Optimization**:
   * Implement semantic response caching using Redis vector search to avoid re-generating similar outreach templates.
   * Use lightweight models (`llama-3.1-8b-instant`) for primary risk classification and route to larger models (`llama-3.3-70b`) only for high-complexity escalations.
4. **Security & Enterprise Compliance**:
   * Role-Based Access Control (RBAC) separating Recruiter, Hiring Manager, and HR Leadership views.
   * Candidate PII anonymization and automated data retention/deletion policies post-joining.
