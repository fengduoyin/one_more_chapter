from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="", extra="ignore")

    app_host: str = "0.0.0.0"
    app_port: int = 3050

    # postgres | sqlite — sqlite is used by the portable desktop build
    db_engine: str = "postgres"

    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "reading_library"
    # Defaults match `.env.example` only — always override via environment / `.env`.
    db_user: str = "example_user"
    db_password: str = "example_password"

    # Full SQLAlchemy URL wins over db_engine / DB_* when set.
    database_url_override: str | None = Field(default=None, validation_alias="DATABASE_URL")

    sqlite_path: str = "portable/data/reading_library.db"

    uploads_dir: str = "backend/uploads"
    static_dir: str = "frontend/dist"

    @property
    def is_sqlite(self) -> bool:
        if self.database_url_override:
            return self.database_url_override.startswith("sqlite")
        return self.db_engine.lower() == "sqlite"

    @property
    def database_url(self) -> str:
        if self.database_url_override:
            return self.database_url_override
        if self.is_sqlite:
            path = Path(self.sqlite_path).expanduser().resolve()
            path.parent.mkdir(parents=True, exist_ok=True)
            return f"sqlite:///{path.as_posix()}"
        return (
            f"postgresql+psycopg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


settings = Settings()
