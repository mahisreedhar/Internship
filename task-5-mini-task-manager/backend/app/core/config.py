"""
ARCHITECTURAL NOTE — Configuration via pydantic-settings
=========================================================
Using BaseSettings means every value can be overridden by an environment
variable (or a .env file) without changing code. This is the 12-factor app
pattern: the same codebase runs in dev, staging, and prod by swapping env vars.

SECURITY: The SECRET_KEY signs every JWT. Rotate it to invalidate all
outstanding tokens instantly. In production, source it from a secrets
manager (AWS Secrets Manager, HashiCorp Vault) — never commit it.
The default here is for local dev only; production MUST set it via env.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # JWT
    SECRET_KEY: str = "dev-only-secret-key-change-this-in-production-min-32-chars!!"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database — swap to a Postgres URL for production
    DATABASE_URL: str = "sqlite:///./task_manager.db"

    # CORS — explicitly named origin, never wildcard
    FRONTEND_ORIGIN: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
