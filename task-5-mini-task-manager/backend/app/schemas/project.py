"""
ARCHITECTURAL NOTE — Project Schemas
=====================================
`ProjectUpdate` uses `Optional` fields so callers can PATCH only the fields
they want to change. The router uses `model_dump(exclude_unset=True)` to
iterate only over explicitly-provided fields, preventing accidental nulling
of columns the caller didn't mention.
"""
from typing import Optional
from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)


class ProjectUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)


class ProjectResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    owner_id: int

    model_config = {"from_attributes": True}
