"""
ARCHITECTURAL NOTE — Tasks Router, Indirect Auth & RBAC Status Transitions
===========================================================================
Tasks don't have their own `owner_id`. Authorisation is *indirect*:
to touch a task you must be either the owner of, or an assignee within,
its parent project.

TWO ACCESS-TIER HELPERS:

  _get_authorized_project (owner-only):
    Used for task creation, full edits (PUT), and deletion. Only the
    project owner may mutate task content — change titles, descriptions,
    or reassign tasks.

  _get_accessible_project (owner OR assignee):
    Used for read operations (GET list/detail) and the PATCH status
    endpoint's initial access gate. An assignee can view the full board
    even without owning the project, giving them context for all tasks
    in their assigned workspace.

RBAC STATUS TRANSITIONS — PATCH /tasks/{task_id}/status:

  This is the only endpoint where authorization is evaluated at the
  *task* level rather than only at the project level, because the rule is:

    Rule A — Owner:
      project.owner_id == current_user_id
      → Allowed to change the status of ANY task in the project,
        regardless of who is assigned.

    Rule B — Assignee (non-owner):
      task.assignee_id == current_user_id
      → Allowed to change the status of ONLY their own assigned task.
        Attempting to update a task assigned to someone else, or an
        unassigned task, returns 403.

    Rule C (implicit) — Neither:
      → 403 Forbidden. The frontend hides the arrow controls for
        unauthorized tasks, but this server-side check is the
        authoritative enforcement point. A malicious or misconfigured
        client cannot bypass it by manipulating the UI or crafting
        a direct HTTP request.

  The JWT HttpOnly cookie identifies the caller — `get_current_user_id`
  extracts and validates the token, then returns the integer `user.id`
  that all route handlers compare against model fields.

JOINEDLOAD vs LAZY LOADING:
  Without `joinedload(Task.assignee)`, accessing `task.assignee` after
  the SQLAlchemy session closes raises a `DetachedInstanceError`.
  `joinedload` fetches the assignee in the SAME SQL JOIN, populating
  the relationship before serialisation — no extra round-trip, no N+1.

STATUS TRANSITIONS (full edit vs dedicated PATCH):
  Kanban arrow clicks in the frontend use PATCH /tasks/{id}/status —
  the RBAC-protected endpoint. The full PUT /tasks/{id} is reserved for
  project owners performing complete task edits (title, description,
  assignee, and status together).
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.project import Project
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskResponse, TaskStatusUpdate, TaskUpdate

router = APIRouter(tags=["Tasks"])


def _get_authorized_project(project_id: int, user_id: int, db: Session) -> Project:
    """
    Raises 403 unless the current user is the project owner.
    Used for write operations that require full ownership (create/edit/delete).
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return project


def _get_accessible_project(project_id: int, user_id: int, db: Session) -> Project:
    """
    Raises 403 unless the current user is either:
      (a) the project owner, OR
      (b) assigned to at least one task in this project.

    Used for read endpoints and the PATCH status endpoint so that
    task assignees can reach the board and update their own tasks
    without owning the project outright.

    The assignee check is a single indexed lookup (`project_id` + `assignee_id`
    are both columns that SQLAlchemy can leverage in the WHERE clause),
    so the overhead over the simpler ownership check is minimal.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.owner_id == user_id:
        # Fast-path: owner always has access
        return project

    # Non-owner path: check whether this user has any assigned task here
    has_assignment = (
        db.query(Task)
        .filter(Task.project_id == project_id, Task.assignee_id == user_id)
        .first()
    )
    if not has_assignment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: you are not assigned to any task in this project.",
        )
    return project


def _load_task(task_id: int, db: Session) -> Task:
    """
    Fetches a task with its assignee eagerly loaded via a single SQL JOIN.
    Raises 404 if the task does not exist.
    """
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
    """
    Returns all tasks for the given project.

    Access: project owner OR any user with at least one assigned task here.
    Non-owner assignees receive the full board (all tasks) so they can see
    the complete workflow context. The frontend then locks the status controls
    on cards not assigned to them, guided by the `assignee_id` field and the
    current user's identity returned from /auth/me.
    """
    _get_accessible_project(project_id, current_user_id, db)
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
    """Owner-only: creates a new task inside the project."""
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
    """
    Fetches a single task. Accessible to the project owner or any user
    assigned to a task in the parent project.
    """
    task = _load_task(task_id, db)
    _get_accessible_project(task.project_id, current_user_id, db)
    return task


@router.patch("/tasks/{task_id}/status", response_model=TaskResponse)
def update_task_status(
    task_id: int,
    payload: TaskStatusUpdate,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    RBAC-enforced status transition.

    How the caller's identity is resolved:
      The browser sends the HttpOnly JWT cookie on every request.
      `get_current_user_id` (a FastAPI Depends) decodes and validates
      the token, extracting `sub` (the user.id integer). That integer
      is then compared against the project's `owner_id` and the task's
      `assignee_id` to determine which rule applies.

    Rule A — Owner (project.owner_id == current_user_id):
      May advance or revert the status of ANY task in the project,
      regardless of who is assigned to it.

    Rule B — Assignee, non-owner (task.assignee_id == current_user_id):
      May only change the status of tasks they are personally assigned to.
      An attempt to update a task assigned to someone else, or an
      unassigned task, is rejected with 403.

    Rule C (implicit) — Neither owner nor assignee:
      403 Forbidden. The frontend hides the arrow controls for these cards,
      but this server-side check is the authoritative enforcement layer —
      a crafted HTTP request cannot bypass it.
    """
    task = _load_task(task_id, db)

    # Retrieve the parent project to evaluate Rule A vs Rule B
    project = db.query(Project).filter(Project.id == task.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.owner_id == current_user_id:
        # Rule A: project owner has unrestricted status-change access
        pass
    elif task.assignee_id == current_user_id:
        # Rule B: assignee may advance or revert their own assigned task
        pass
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Forbidden: only the project owner or the task's assignee "
                "may update this task's status."
            ),
        )

    task.status = payload.status
    db.commit()
    # Re-fetch with joinedload to return the fully-populated task response
    return _load_task(task_id, db)


@router.put("/tasks/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Full task edit — owner-only.

    Unlike PATCH /tasks/{id}/status which implements RBAC, this endpoint
    requires project ownership because it can modify any field, including
    title, description, and assignee reassignment. Only the project owner
    should be able to restructure task metadata.
    """
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
    """Owner-only: permanently removes a task."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    _get_authorized_project(task.project_id, current_user_id, db)
    db.delete(task)
    db.commit()
