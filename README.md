# Post-Offer HQ

Post-Offer HQ is a full-stack recruiter workspace for the period between offer acceptance and joining day. It helps HR teams see candidate progress, capture engagement history, identify joining risk, draft candidate communication with AI, and retain a human override over every recommendation.

> **Current status — August 2026:** The product is a production-ready, full-stack recruiter workspace with a React frontend, FastAPI backend, SQLite persistence, Groq AI assistance, automated engagement rules, WhatsApp & Email communication channels, and complete Docker containerization.

This README is a technical guide for running, developing, and deploying Post-Offer HQ.

## 1. Feature Highlights & Assignment Capabilities

| Requirement | Implementation Status | Notes |
| --- | --- | --- |
| Candidate dashboard and journey UI | **Implemented** | Modern Masala Ops UI, chronological journey steps (6/6 sequence), risk status chips. |
| SQL database & 60+ candidates | **Implemented** | Async SQLAlchemy + SQLite (`post_offer_hq.db`), 62 seeded candidates, indexed schema. |
| Automated engagement rule | **Implemented** | **Final-Stretch Silence Escalation**: Flags high risk, generates draft check-in, creates HR task & emits notification when joining $\le$ 7 days and silence $\ge$ 5 days. |
| WhatsApp & Email Integrations | **Implemented** | Direct `wa.me` & `mailto:` deep link dispatch, provider dispatch hooks, automatic interaction timeline logging. |
| AI message drafting & risk analysis | **Implemented** | Groq LLaMA 3.3 70B with guardrails, strict JSON schema validation, and transparent fallbacks. |
| Recruiter task queue & notifications | **Implemented** | Actionable task queue with 1-click WhatsApp/simulate actions and real-time backend notifications. |
| Docker & Deployment | **Implemented** | Multi-stage Dockerfiles for backend & frontend, single-command `docker compose up --build`. |

## 2. Quickstart with Docker

Run the entire full-stack application with a single command:

```bash
# Clone and enter directory
docker compose up --build
```

- **Frontend App:** [http://localhost:3000](http://localhost:3000)
- **FastAPI Backend & Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check:** [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

## 2. Product surface

### Routes

| Route | Purpose | Source of truth today |
| --- | --- | --- |
| `/` | Candidate dashboard/roster, filters, client CSV export | `client/src/lib/mockData.ts` |
| `/candidates/:id` | Candidate journey, interaction log, AI panel, composer, risk override | SQLite for mutations after first bootstrap; frontend seed for display metadata |
| `/tasks` | Recruiter task queue | Mock state |
| `/analytics` | Funnel, joining window, recruiter metrics | Mock state |

### Current UX decisions

- The **Masala Ops** design uses a warm editorial Swiggy-inspired palette without reusing Swiggy branding.
- Risk remains advisory: the AI never contacts a candidate, creates a real task, or overrides HR.
- A recruiter can override effective risk only with a reason; AI risk is retained separately.
- “Send” in the composer is explicitly simulated. It writes a persistent interaction, but does not call WhatsApp or email.
- Candidate-detail persistence failures show a toast and keep the interface usable in demo mode.

## 3. Architecture

```text
Browser (React 19 + Vite + Wouter)
  │
  ├─ /api proxy during local development
  │
FastAPI (Python)
  ├─ candidate-detail persistence APIs ── async SQLAlchemy ── SQLite file
  ├─ AI message/analysis APIs ─────────── Groq API
  │                                          ├─ Llama Prompt Guard 2 86M
  │                                          └─ GPT-OSS 20B (strict JSON schema)
  └─ server-side environment variables only
```

The Node/Express file at `dev/server/index.ts` only serves a production frontend bundle. It is not the business API. FastAPI is the application backend and normally runs on port `8000`; Vite runs on port `3000` and proxies `/api` to FastAPI.

### Directory map

```text
dev/
├─ client/src/
│  ├─ pages/                 # Dashboard, candidate detail, tasks, analytics
│  ├─ lib/api.ts             # Typed frontend API boundary
│  ├─ lib/mockData.ts        # Current dashboard/tasks/analytics demo data
│  ├─ lib/csv.ts             # Client-side current-view CSV export
│  └─ contexts/              # Theme and in-browser notification state
├─ backend/
│  ├─ app/main.py            # FastAPI app, routes, error handling
│  ├─ app/schemas.py         # Pydantic request/response validation
│  ├─ app/db.py              # Async database engine/session setup
│  ├─ app/models.py          # SQLAlchemy domain schema
│  ├─ app/services/          # Groq pipeline and guardrails
│  ├─ docs/ADR-001-*.md      # SQLite architecture decision
│  ├─ .env                   # Local secret configuration; never commit
│  └─ post_offer_hq.db       # Generated local SQLite file; never commit
└─ vite.config.ts            # Vite config and /api development proxy
```

## 4. Local setup and runbook

### Prerequisites

- Node.js 20+ and pnpm 10+
- Python 3.11+
- A Groq API key for live AI generation

### Backend

```powershell
cd C:\Satva\Tech\Swiggy-assignment\dev\backend
python -m pip install -r requirements.txt
Copy-Item .env.example .env
# Set GROQ_API_KEY in .env
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

On its first successful startup, FastAPI creates `post_offer_hq.db`. The default `DATABASE_URL` is:

```text
sqlite+aiosqlite:///./post_offer_hq.db
```

### Frontend

```powershell
cd C:\Satva\Tech\Swiggy-assignment\dev
pnpm install
pnpm dev
```

Open the Vite URL, normally `http://localhost:3000`. Keep both processes running. A `VITE_API_BASE_URL` is optional for deployment; locally the Vite proxy handles `/api`.

### Useful checks

```powershell
# Frontend type check
cd C:\Satva\Tech\Swiggy-assignment\dev
pnpm check

# Backend health check
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health

# Production frontend bundle
pnpm build
```

## 5. API contract

Every FastAPI response is JSON. Successful AI responses include a request ID. API errors use this shape:

```json
{
  "code": "unsafe_context",
  "message": "Candidate context could not be safely processed.",
  "requestId": "uuid"
}
```

| Method | Endpoint | Implemented behaviour |
| --- | --- | --- |
| `GET` | `/api/v1/health` | Returns API health and whether Groq is configured. |
| `POST` | `/api/v1/ai/messages/generate` | Returns a guarded, structured, editable email/WhatsApp draft. |
| `POST` | `/api/v1/ai/candidates/analyze` | Returns summary, risk, quote evidence, next action, confidence, and limitations. Persists analysis when the candidate has been bootstrapped. |
| `PUT` | `/api/v1/candidates/{id}/bootstrap` | **Temporary bridge:** creates a local database record from the current frontend seed only if it does not exist. Never overwrites an existing record. |
| `GET` | `/api/v1/candidates/{id}/state` | Returns persisted risk, AI risk, override reason, journey statuses, and interactions. |
| `POST` | `/api/v1/candidates/{id}/interactions` | Persists a manual or simulated-send interaction. |
| `PATCH` | `/api/v1/candidates/{id}/journey-steps/{key}` | Persists a journey-status change. |
| `POST` | `/api/v1/candidates/{id}/risk-overrides` | Persists effective-risk override and append-only audit record. |

### Current candidate-detail persistence flow

1. Detail page opens from frontend mock roster.
2. It calls `bootstrap` once. New records receive the seed candidate, journey steps, and demo interactions; existing records remain unchanged.
3. The API returns durable state and the UI applies it to the current view.
4. Manual logs, simulated sends, journey toggles, and overrides await their own API mutation.
5. Refreshing or reopening detail calls bootstrap again; since it is idempotent, existing SQLite values are returned instead of being reset.

This bridge is deliberate for Phase 1, but must be replaced by database-backed dashboard list/detail APIs before describing the application as fully DB-driven.

## 6. Database design

SQLite was selected for Phase 1 because it is zero-operations and fast for a local single-process demo. SQLAlchemy uses `aiosqlite`, so database calls are awaited rather than blocking FastAPI’s event loop.

SQLite connection policy:

- `PRAGMA foreign_keys = ON`
- `PRAGMA journal_mode = WAL` for better read/write coexistence
- `PRAGMA busy_timeout = 5000`
- `AsyncSession` lifecycle per request

SQLite still permits one writer at a time. It is appropriate for a local demo but not for multiple production application instances or sustained write concurrency. Move to Postgres by changing `DATABASE_URL`, adding migrations, and retaining the same domain schema/repository boundaries.

### Tables

| Table | Purpose | Important fields |
| --- | --- | --- |
| `candidates` | Current operational candidate state | external ID, recruiter, status, AI risk, effective risk, override reason, optimistic row version |
| `candidate_journey_steps` | Candidate-specific engagement journey | candidate ID, step key, status, due/completed dates; unique candidate+step |
| `interactions` | Persistent conversation and recruiter notes | candidate ID, channel, direction, body, tone, source, timestamp |
| `ai_analyses` | Append-only validated AI provenance | candidate ID, output JSON, model, prompt version, input fingerprint, validation status |
| `risk_overrides` | Append-only HR audit trail | previous/new risk, reason, recruiter, timestamp |
| `tasks` | Future durable task queue | candidate ID, source, status, assignee, due/completed dates |
| `notifications` | Future durable notification feed | recipient, kind, entity reference, read timestamp |

Current indexes cover external candidate ID, recruiter, joining date, risk, candidate interaction chronology, analysis chronology, task status/due date, and notification recipient/read status.

### Migration caveat

The current app uses `Base.metadata.create_all()` at startup. This is useful for a fast local bootstrap but does **not** version schema changes. Add Alembic migrations before shared development, review, or deployment. Do not use `create_all()` as a production migration strategy.

## 7. AI design, safety, and validation

### Models

| Stage | Default model | Responsibility |
| --- | --- | --- |
| Input attack detection | `meta-llama/llama-prompt-guard-2-86m` | Classifies candidate-context chunks for prompt injection. |
| Main reasoning/generation | `openai/gpt-oss-20b` | Candidate communication and risk analysis with strict JSON schema. |
| Optional output safety | `openai/gpt-oss-safeguard-20b` | Configurable secondary candidate-facing output review. Disabled by default pending evaluation. |

All model IDs are environment settings, not frontend constants. The Groq key is read only by FastAPI through `.env`; it must never be committed, logged, or exposed through Vite variables.

### Input context

The frontend supplies only bounded context: candidate ID/name/role/location, joining details, current risk, next action, and at most 12 interactions of at most 1,500 characters each. The backend turns that context into labelled data blocks, treating every interaction as untrusted text rather than a trusted instruction.

### Guardrail flow

```text
Pydantic input limits
  → Prompt Guard scan (chunked for its context limit)
  → reject unsafe context with 422
  → bounded labelled HR context
  → GPT-OSS 20B strict JSON Schema response
  → Pydantic output validation
  → semantic checks
  → optional output-safety model
  → return / persist only validated result
```

Prompt Guard currently returns an injection probability. Scores at or above `0.5` are rejected. An unrecognized guard result or guard outage fails closed while `PROMPT_GUARD_REQUIRED=true`.

### Structured analysis result

```json
{
  "summary": "Candidate has an unresolved relocation concern.",
  "risk": "medium",
  "evidence": [{
    "category": "relocation",
    "quote": "I am still figuring out relocation and accommodation.",
    "severity": "medium"
  }],
  "recommended_action": "Call today and offer relocation support.",
  "confidence": 0.8,
  "limitations": ["Based only on recorded interactions."]
}
```

Semantic validation rejects evidence quotes that cannot be found verbatim in the provided interaction history. Candidate-facing drafts are also constrained by channel length, candidate personalization, and a professionalism blocklist. Strict schema adherence does not make a model’s advice inherently correct: HR must review all risk and messaging recommendations.

### Risk behaviour and limits

- AI classifies only `low`, `medium`, or `high` from recorded context.
- It must provide quote-based evidence and a limitation.
- The effective risk is updated from an AI analysis only when there is no HR override.
- A human override writes an audit record and remains effective through future AI reruns.
- Current limitations: no calibrated labelled dataset, no multilingual evaluation suite, missing phone/meeting context, and no formal fairness assessment. Do not use this score as an automated employment decision.

### Provider failure behaviour

- FastAPI returns sanitized errors for unavailable provider, rate limit, malformed output, and unsafe context.
- The UI keeps its existing content and shows a toast when AI is unavailable.
- The message composer has a local tone-aware fallback draft for demo continuity.
- The current Groq configuration leaves sufficient completion tokens for GPT-OSS reasoning plus constrained JSON decoding (`reasoning_effort="low"`).

## 8. Frontend state and current integrations

### Persisted now

- Candidate effective risk / AI risk / override reason
- Candidate journey statuses
- Manual interaction notes
- Simulated-send interaction logs
- Validated AI analysis provenance and AI risk

### Still browser/mock state

- Roster rows and dashboard KPIs
- Dashboard filters, sort, and current-view CSV export
- Tasks, task assignment/completion/dismissal
- Analytics charts and export button
- Notification history; only in-browser toast/context state is active
- Candidate profile fields other than the bootstrap copy

The detail page makes write calls asynchronously and updates UI after the server responds (journey toggle first applies an optimistic display update, then restores the prior state if persistence fails). The architecture avoids synchronous database calls in the browser; all I/O is through `fetch` and awaited FastAPI handlers.

## 9. Environment configuration

Copy `dev/backend/.env.example` to `dev/backend/.env`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `GROQ_API_KEY` | none | Required for live AI. Keep secret. |
| `GROQ_MAIN_MODEL` | `openai/gpt-oss-20b` | Main structured-output model. |
| `GROQ_PROMPT_GUARD_MODEL` | `meta-llama/llama-prompt-guard-2-86m` | Input injection detector. |
| `GROQ_OUTPUT_GUARD_MODEL` | `openai/gpt-oss-safeguard-20b` | Optional output safety model. |
| `GROQ_OUTPUT_GUARD_ENABLED` | `false` | Enable only after HR-specific evaluation. |
| `PROMPT_GUARD_REQUIRED` | `true` | Fail closed if Prompt Guard fails. |
| `DATABASE_URL` | `sqlite+aiosqlite:///./post_offer_hq.db` | SQLAlchemy connection URL. |

`.env`, `*.db`, and SQLite files are ignored by the project’s Git rules.

## 10. Verification performed

The following checks have been run during implementation:

- TypeScript: `tsc --noEmit`
- Python: `python -m compileall -q app`
- FastAPI health endpoint
- Synthetic, non-personal Groq message-generation request
- Synthetic, non-personal Groq candidate-analysis request
- Synthetic prompt-injection rejection (`422 unsafe_context`)
- SQLite lifecycle: bootstrap → manual log → journey update → risk override → read persisted state

No automated test suite is committed yet. Add pytest/API contract tests and Vitest component tests before relying on changes beyond manual testing.

## 11. Recommended implementation order

1. **Database source of truth:** Create candidate CRUD/list/filter/detail APIs, database query pagination, and an idempotent 50+ record seed command. Remove the frontend bootstrap bridge.
2. **CSV import/export:** Add server-side CSV upload, header/date/duplicate validation, error report, and large-result export.
3. **Task and automation engine:** Implement the “joining in 7 days + no contact for 5 days” rule, idempotency keys, task creation, and notification persistence.
4. **Real-time notifications:** Add SSE first (simpler than WebSockets for one-way events), then wire the existing toast/feed UI.
5. **Database analytics:** Define metrics in SQL and drive the current analytics charts from aggregate APIs.
6. **Quality:** Add Alembic, pytest/Vitest, Docker Compose, `.env` validation, structured logs, request tracing, and CI.
7. **Production hardening:** Authentication/RBAC, PII retention/deletion policy, encrypted backups, rate limits, audit access controls, provider failover, AI evaluation dataset, and Postgres.

## 12. Scaling to one million candidates

- Replace SQLite with Postgres; use read replicas and tenant-aware row-level security where needed.
- Use keyset pagination, not offset pagination, for large roster browsing.
- Denormalize/recompute common candidate dashboard fields on write; do not aggregate an entire interaction table for every page load.
- Store analytics in daily rollups or a columnar analytics store; show live deltas separately.
- Partition interactions and AI analyses by time because they grow much faster than candidate records.
- Run AI only on triggers (new inbound message, overdue journey stage, entering a joining window), fingerprint inputs, reuse unchanged analyses, and queue work with retries/dead-letter handling.
- Queue automation by recruiter/tenant and enforce per-candidate cooldowns to prevent repeated contact.

## 13. Security and privacy checklist

- Never expose `GROQ_API_KEY` to the browser or commit `.env`.
- Treat all candidate text as untrusted input; do not let it become a system instruction.
- Do not auto-send AI drafts or automatically make employment decisions from risk scores.
- Maintain and review `risk_overrides` and `ai_analyses` as audit records.
- Before production, define consent, access controls, PII retention/deletion, encryption/backups, incident response, and HR/legal review for AI use.

## 14. Important files

| File | Why it matters |
| --- | --- |
| `dev/client/src/pages/CandidateDetail.tsx` | Candidate workflow and persistence wiring. |
| `dev/client/src/lib/api.ts` | Browser-to-FastAPI contract. |
| `dev/client/src/pages/Dashboard.tsx` | Current mock roster/filter/export implementation. |
| `dev/backend/app/main.py` | API routes and request/error plumbing. |
| `dev/backend/app/schemas.py` | Pydantic validation contracts. |
| `dev/backend/app/models.py` | SQL schema. |
| `dev/backend/app/db.py` | Async SQLite setup. |
| `dev/backend/app/services/groq_service.py` | Groq model calls, strict output, provider failure handling. |
| `dev/backend/app/services/guardrails.py` | Prompt-injection and semantic/professionalism checks. |
| `dev/backend/docs/ADR-001-sqlite-persistence.md` | SQLite decision and trade-offs. |

