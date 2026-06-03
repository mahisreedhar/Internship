"""
ARCHITECTURAL NOTE — Projects Router & Authorisation
=====================================================
OWNERSHIP ENFORCEMENT:
  Every mutating route (GET detail, PUT, DELETE) calls `.filter(Project.owner_id == current_user_id)`.
  If the record exists but belongs to another user, we return 403 Forbidden,
  not 404. Returning 404 would also be acceptable (security through obscurity),
  but 403 is semantically correct and easier to debug in your own client.

  The list route only queries `WHERE owner_id = current_user_id` so the
  response never leaks other users' project IDs — an attacker can't even
  discover what projects exist for other accounts.

`model_dump(exclude_unset=True)` on PATCH/PUT means only fields the client
explicitly sent are written. Without this, optional fields default to `None`
and silently overwrite existing data.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["Projects"])


def _get_owned_project(project_id: int, user_id: int, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return project


@router.get("/", response_model=List[ProjectResponse])
def list_projects(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    return db.query(Project).filter(Project.owner_id == current_user_id).all()


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
