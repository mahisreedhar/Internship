"""
ARCHITECTURAL NOTE — User Model
================================
The `email` column has both `unique=True` (database-level constraint, raises
IntegrityError on duplicate) and `index=True` (B-tree index for O(log n)
lookups by email during login). Using both layers means the constraint is
enforced even if application-level duplicate checks race.

`hashed_password` stores only the bcrypt digest — the raw password never
touches the database. Column length 255 is sufficient for bcrypt's 60-char
output plus future algorithm headroom.
"""
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)

    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    assigned_tasks = relationship(
        "Task",
        back_populates="assignee",
        foreign_keys="Task.assignee_id",
    )
