"""FastAPI application factory and static asset serving."""

from __future__ import annotations

import os
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.app.api.books import router as books_router
from backend.app.api.checkins import router as checkins_router
from backend.app.api.goals import router as goals_router
from backend.app.api.stats import router as stats_router
from backend.app.bootstrap import ensure_schema
from backend.app.settings import settings


def create_app() -> FastAPI:
    ensure_schema()

    app = FastAPI(title="One More Chapter", version="0.1.0")

    uploads_path = Path(settings.uploads_dir)
    uploads_path.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")

    app.include_router(books_router)
    app.include_router(checkins_router)
    app.include_router(goals_router)
    app.include_router(stats_router)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    static_path = Path(settings.static_dir)
    index_file = static_path / "index.html"
    assets_path = static_path / "assets"

    if index_file.exists() and assets_path.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_path)), name="assets")

        @app.get("/")
        def index() -> FileResponse:
            return FileResponse(
                str(index_file),
                media_type="text/html",
                headers={"Cache-Control": "no-cache"},
            )
    else:
        @app.get("/{full_path:path}")
        def frontend_not_built(full_path: str):
            return {"message": "Frontend not built yet", "path": full_path}

    return app


app = create_app()


def main() -> None:
    uvicorn.run(
        "backend.app.main:app",
        host=os.getenv("APP_HOST", settings.app_host),
        port=int(os.getenv("APP_PORT", str(settings.app_port))),
        reload=False,
    )


if __name__ == "__main__":
    main()

