from collections.abc import AsyncIterator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings

settings = get_settings()
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine: AsyncEngine = create_async_engine(settings.database_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


@event.listens_for(engine.sync_engine, "connect")
def configure_sqlite_connection(dbapi_connection, connection_record) -> None:  # type: ignore[no-untyped-def]
    if not settings.database_url.startswith("sqlite"):
        return
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys = ON")
    cursor.execute("PRAGMA journal_mode = WAL")
    cursor.execute("PRAGMA busy_timeout = 5000")
    cursor.close()


async def initialize_database() -> None:
    # Import models here so the metadata is fully registered before schema creation.
    from app import models  # noqa: F401
    from app.models import Base

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

        # Migrate new columns on SQLite if tasks table existed without them
        if settings.database_url.startswith("sqlite"):
            def migrate_columns(sync_conn):
                cursor = sync_conn.connection.cursor()
                cursor.execute("PRAGMA table_info(tasks)")
                columns = [row[1] for row in cursor.fetchall()]
                if "suggested_message" not in columns:
                    cursor.execute("ALTER TABLE tasks ADD COLUMN suggested_message TEXT")
                if "rule_name" not in columns:
                    cursor.execute("ALTER TABLE tasks ADD COLUMN rule_name VARCHAR(120)")
                cursor.close()
            await connection.run_sync(migrate_columns)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
