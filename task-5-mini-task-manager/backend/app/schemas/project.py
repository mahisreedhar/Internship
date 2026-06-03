"""
ARCHITECTURAL NOTE — Project Schemas
=====================================
`ProjectUpdate` uses `Optional` fields so callers can PATCH only the fields
they want to change. The router uses `model_dump(exclude_unset=True)` to
iterate only over explicitly-provided fields, preventing accidental nulling
of columns the caller didn't mention.

`ProjectListResponse` splits the project list into two arrays, directly
mirroring the two-section sidebar layout. This avoids the need for the
frontend to filter a flat list — the ownership boundary is enforced and
communicated by the API, not inferred by the client. Each project carries
`owner_id` so the frontend can independently verify ownership when needed.
"""
from typing import List, Optional
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


class ProjectListResponse(BaseModel):
    """
    Returned by GET /projects/ to power the two-section sidebar.

    owned_projects — Projects created by the current user.
      Full access: create/delete tasks, edit/delete the project itself.

    assigned_projects — Projects owned by other users where the current
      user is assigned to at least one task. Scoped access: view the full
      Kanban board, but only update the status of tasks assigned to them.
      The `owner_id` field on each entry still identifies who owns the
      project, which the frontend uses for any secondary ownership checks.
    """
    owned_projects: List[ProjectResponse]
    assigned_projects: List[ProjectResponse]
