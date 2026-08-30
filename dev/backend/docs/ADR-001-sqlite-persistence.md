# ADR-001: Use asynchronous SQLite for Phase 1 persistence

**Status:** Accepted  
**Date:** 2026-08-30  
**Deciders:** Post-Offer HQ team

## Context

Candidate interactions, AI assessments, human overrides, and task state currently live only in browser memory. Closing a detail view discards them. Phase 1 needs a durable, zero-operations database without holding FastAPI request handlers open for synchronous I/O.

## Decision

Use SQLite through SQLAlchemy 2.x's async engine and `aiosqlite`. The default database is `backend/post_offer_hq.db`, excluded from Git. Enable foreign keys, WAL journal mode, and a five-second busy timeout on each SQLite connection. All database access will use an `AsyncSession` dependency once API integration begins.

## Options considered

| Option | Complexity | Operations | Concurrent writes | Decision |
| --- | --- | --- | --- | --- |
| SQLite + aiosqlite | Low | None | One writer at a time | Chosen for Phase 1 |
| Postgres | Medium | Requires a service | Strong | Defer until shared deployment |
| Browser storage | Low | None | Per-browser only | Rejected: not durable/shared |

## Schema

`candidates` is the operational read model. It stores current effective and AI risk, recruiter ownership, and joining metadata.

`candidate_journey_steps` stores the six configurable journey steps per candidate.

`interactions` stores manual, inbound, and AI-assisted conversation events. The message body remains the source data passed to guarded AI analysis.

`ai_analyses` is append-only provenance for validated outputs, model IDs, prompt versions, guard scores, and the input fingerprint.

`risk_overrides` is an append-only human audit record; candidate effective risk is updated only by a later API action.

`tasks` and `notifications` establish durable queues for the next backend phase.

## Consequences

- FastAPI can await database I/O without blocking the event loop.
- Local developer setup remains one command and one file.
- WAL improves read/write coexistence but SQLite is still unsuitable for multiple app instances or sustained high write throughput.
- A future Postgres move changes `DATABASE_URL` and migration tooling, not the domain schema or repository interface.

## Action items

1. [x] Create the async engine, session factory, and durable schema.
2. [ ] Move mock candidate data into an idempotent seed/import flow.
3. [x] Replace candidate-detail mutations with typed REST endpoints; dashboard data remains mock-backed.
4. [ ] Add migrations before team/shared deployment.
