# Post-Offer HQ FastAPI boundary

This directory is intentionally separated from the static React app so the logic layer can evolve into a FastAPI service without changing the visual surface.

## Run locally

Install the dependencies from `backend/requirements.txt`, then copy `.env.example` to `.env` and provide `GROQ_API_KEY`. Start the service with `uvicorn app.main:app --reload --port 8000` from this directory.

On first startup, the API creates a local SQLite database at `post_offer_hq.db`. It uses asynchronous SQLAlchemy sessions, WAL mode, foreign-key enforcement, and a busy timeout. The initial schema is documented in `docs/ADR-001-sqlite-persistence.md`; API reads and writes will be wired in the next phase.

## Routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/v1/health` | Liveness check used by the frontend boundary. |
| POST | `/api/v1/ai/messages/generate` | Generate one candidate-facing message from bounded candidate context, channel, and `Friendly`, `Formal`, or `Urgent` tone. |
| POST | `/api/v1/ai/candidates/analyze` | Return validated interaction summary, joining risk, evidence quotes, confidence, and next action. |
| GET | `/api/v1/notifications` | Read the current notification stream placeholder. |
| POST | `/api/v1/notifications` | Ingest a risk or task event for a future SSE/WebSocket broadcaster. |

The Groq client is created only on the backend. Every untrusted interaction is size-limited and scanned by Llama Prompt Guard before it reaches the main model. GPT-OSS 20B uses strict JSON Schema output and Pydantic adds semantic checks, including evidence-quote traceability and candidate-facing professionalism limits. `GROQ_OUTPUT_GUARD_ENABLED=true` also sends candidate-facing drafts through the separately configured safety model; leave it disabled until its behaviour is evaluated against an HR test suite. The React app currently falls back to local tone-aware drafting when the backend is unavailable, which keeps the demo usable while the service is being connected.

The Python client follows Groq's official async chat-completion pattern and keeps provider-specific prompting inside `app/agents/message_agent.py`.
