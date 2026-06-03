"""
ARCHITECTURAL NOTE — Task Model & Status Enum
==============================================
`TaskStatus` is a Python `str` enum stored as a native SQL ENUM column.
Using an enum (instead of a plain VARCHAR) constrains valid values at the
database level — no arbitrary status strings can be inserted even with a
direct SQL client, which prevents data corruption.

`assignee_id` is nullable (a task need not be assigned). The explicit
`foreign_keys=[assignee_id]` argument is required here because the User
model has two relationships pointing to Task, so SQLAlchemy needs the
disambiguation hint to build the correct JOIN.
"""
import enum

from sqlalchemy import Column, Enum as SAEnum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class TaskStatus(str, enum.Enum):
    TODO = "To Do"
    IN_PROGRESS = "In Progress"
    DONE = "Done"


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(SAEnum(TaskStatus), default=TaskStatus.TODO, nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    project = relationship("Project", back_populates="tasks")
    assignee = relationship(
        "User",
        back_populates="assigned_tasks",
        foreign_keys=[assignee_id],
    )
