import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import jwt
from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174", "http://127.0.0.1:5174"],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "users.db"

SECRET_KEY = "dev-only-auth-secret"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthRequest(BaseModel):
    email: str
    password: str


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


def normalize_credentials(email: str, password: str) -> tuple[str, str]:
    clean_email = email.strip().lower()

    if not clean_email:
        raise HTTPException(status_code=400, detail="Email is required.")

    if not password:
        raise HTTPException(status_code=400, detail="Password is required.")

    return clean_email, password


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": email, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def get_current_user_email(authorization: Optional[str] = Header(default=None)) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    email = payload.get("sub")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
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
            detail="User does not exist.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return email


init_db()


@app.post("/api/auth/signup", status_code=status.HTTP_201_CREATED)
def signup(data: AuthRequest):
    email, password = normalize_credentials(data.email, data.password)
    hashed_password = hash_password(password)

    try:
        with get_connection() as connection:
            connection.execute(
                "INSERT INTO users (email, hashed_password) VALUES (?, ?)",
                (email, hashed_password),
            )
            connection.commit()
    except sqlite3.IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered.",
        ) from exc

    return {"message": "User created successfully."}


@app.post("/api/auth/login")
def login(data: AuthRequest):
    email, password = normalize_credentials(data.email, data.password)

    with get_connection() as connection:
        user = connection.execute(
            "SELECT email, hashed_password FROM users WHERE email = ?",
            (email,),
        ).fetchone()

    if not user or not verify_password(password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    access_token = create_access_token(user["email"])
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/api/users/me")
def get_me(email: str = Depends(get_current_user_email)):
    return {"email": email}
