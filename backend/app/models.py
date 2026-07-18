"""SQLAlchemy ORM models for books, check-ins, and reading goals."""

from __future__ import annotations

import enum
from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db import Base

# SQLite only autoincrements INTEGER PRIMARY KEY; Postgres keeps BIGINT.
_PK = BigInteger().with_variant(Integer, "sqlite")
_BIGINT = BigInteger().with_variant(Integer, "sqlite")


class BookStatus(str, enum.Enum):
    planned = "planned"
    reading = "reading"
    finished = "finished"
    abandoned = "abandoned"


class Book(Base):
    __tablename__ = "books"

    id: Mapped[int] = mapped_column(_PK, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    status: Mapped[str] = mapped_column(String(32), default=BookStatus.planned.value, nullable=False)
    author: Mapped[str] = mapped_column(String(256), nullable=False)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    volume: Mapped[str | None] = mapped_column(String(64), nullable=True)
    words_total: Mapped[int] = mapped_column(_BIGINT, nullable=False)
    pages_total: Mapped[int | None] = mapped_column(_BIGINT, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_path: Mapped[str | None] = mapped_column(String(512), nullable=True)

    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    review: Mapped[str | None] = mapped_column(Text, nullable=True)

    words_read: Mapped[int] = mapped_column(_BIGINT, default=0, nullable=False)
    pages_read: Mapped[int] = mapped_column(_BIGINT, default=0, nullable=False)

    checkins: Mapped[list["Checkin"]] = relationship(back_populates="book")


class Checkin(Base):
    __tablename__ = "checkins"
    __table_args__ = (UniqueConstraint("day", "book_id", name="ux_checkins_day_book"),)

    id: Mapped[int] = mapped_column(_PK, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    day: Mapped[date] = mapped_column(Date, nullable=False)
    book_id: Mapped[int | None] = mapped_column(_BIGINT, ForeignKey("books.id", ondelete="SET NULL"), nullable=True)
    words_delta: Mapped[int] = mapped_column(_BIGINT, nullable=False)
    pages_delta: Mapped[int] = mapped_column(_BIGINT, default=0, nullable=False)
    reading_minutes: Mapped[int | None] = mapped_column(_BIGINT, nullable=True)
    note: Mapped[str | None] = mapped_column(String(512), nullable=True)

    book: Mapped[Book | None] = relationship(back_populates="checkins")


class GoalPeriodType(str, enum.Enum):
    month = "month"
    year = "year"


class GoalMetric(str, enum.Enum):
    books = "books"
    words = "words"
    pages = "pages"


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[int] = mapped_column(_PK, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    period_type: Mapped[str] = mapped_column(String(16), nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    metric: Mapped[str] = mapped_column(String(16), nullable=False)
    target: Mapped[int] = mapped_column(_BIGINT, nullable=False)
    title: Mapped[str | None] = mapped_column(String(128), nullable=True)

