# Task Manager — Backend

FastAPI + SQLAlchemy + SQLite, secured against OWASP Top 10.

## How to Run

```bash
cd task-5-mini-task-manager/backend

# 1. Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS / Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start the server (auto-reloads on file changes)
uvicorn app.main:app --reload --port 8000
```

The API is now at **http://localhost:8000**.  
Interactive docs: **http://localhost:8000/docs**

## How to Run Tests

```bash
cd task-5-mini-task-manager/backend
pytest -v
```

Tests use an isolated `test.db` that is created fresh for every test function and dropped afterward — no state leaks between runs.

---

## Architecture & Security Deep-Dive

### `app/core/config.py` — Centralised Settings

```
Settings class (pydantic-settings)
  └── Reads from environment variables or .env file
      └── SECRET_KEY, DATABASE_URL, FRONTEND_ORIGIN, …
```

**Why pydantic-settings?**  
All configuration is declared as typed fields with defaults. Any field can be overridden by an env var — the same codebase runs in dev, staging, and prod by swapping values, never by changing code. In production, inject `SECRET_KEY` from a secrets manager (never commit it).

---

### `app/core/database.py` — Session Lifecycle

```
engine → SessionLocal → get_db (generator dependency)
                            ↓
                     route handler
                            ↓
                     finally: db.close()
```

**Why a generator with `yield`?**  
FastAPI's DI system calls `next()` on `get_db` to get the session, injects it into the route, runs the handler, then calls the generator's `finally` block on teardown — even if the handler raised an exception. This guarantees no connection is ever leaked.

**SQL Injection prevention:**  
Every query is built with SQLAlchemy's ORM API (`.filter()`, `.query()`, keyword arguments). The driver receives SQL and data separately as bind parameters — injection is structurally impossible regardless of what the user sends.

---

### `app/core/security.py` — Passwords & JWT

**bcrypt hashing:**  
`passlib` wraps bcrypt, which:
1. Generates a random salt per hash (prevents rainbow-table attacks).
2. Is intentionally slow (cost factor ~12 iterations) — makes brute-force GPU attacks impractical.
3. Stores the salt inside the hash string — no extra column needed.

**HttpOnly Cookie vs localStorage:**

| | localStorage | HttpOnly Cookie |
|---|---|---|
| Readable by JS | ✅ yes | ❌ no |
| Stolen by XSS | ✅ yes | ❌ no |
| Sent automatically | manual | automatic |
| CSRF risk | low | mitigated by SameSite=Strict |

By storing the JWT in an HttpOnly cookie, no JavaScript on the page — including any injected by XSS — can read or exfiltrate the token.

**SameSite=Strict:**  
This flag tells the browser to never attach the cookie to requests that originate from a different site (e.g., an attacker's form on evil.com POSTing to our API). It's the modern replacement for CSRF tokens.

---

### `app/models/` — SQLAlchemy ORM Models

```
User ──< Project ──< Task
     ──< Task (assignee)
```

Relationships use `cascade="all, delete-orphan"` so deleting a parent record automatically cleans up children at the ORM level — no orphaned rows, no FK constraint errors.

The `Task.status` column is a native SQL ENUM backed by Python's `str` enum. The database rejects any value not in the enum — data integrity enforced at the lowest possible layer.

---

### `app/routers/auth.py` — Authentication Endpoints

| Endpoint | Purpose | Status code |
|---|---|---|
| `POST /auth/signup` | Register user | 201 Created |
| `POST /auth/login` | Verify credentials, set cookie | 200 OK |
| `POST /auth/logout` | Expire cookie | 200 OK |
| `GET /auth/me` | Return current user from cookie | 200 OK |
| `GET /auth/users` | List all users (for assignee dropdown) | 200 OK |

Login returns `"Invalid credentials"` regardless of whether the email or password was wrong. This is intentional: different error messages for each case let attackers enumerate valid email addresses (user enumeration attack).

---

### `app/routers/projects.py` & `app/routers/tasks.py` — Authorisation

Every route that touches a specific project calls `_get_owned_project(project_id, current_user_id, db)`. This:
1. Fetches the project by ID.
2. Returns 404 if it doesn't exist.
3. Returns **403 Forbidden** if it exists but belongs to a different user.

Tasks have indirect authorisation — to modify a task you must own its parent project. A single `_get_authorized_project` function enforces this, so the check cannot be accidentally omitted on a new endpoint.

---

### Pydantic v2 Schemas — Input Validation

Schemas sit at the API boundary (the HTTP request body) and validate before any business logic runs:

- `email: EmailStr` — RFC-5321 compliant format check
- `password: str = Field(min_length=8, max_length=72)` — minimum security + bcrypt's 72-byte truncation limit
- `title: str = Field(min_length=1, max_length=200)` — prevents empty strings and excessively long inputs

If validation fails, FastAPI returns a 422 Unprocessable Entity with field-level error details before the handler even executes.
