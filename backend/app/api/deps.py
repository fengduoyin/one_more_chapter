"""Shared FastAPI dependencies."""

from __future__ import annotations

from fastapi import Depends
from sqlalchemy.orm import Session

from backend.app.db import get_db


DbSession = Depends(get_db)


def db_session(db: Session = DbSession) -> Session:
    return db

