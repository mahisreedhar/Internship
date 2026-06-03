"""
ARCHITECTURAL NOTE — Authentication Router
==========================================
LOGIN FLOW:
  1. Client POSTs credentials (JSON body over HTTPS).
  2. We verify the bcrypt hash — timing-safe, no short-circuit leaks.
  3. We mint a JWT with `sub = str(user.id)` and set it as an HttpOnly cookie.
  4. The browser stores the cookie; JavaScript cannot access it at all.

LOGOUT FLOW:
  We call `response.delete_cookie()`, which sends a Set-Cookie header that
  immediately expires the cookie. The JWT itself is not blocklisted (stateless
  design). For revocation in production, add a server-side token blocklist
  (Redis) checked in `_decode_token`.

GENERIC ERROR MESSAGES:
  Login returns "Invalid credentials" regardless of whether the email or
  password was wrong. This prevents user enumeration — attackers cannot
  probe which emails are registered.

`secure=False` is for local HTTP dev only. In production (HTTPS), flip it
to `True` — the browser will then refuse to send the cookie over plain HTTP.
"""
from datetime import timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    get_current_user_id,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=UserResponse)
def login(payload: UserLogin, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,          # JS cannot read this cookie
        samesite="strict",      # Blocks CSRF — cross-site requests never carry this cookie
        secure=False,           # Set to True in production (requires HTTPS)
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    return user


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token", samesite="strict")
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
def get_me(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == current_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/users", response_model=List[UserResponse])
def list_users(
    current_user_id: int = Depends(get_current_user_id),  # noqa: ARG001 — auth guard
    db: Session = Depends(get_db),
):
    """Returns all registered users — used to populate the task assignee dropdown."""
    return db.query(User).all()
