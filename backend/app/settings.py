from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="", extra="ignore")

    app_host: str = "0.0.0.0"
    app_port: int = 3050

    # Full SQLAlchemy URL wins over SQLITE_PATH when set.
    database_url_override: str | None = Field(default=None, validation_alias="DATABASE_URL")

    sqlite_path: str = "data/reading_library.db"

    uploads_dir: str = "data/uploads"
    static_dir: str = "frontend/dist"

    @property
    def is_sqlite(self) -> bool:
        if self.database_url_override:
            return self.database_url_override.startswith("sqlite")
        return True

    @property
    def database_url(self) -> str:
        if self.database_url_override:
            return self.database_url_override
        path = Path(self.sqlite_path).expanduser().resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{path.as_posix()}"


settings = Settings()
