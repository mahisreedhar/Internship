"""
ARCHITECTURAL NOTE — Pydantic v2 Input Validation
==================================================
`UserCreate` is the inbound schema for registration. Pydantic v2 enforces
every constraint (EmailStr format, password length 8-72, name length 1-100)
BEFORE the route handler body executes — invalid payloads never reach the
database. This is the correct boundary for untrusted input.

PASSWORD LENGTH 72: bcrypt silently truncates passwords beyond 72 bytes.
Setting max_length=72 makes this limit explicit so users are not surprised
by "password changed but login still works with old password" bugs.

`UserResponse` deliberately omits `hashed_password`. Pydantic's
`model_config = {"from_attributes": True}` lets it read directly from
SQLAlchemy ORM instances (previously done via `orm_mode = True` in v1).
"""
from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(min_length=1, max_length=100)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str

    model_config = {"from_attributes": True}
