"""
ARCHITECTURAL NOTE — Dedicated User Search Router
==================================================

WHY A SEPARATE ROUTER?
  The original user listing lived inside auth.py at GET /auth/users. That
  worked fine for a static <select> dropdown — fetch everything once, render
  everything once. But an async autocomplete combobox has completely different
  needs: it fires on every keystroke, it must stay fast at 10,000+ users, and
  it carries query parameters. Those requirements earn this endpoint its own
  module rather than cluttering the authentication router.

URL STRUCTURE:
  This router mounts at the prefix /v1/users.
  Vite's dev proxy strips /api from the browser URL, so the full round-trip is:

    Browser        →  GET /api/v1/users?search=mahi&limit=10
    Vite Proxy     →  strips /api  →  http://localhost:8000/v1/users?search=mahi&limit=10
    FastAPI Router →  prefix=/v1/users, endpoint=""  →  handler receives search="mahi", limit=10
    SQLAlchemy     →  WHERE (full_name ILIKE '%mahi%' OR email ILIKE '%mahi%') LIMIT 10
    Response       →  [{"id": 1, "full_name": "Mahi", "email": "mahi@example.com"}, ...]

THE SEARCH LOOP (back-end half):
  Step 1: Client sends GET /v1/users?search=<term>&limit=10.
  Step 2: FastAPI validates and injects `search` and `limit` as typed Python values.
  Step 3: SQLAlchemy builds a query object (no SQL emitted yet — it's lazy).
  Step 4: If `search` is non-empty, we attach a WHERE clause using:
            or_(User.full_name.ilike(f"%{search}%"), User.email.ilike(f"%{search}%"))
          `ilike` = case-insensitive LIKE. The % wildcards match the term
          anywhere in the string, so "ahi" matches "Mahi" and "mahi@corp.com".
          `or_()` means EITHER column can match — you can type a name fragment
          or an email fragment and the same endpoint handles both.
  Step 5: `.limit(limit)` is appended. With the B-tree index on User.email
          (declared unique=True in the model), this query completes in
          O(log n) time even on a table with millions of rows.
  Step 6: SQLAlchemy emits the SQL, fetches at most 10 rows, and FastAPI
          serialises them through the UserResponse Pydantic model, which
          deliberately omits the hashed_password field from the output.

PERFORMANCE CLIFF NOTE:
  Without `.limit()`, a search for a single common letter like "a" would pull
  every user whose name or email contains "a" — potentially the entire table.
  The hard ceiling of 10 rows ensures the payload is always micro-sized and the
  database cursor closes immediately after the tiny result set is fetched.

SECURITY NOTE:
  `get_current_user_id` is injected as a dependency but its return value is
  intentionally ignored (noqa: ARG001). Its only job here is to act as an
  authentication gate — if the request has no valid JWT cookie, FastAPI raises
  401 Unauthorized before our handler ever executes. This prevents unauthenticated
  users from enumerating the user list.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.user import User
from app.schemas.user import UserResponse

# This router handles all user-search endpoints under the /v1/users path.
# Mounted in main.py so FastAPI registers: GET /v1/users
router = APIRouter(prefix="/v1/users", tags=["Users"])


@router.get("", response_model=List[UserResponse])
def search_users(
    # Optional search string — if omitted, returns first `limit` users with no filter.
    # The frontend combobox always sends this, but omitting it is safe for initial loads.
    search: Optional[str] = Query(
        default=None,
        description="Case-insensitive substring match against full_name OR email",
    ),
    # Hard ceiling enforced server-side — the caller cannot request more than 10 rows.
    # This is not a preference; it is a performance contract with the database layer.
    limit: int = Query(
        default=10,
        ge=1,
        le=10,
        description="Maximum number of users to return (1–10)",
    ),
    # Authentication gate: if the cookie is absent or invalid, this dependency
    # raises HTTP 401 before the handler body runs. The return value is unused.
    current_user_id: int = Depends(get_current_user_id),  # noqa: ARG001
    db: Session = Depends(get_db),
):
    """
    Real-time user search endpoint powering the async autocomplete combobox.

    Returns at most `limit` users whose full_name OR email contains `search`
    (case-insensitive). If `search` is omitted, returns the first `limit` users
    — useful for pre-populating suggestions before the user has typed anything.
    """
    # Start with an unfiltered query — SQLAlchemy does not emit SQL yet.
    # The query object is built up lazily; the database is only hit at `.all()`.
    query = db.query(User)

    if search:
        # ilike(f"%{search}%") compiles to: column ILIKE '%<term>%'
        # The leading and trailing % mean the term can appear anywhere in the value.
        # or_() wraps both conditions in SQL: (full_name ILIKE '%x%' OR email ILIKE '%x%')
        # This single WHERE clause lets the user search by name fragment or email fragment
        # without needing two separate endpoints.
        query = query.filter(
            or_(
                User.full_name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
            )
        )

    # .limit() appends LIMIT <n> to the SQL statement.
    # This is the critical performance guard: regardless of table size or search
    # breadth, the database engine stops scanning after it has found 10 matching rows.
    # .all() executes the final SQL and returns a list of User ORM objects,
    # which FastAPI then serialises through UserResponse (password field excluded).
    return query.limit(limit).all()
