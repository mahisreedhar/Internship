import os
import re
import secrets
import sqlite3
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Lock
from typing import Deque, Dict, Optional, Tuple

import jwt
from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from pydantic import BaseModel, Field

app = FastAPI()

DEFAULT_ALLOWED_ORIGINS = ["http://localhost:5174", "http://127.0.0.1:5174"]


def get_allowed_origins() -> list[str]:
    configured = os.getenv("FRONTEND_ORIGINS", "")
    origins = [origin.strip() for origin in configured.split(",") if origin.strip()]
    return origins if origins else DEFAULT_ALLOWED_ORIGINS


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "users.db"

# Use an environment secret in production. For local dev, fallback to an in-memory
# random secret so tokens cannot be forged from source code alone.
SECRET_KEY = os.getenv("AUTH_SECRET_KEY") or secrets.token_urlsafe(64)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
JWT_ISSUER = "task-3-auth-system"
JWT_AUDIENCE = "task-3-auth-frontend"

EMAIL_PATTERN = re.compile(
    r"^(?=.{3,254}$)[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$"
)

PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 72

# General per-IP rate limits.
RATE_LIMIT_WINDOW_SECONDS = 60
SIGNUP_MAX_PER_WINDOW = 10
LOGIN_MAX_PER_WINDOW = 20
ME_MAX_PER_WINDOW = 60

# Per-account login lockout policy.
LOGIN_FAILURE_WINDOW_SECONDS = 300
MAX_FAILED_LOGINS = 5
LOCKOUT_SECONDS = 300

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
DUMMY_PASSWORD_HASH = pwd_context.hash("not-the-real-password")

request_buckets: Dict[str, Deque[float]] = defaultdict(deque)
failed_login_buckets: Dict[str, Deque[float]] = defaultdict(deque)
locked_accounts: Dict[str, float] = {}
security_lock = Lock()


class AuthRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL
            )
            """
        )
        connection.commit()


def normalize_credentials(email: str, password: str) -> Tuple[str, str]:
    clean_email = email.strip().lower()

    if not clean_email or not EMAIL_PATTERN.fullmatch(clean_email):
        raise HTTPException(status_code=400, detail="Invalid email or password format.")

    if len(password) < PASSWORD_MIN_LENGTH or len(password) > PASSWORD_MAX_LENGTH:
        raise HTTPException(status_code=400, detail="Invalid email or password format.")

    if password != password.strip() or any(ord(ch) < 32 for ch in password):
        raise HTTPException(status_code=400, detail="Invalid email or password format.")

    return clean_email, password


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(email: str) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": email,
        "type": "access",
        "iat": now,
        "nbf": now,
        "exp": expire,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            audience=JWT_AUDIENCE,
            issuer=JWT_ISSUER,
            options={"require": ["sub", "type", "iat", "nbf", "exp", "iss", "aud"]},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


def get_client_ip(request: Request) -> str:
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def prune_window(bucket: Deque[float], window_seconds: int, now: float) -> None:
    cutoff = now - window_seconds
    while bucket and bucket[0] < cutoff:
        bucket.popleft()


def enforce_ip_rate_limit(
    request: Request,
    route_key: str,
    max_requests: int,
    window_seconds: int,
) -> None:
    ip = get_client_ip(request)
    bucket_key = f"{route_key}:{ip}"
    now = time.time()

    with security_lock:
        bucket = request_buckets[bucket_key]
        prune_window(bucket, window_seconds, now)

        if len(bucket) >= max_requests:
            retry_after = max(1, int(window_seconds - (now - bucket[0])))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
                headers={"Retry-After": str(retry_after)},
            )

        bucket.append(now)


def record_failed_login(email: str) -> None:
    now = time.time()

    with security_lock:
        bucket = failed_login_buckets[email]
        prune_window(bucket, LOGIN_FAILURE_WINDOW_SECONDS, now)
        bucket.append(now)

        if len(bucket) >= MAX_FAILED_LOGINS:
            locked_accounts[email] = now + LOCKOUT_SECONDS
            bucket.clear()


def clear_failed_login(email: str) -> None:
    with security_lock:
        failed_login_buckets.pop(email, None)
        locked_accounts.pop(email, None)


def enforce_account_not_locked(email: str) -> None:
    now = time.time()

    with security_lock:
        unlock_at = locked_accounts.get(email)
        if not unlock_at:
            return

        if unlock_at <= now:
            locked_accounts.pop(email, None)
            return

        retry_after = max(1, int(unlock_at - now))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )


def get_current_user_email(
    request: Request,
    authorization: Optional[str] = Header(default=None),
) -> str:
    enforce_ip_rate_limit(request, "me", ME_MAX_PER_WINDOW, RATE_LIMIT_WINDOW_SECONDS)

    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    scheme, _, token = authorization.strip().partition(" ")
    if scheme.lower() != "bearer" or not token or len(token) > 4096:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    email = payload.get("sub")

    if not isinstance(email, str) or not EMAIL_PATTERN.fullmatch(email):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    with get_connection() as connection:
        user = connection.execute(
            "SELECT id FROM users WHERE email = ?",
            (email,),
        ).fetchone()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return email


init_db()


@app.post("/api/auth/signup", status_code=status.HTTP_201_CREATED)
def signup(data: AuthRequest, request: Request):
    enforce_ip_rate_limit(request, "signup", SIGNUP_MAX_PER_WINDOW, RATE_LIMIT_WINDOW_SECONDS)
    email, password = normalize_credentials(data.email, data.password)
    hashed_password = hash_password(password)

    # Return a generic success response even if the account already exists,
    # reducing user-enumeration via signup endpoint probing.
    try:
        with get_connection() as connection:
            connection.execute(
                "INSERT INTO users (email, hashed_password) VALUES (?, ?)",
                (email, hashed_password),
            )
            connection.commit()
    except sqlite3.IntegrityError:
        pass

    return {"message": "If the email is available, the account was created."}


@app.post("/api/auth/login")
def login(data: AuthRequest, request: Request):
    enforce_ip_rate_limit(request, "login", LOGIN_MAX_PER_WINDOW, RATE_LIMIT_WINDOW_SECONDS)
    email, password = normalize_credentials(data.email, data.password)
    enforce_account_not_locked(email)

    with get_connection() as connection:
        user = connection.execute(
            "SELECT email, hashed_password FROM users WHERE email = ?",
            (email,),
        ).fetchone()

    stored_hash = user["hashed_password"] if user else DUMMY_PASSWORD_HASH
    password_valid = verify_password(password, stored_hash)

    if not user or not password_valid:
        record_failed_login(email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    clear_failed_login(email)
    access_token = create_access_token(user["email"])
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/api/users/me")
def get_me(email: str = Depends(get_current_user_email)):
    return {"email": email}
