"""App metadata: installed version and optional GitHub update hint."""

from __future__ import annotations

from fastapi import APIRouter

from backend.app.updates import version_payload

router = APIRouter(prefix="/api", tags=["meta"])


@router.get("/version")
def app_version() -> dict:
    return version_payload()
