"""
ARCHITECTURAL NOTE — Task Schemas & Enum Reuse
===============================================
We import `TaskStatus` directly from the model module so there is a single
source of truth for valid statuses — the schema and the DB column reference
the same Python enum. If you add a new status to the enum, both layers
update atomically.

`TaskResponse` includes the nested `assignee: Optional[UserResponse]` so
the frontend receives full user info (name, email) in one round-trip without
needing a second `/users/{id}` fetch. SQLAlchemy's `joinedload` in the router
populates this relationship eagerly.
"""
from typing import Optional
from pydantic import BaseModel, Field
from app.models.task import TaskStatus
from app.schemas.user import UserResponse


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    status: TaskStatus = TaskStatus.TODO
    assignee_id: Optional[int] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    status: Optional[TaskStatus] = None
    assignee_id: Optional[int] = None


class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    status: TaskStatus
    project_id: int
    assignee_id: Optional[int]
    assignee: Optional[UserResponse] = None

    model_config = {"from_attributes": True}
