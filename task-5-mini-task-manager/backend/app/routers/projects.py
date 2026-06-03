"""
ARCHITECTURAL NOTE — Projects Router, Ownership & Assignment Scoping
=====================================================================
OWNERSHIP ENFORCEMENT:
  Every mutating route (GET detail, PUT, DELETE) calls `_get_owned_project`,
  which filters by `Project.owner_id == current_user_id`. If the record
  exists but belongs to another user we return 403 Forbidden, not 404.
  Returning 404 would also be acceptable (security-through-obscurity), but
  403 is semantically correct and easier to debug in your own client.

LIST ENDPOINT — SPLIT RESPONSE:
  GET /projects/ now returns a ProjectListResponse with two arrays:

  owned_projects: The classic `WHERE owner_id = current_user_id` query.
    No IDs from other users' projects are present, so the response never
    leaks the existence of projects the caller doesn't own.

  assigned_projects: Projects where the caller is NOT the owner but IS
    assigned to at least one task within that project. Computed as a
    subquery on the tasks table (distinct project_ids where
    assignee_id == current_user_id), then joined back to projects with an
    extra filter that excludes any the user already owns. These projects
    appear in the "ASSIGNED PROJECTS" sidebar section and receive scoped
    access: view the full board + update own task statuses only.

`model_dump(exclude_unset=True)` on PUT means only fields the client
explicitly sent are written. Without this, Optional fields default to None
and silently overwrite existing data.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.project import Project
from app.models.task import Task
from app.schemas.project import (
    ProjectCreate,
    ProjectListResponse,
    ProjectResponse,
    ProjectUpdate,
)

router = APIRouter(prefix="/projects", tags=["Projects"])


def _get_owned_project(project_id: int, user_id: int, db: Session) -> Project:
    """Raises 403 unless the current user is the project owner."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return project


@router.get("/", response_model=ProjectListResponse)
def list_projects(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Returns a split project list for the two-section sidebar.

    owned_projects: projects where this user is the creator (full access).
    assigned_projects: projects owned by others where this user has at
      least one assigned task (scoped: view board + update own task status).

    The subquery approach avoids an N+1 pattern: a single IN clause fetches
    all relevant project rows without looping over task results in Python.
    The exclusion filter (`owner_id != current_user_id`) ensures a project
    never appears in both lists even if the owner assigns a task to themselves.
    """
    # Projects where this user is the creator/owner
    owned = db.query(Project).filter(Project.owner_id == current_user_id).all()

    # Subquery: distinct project IDs from tasks where this user is the assignee
    assigned_project_ids_sq = (
        db.query(Task.project_id)
        .filter(Task.assignee_id == current_user_id)
        .distinct()
        .subquery()
    )

    # Resolve those project rows, excluding any already owned by this user
    assigned = (
        db.query(Project)
        .filter(
            Project.id.in_(assigned_project_ids_sq),
            Project.owner_id != current_user_id,
        )
        .all()
    )

    return ProjectListResponse(owned_projects=owned, assigned_projects=assigned)


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    project = Project(**payload.model_dump(), owner_id=current_user_id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    return _get_owned_project(project_id, current_user_id, db)


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(project_id, current_user_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(project_id, current_user_id, db)
    db.delete(project)
    db.commit()
