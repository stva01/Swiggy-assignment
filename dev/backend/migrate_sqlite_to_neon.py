"""
Migrate data from the local SQLite database into a Neon Postgres database.

Usage:
    pip install psycopg2-binary
    cd dev/backend            # so `from app.models import ...` resolves
    python migrate_sqlite_to_neon.py \
        --sqlite ./post_offer_hq.db \
        --target "postgresql://USER:PASSWORD@YOUR-NEON-HOST/DBNAME?sslmode=require"

Notes:
- --target should be the PLAIN "postgresql://" URL Neon gives you (psycopg2 driver),
  NOT the "postgresql+asyncpg://" one your app uses at runtime. Those are different
  drivers for different jobs -- this script just needs a quick sync connection.
- Run this from inside dev/backend so it can import app.models directly. That's what
  guarantees the Postgres schema (including enum types) matches your app exactly.
- Safe to re-run: it creates tables if missing, but will error on duplicate primary
  keys if you run it twice against a target that already has the data. If you need
  to re-run from scratch, drop the tables on the Neon side first.
"""

import argparse

from sqlalchemy import create_engine, insert, select

from app.models import (
    AIAnalysis,
    Base,
    Candidate,
    CandidateJourneyStep,
    Interaction,
    Notification,
    RiskOverride,
    Task,
)

# Parents before children so foreign keys don't fail on insert.
TABLES_IN_ORDER = [
    Candidate,
    CandidateJourneyStep,
    Interaction,
    AIAnalysis,
    RiskOverride,
    Task,
    Notification,
]


def migrate(sqlite_path: str, target_url: str) -> None:
    src = create_engine(f"sqlite:///{sqlite_path}")
    dst = create_engine(target_url)

    print("Creating schema on target (if not already present)...")
    Base.metadata.create_all(dst)

    with src.connect() as sconn:
        with dst.begin() as dconn:
            for model in TABLES_IN_ORDER:
                table = model.__table__
                rows = [dict(r) for r in sconn.execute(select(table)).mappings().all()]
                if not rows:
                    print(f"  {table.name}: 0 rows, skipping")
                    continue
                dconn.execute(insert(table), rows)
                print(f"  {table.name}: migrated {len(rows)} rows")

    print("Done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sqlite", default="./post_offer_hq.db", help="Path to the source SQLite file")
    parser.add_argument("--target", required=True, help="Neon Postgres connection string (postgresql://...)")
    args = parser.parse_args()
    migrate(args.sqlite, args.target)
