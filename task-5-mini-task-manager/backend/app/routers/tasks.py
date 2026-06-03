"""
ARCHITECTURAL NOTE — Tasks Router & Indirect Authorisation
===========================================================
Tasks don't have their own `owner_id`. Instead, authorisation is *indirect*:
to touch a task you must own its parent project. `_get_authorized_project`
is the single enforcement point — all task routes call it, so there's no way
to forget the check.

JOINEDLOAD vs LAZY LOADING:
  Without `joinedload(Task.assignee)`, accessing `task.assignee` after the
  session closes raises a `DetachedInstanceError` (SQLAlchemy lazy-load).
  We use `joinedload` to fetch the assignee in the SAME SQL query (a JOIN),
  so the relationship is populated before we return the response — no extra
  round-trip, no N+1 problem.

STATUS TRANSITIONS:
  Status changes go through the same `PUT /tasks/{id}` endpoint as any
  other update. The frontend's ← → buttons send a minimal `{"status": "..."}`
  payload. Pydantic validates that the value is a member of `TaskStatus`.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.project import Project
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskResponse, TaskUpdate

router = APIRouter(tags=["Tasks"])


def _get_authorized_project(project_id: int, user_id: int, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return project


def _load_task(task_id: int, db: Session) -> Task:
    task = (
        db.query(Task)
        .options(joinedload(Task.assignee))
        .filter(Task.id == task_id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/projects/{project_id}/tasks", response_model=List[TaskResponse])
def list_tasks(
    project_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    _get_authorized_project(project_id, current_user_id, db)
    return (
        db.query(Task)
        .options(joinedload(Task.assignee))
        .filter(Task.project_id == project_id)
        .all()
    )


@router.post(
    "/projects/{project_id}/tasks",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_task(
    project_id: int,
    payload: TaskCreate,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    _get_authorized_project(project_id, current_user_id, db)
    task = Task(**payload.model_dump(), project_id=project_id)
    db.add(task)
    db.commit()
    db.refresh(task)
    return _load_task(task.id, db)


@router.get("/tasks/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    task = _load_task(task_id, db)
    _get_authorized_project(task.project_id, current_user_id, db)
    return task


@router.put("/tasks/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    _get_authorized_project(task.project_id, current_user_id, db)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    db.commit()
    return _load_task(task_id, db)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    _get_authorized_project(task.project_id, current_user_id, db)
    db.delete(task)
    db.commit()
