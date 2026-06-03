"""
ARCHITECTURAL NOTE — Project Model & Ownership
===============================================
`owner_id` is a foreign key to `users.id` — this is the authorisation
anchor. Every project query in the router filters on `owner_id == current_user_id`,
so users can never see or modify each other's projects even if they guess an ID.

The `cascade="all, delete-orphan"` on `tasks` means deleting a project
automatically removes all its tasks — referential integrity enforced at the
ORM level, not just the application layer.
"""
from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    owner = relationship("User", back_populates="projects")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
