"""Pydantic schemas for API request and response bodies."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


BookStatus = Literal["planned", "reading", "finished", "abandoned"]
GoalPeriodType = Literal["month", "year"]
GoalMetric = Literal["books", "words", "pages"]


class BookCreate(BaseModel):
    status: BookStatus = "planned"
    author: str = Field(min_length=1, max_length=256)
    title: str = Field(min_length=1, max_length=256)
    series: str | None = Field(default=None, max_length=256)
    number: int | None = Field(default=None, ge=0)
    words_total: int = Field(ge=0)
    pages_total: int | None = Field(default=None, ge=0)
    description: str | None = None


class BookUpdate(BaseModel):
    status: BookStatus | None = None
    author: str | None = Field(default=None, min_length=1, max_length=256)
    title: str | None = Field(default=None, min_length=1, max_length=256)
    series: str | None = Field(default=None, max_length=256)
    number: int | None = Field(default=None, ge=0)
    words_total: int | None = Field(default=None, ge=0)
    pages_total: int | None = Field(default=None, ge=0)
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    review: str | None = None
    words_read: int | None = Field(default=None, ge=0)
    pages_read: int | None = Field(default=None, ge=0)


class BookOut(BaseModel):
    id: int
    created_at: datetime
    updated_at: datetime
    status: BookStatus
    author: str
    title: str
    series: str | None
    number: int | None
    words_total: int
    pages_total: int | None
    description: str | None
    cover_url: str | None
    start_date: date | None
    end_date: date | None
    review: str | None
    words_read: int
    pages_read: int
    progress_percent: float
    reading_minutes_total: int
    last_checkin_day: date | None


class BookProgressIn(BaseModel):
    percent: float | None = Field(default=None, ge=0, le=100)
    words_delta: int | None = Field(default=None)
    pages_delta: int | None = Field(default=None, ge=0)
    reading_minutes: int | None = Field(default=None, ge=0)
    note: str | None = Field(default=None, max_length=512)
    day: date | None = None
    record_checkin: bool = False


class CheckinCreate(BaseModel):
    day: date
    book_id: int | None = None
    words_delta: int = Field(default=0, ge=0)
    pages_delta: int = Field(default=0, ge=0)
    reading_minutes: int | None = Field(default=None, ge=0)
    note: str | None = Field(default=None, max_length=512)


class CheckinOut(BaseModel):
    id: int
    created_at: datetime
    day: date
    book_id: int | None
    words_delta: int
    pages_delta: int
    effective_words: int
    words_estimated: bool
    effective_pages: int
    pages_estimated: bool
    reading_minutes: int | None
    note: str | None


class CheckinUpdate(BaseModel):
    book_id: int | None = None
    words_delta: int | None = Field(default=None, ge=0)
    pages_delta: int | None = Field(default=None, ge=0)
    reading_minutes: int | None = Field(default=None, ge=0)
    note: str | None = Field(default=None, max_length=512)


class GoalUpsert(BaseModel):
    period_type: GoalPeriodType
    period_start: date
    metric: GoalMetric
    target: int = Field(ge=0)
    title: str | None = Field(default=None, max_length=128)


class GoalUpdate(BaseModel):
    period_type: GoalPeriodType | None = None
    period_start: date | None = None
    metric: GoalMetric | None = None
    target: int | None = Field(default=None, ge=0)
    title: str | None = Field(default=None, max_length=128)


class GoalOut(BaseModel):
    id: int
    created_at: datetime
    period_type: GoalPeriodType
    period_start: date
    metric: GoalMetric
    target: int
    title: str | None


class GoalProgressOut(BaseModel):
    goal: GoalOut
    current: int
    percent: float


class SummaryOut(BaseModel):
    period_start: date
    period_end: date
    words_read: int
    finished_books: int
    finished_words: int
    current_strike_days: int


class FinishedBookOut(BaseModel):
    id: int
    author: str
    title: str
    words_total: int
    start_date: date | None
    end_date: date | None


class FinishedListOut(BaseModel):
    period_start: date
    period_end: date
    books: list[FinishedBookOut]
    count: int
    words_total: int


class CheckinDaysOut(BaseModel):
    period_start: date
    period_end: date
    days: list[date]


class StatsAnalyticsOut(BaseModel):
    period_start: date
    period_end: date
    words_total: int
    pages_total: int
    minutes_total: int
    words_per_minute: float | None
    minutes_per_day: float | None
    reading_days: int
    finished_books: int
    best_day_words: int
    best_day_pages: int
    best_day_minutes: int


class StatsDayPoint(BaseModel):
    day: date
    words: int
    pages: int
    minutes: int


class StatsMonthPoint(BaseModel):
    year: int
    month: int
    words: int
    pages: int
    minutes: int


class StatsChartsOut(BaseModel):
    heatmap_start: date
    heatmap_end: date
    by_day: list[StatsDayPoint]
    by_month: list[StatsMonthPoint]

