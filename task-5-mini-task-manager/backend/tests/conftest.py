"""
ARCHITECTURAL NOTE — Test Isolation Strategy
============================================
Each test gets a CLEAN database by using a separate SQLite file (`test.db`)
and wrapping every test in a fixture that calls `create_all` before and
`drop_all` after. This means tests never share state — no ordering dependency,
no leftover data from a previous run.

DEPENDENCY OVERRIDE:
  FastAPI's `app.dependency_overrides` lets us swap `get_db` for a version
  that yields from the *test* session (backed by `test.db`) instead of the
  production session. The application code is completely unaware of the swap —
  this is the Dependency Inversion Principle applied to testing.

TestClient is synchronous and uses an in-process ASGI transport, so tests
run fast without a real network and without needing a running server.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app

TEST_DATABASE_URL = "sqlite:///./test.db"
test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def _isolated_db():
    """Create tables before each test, drop them after — guarantees a clean slate."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def client(_isolated_db):
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
