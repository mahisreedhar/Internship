# Importing all models here ensures SQLAlchemy registers them with Base.metadata
# before create_all() runs. Without these imports, tables would not be created.
from app.models.user import User  # noqa: F401
from app.models.project import Project  # noqa: F401
from app.models.task import Task  # noqa: F401
