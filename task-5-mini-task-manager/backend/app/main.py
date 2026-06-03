"""
ARCHITECTURAL NOTE — Application Entrypoint, CORS & Lifespan
=============================================================
CORS:
  `CORSMiddleware` with an explicit `allow_origins` list (never `["*"]`)
  means only requests originating from our frontend URL are allowed. The
  browser's CORS preflight (OPTIONS) checks this before sending the real
  request, so foreign-origin pages cannot make credentialled API calls even
  if they try. `allow_credentials=True` is required when the frontend sends
  cookies — without it the browser blocks the response.

LIFESPAN:
  The `@asynccontextmanager lifespan` pattern (FastAPI 0.93+) replaces the
  deprecated `@app.on_event("startup")`. It runs `create_all` once at
  startup to create tables that don't yet exist. In production you'd replace
  this with Alembic migrations for schema evolution without data loss.

ROUTER REGISTRATION:
  Each domain (auth, projects, tasks) lives in its own module and is
  included here with `app.include_router`. This keeps main.py thin — it
  only wires things together, never contains business logic.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.models import User, Project, Task  # noqa: F401 — registers models with Base
from app.routers import auth, projects, tasks


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Mini Task Manager API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(tasks.router)


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy"}
