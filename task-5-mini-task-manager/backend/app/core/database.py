"""
ARCHITECTURAL NOTE — SQLAlchemy Session Management
===================================================
The `get_db` generator uses Python's `yield` inside a try/finally block.
FastAPI's dependency injection calls `next()` to get the session, runs the
route handler, then calls `close()` in the finally block — even on exceptions.
This guarantees no connection leak regardless of what the handler does.

SECURITY (SQL Injection): We NEVER build SQL strings manually. Every query
goes through SQLAlchemy's ORM parameterised interface (e.g., `.filter()`),
which passes values as bind parameters, making injection structurally
impossible — the driver keeps SQL and data in separate protocol channels.

`check_same_thread=False` is SQLite-only and required because FastAPI's
async framework may execute the route on a different thread than the one
that opened the connection. PostgreSQL does not need this flag.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session
from app.core.config import settings

_connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(settings.DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
