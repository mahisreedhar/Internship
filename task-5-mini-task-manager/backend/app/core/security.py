"""
ARCHITECTURAL NOTE — Password Hashing & JWT via HttpOnly Cookie
================================================================
PASSWORD HASHING:
  We call bcrypt directly (no passlib wrapper) because passlib is
  unmaintained and incompatible with bcrypt >= 4.0 (its version-detection
  code crashes on the new package layout). The direct bcrypt API is just
  two functions — hashpw and checkpw — and gives us full control.

  bcrypt automatically salts every hash (preventing rainbow-table attacks)
  and is intentionally slow (cost factor ~12 rounds) to make brute-force
  GPU attacks impractical. We store ONLY the hash digest — the plaintext
  never touches the database or logs.

JWT TRANSPORT — Cookie vs localStorage:
  Storing tokens in localStorage is an XSS vulnerability: any injected
  script can read `localStorage.getItem("token")` and exfiltrate it.
  An HttpOnly cookie is invisible to JavaScript entirely — the browser
  attaches it automatically on every matching request and no script can
  read it. Combined with SameSite=Strict, the token is also immune to
  CSRF because cross-site form submissions never carry Strict cookies.

TOKEN EXTRACTION:
  `get_current_user_id` is a FastAPI dependency. It reads the cookie
  from the incoming request and raises 401 if it's absent or invalid,
  so every protected route only needs `Depends(get_current_user_id)`.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Cookie, HTTPException, status
from jose import JWTError, jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload["exp"] = expire
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
        )


def get_current_user_id(access_token: Optional[str] = Cookie(default=None)) -> int:
    """FastAPI dependency — extracts the authenticated user's ID from the HttpOnly cookie."""
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    payload = _decode_token(access_token)
    user_id: Optional[str] = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    return int(user_id)
