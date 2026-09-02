"""Reading statistics, goal progress, and analytics endpoints."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from backend.app.api.checkin_allocation import effective_pages_map, effective_words_map
from backend.app.api.deps import db_session
from backend.app.models import Book, Checkin, Goal
from backend.app.schemas import (
    CheckinDaysOut,
    FinishedBookOut,
    FinishedListOut,
    GoalOut,
    GoalProgressOut,
    StatsAnalyticsOut,
    StatsChartsOut,
    StatsDayPoint,
    StatsMonthPoint,
    SummaryOut,
)
from backend.app.utils import (
    CheckinDayEntry,
    allocate_reading_words_by_day,
    month_range,
    reading_end_date,
    strike_days,
    sum_allocated_words_in_period,
    year_range,
)


router = APIRouter(prefix="/api/stats", tags=["stats"])

HEATMAP_WEEKS = 75


def _book_total_words(book: Book) -> int:
    return int(book.words_read)


def _reading_end(book: Book) -> date | None:
    return reading_end_date(book.start_date, book.end_date)


def _reading_overlaps_period(book: Book, start: date, end: date) -> bool:
    reading_end = _reading_end(book)
    if reading_end is None:
        return False
    return book.start_date <= end and reading_end >= start


def _checkins_for_book_in_range(
    checkins_by_book: dict[int, dict[date, CheckinDayEntry]],
    book_id: int,
    reading_start: date,
    reading_end: date,
) -> dict[date, CheckinDayEntry]:
    raw = checkins_by_book.get(book_id, {})
    return {day: entry for day, entry in raw.items() if reading_start <= day <= reading_end}


def _checkins_for_book_in_period(
    checkins_by_book: dict[int, dict[date, CheckinDayEntry]],
    book_id: int,
    start: date,
    end: date,
) -> int:
    raw = checkins_by_book.get(book_id, {})
    return sum(entry.words for day, entry in raw.items() if start <= day <= end)


def _book_words_in_period(
    book: Book,
    start: date,
    end: date,
    checkins_by_book: dict[int, dict[date, CheckinDayEntry]],
) -> int:
    reading_end = _reading_end(book)
    if book.start_date is None or reading_end is None:
        return _checkins_for_book_in_period(checkins_by_book, book.id, start, end)

    if not _reading_overlaps_period(book, start, end):
        return _checkins_for_book_in_period(checkins_by_book, book.id, start, end)

    checkins_in_range = _checkins_for_book_in_range(
        checkins_by_book,
        book.id,
        book.start_date,
        reading_end,
    )
    allocation = allocate_reading_words_by_day(
        _book_total_words(book),
        book.start_date,
        reading_end,
        checkins_in_range,
    )
    words = sum_allocated_words_in_period(allocation, start, end)

    raw_checkins = checkins_by_book.get(book.id, {})
    extra_checkins = sum(
        entry.words
        for day, entry in raw_checkins.items()
        if start <= day <= end and (day < book.start_date or day > reading_end)
    )
    return words + extra_checkins


def _words_in_period(start: date, end: date, db: Session) -> int:
    return _words_from_period_data(start, end, _load_words_period_data(db, start, end))


def _load_words_period_data(db: Session, start: date, end: date) -> dict:
    orphan_rows = db.execute(
        select(Checkin.day, Checkin.words_delta).where(
            Checkin.day >= start,
            Checkin.day <= end,
            Checkin.book_id.is_(None),
        )
    ).all()
    orphans_by_day: dict[date, int] = {}
    for day, words_delta in orphan_rows:
        orphans_by_day[day] = orphans_by_day.get(day, 0) + int(words_delta)

    checkin_book_ids = (
        db.execute(
            select(Checkin.book_id)
            .where(
                Checkin.day >= start,
                Checkin.day <= end,
                Checkin.book_id.is_not(None),
            )
            .distinct()
        )
        .scalars()
        .all()
    )

    overlapping_books = (
        db.execute(
            select(Book).where(
                Book.start_date.is_not(None),
                or_(
                    and_(Book.end_date.is_not(None), Book.end_date >= start, Book.start_date <= end),
                    and_(
                        Book.end_date.is_(None),
                        Book.start_date <= end,
                    ),
                ),
            )
        )
        .scalars()
        .all()
    )

    books_by_id: dict[int, Book] = {book.id: book for book in overlapping_books}
    if checkin_book_ids:
        extra_books = db.execute(select(Book).where(Book.id.in_(checkin_book_ids))).scalars().all()
        for book in extra_books:
            books_by_id.setdefault(book.id, book)

    all_book_ids = list(books_by_id)
    checkins_by_book: dict[int, dict[date, CheckinDayEntry]] = {}
    if all_book_ids:
        checkin_rows = db.execute(
            select(
                Checkin.book_id,
                Checkin.day,
                Checkin.words_delta,
                Checkin.pages_delta,
                Checkin.reading_minutes,
            ).where(Checkin.book_id.in_(all_book_ids))
        ).all()
        for book_id, day, words_delta, pages_delta, reading_minutes in checkin_rows:
            if book_id is None:
                continue
            checkins_by_book.setdefault(book_id, {})[day] = CheckinDayEntry(
                words=int(words_delta),
                pages=int(pages_delta),
                minutes=int(reading_minutes) if reading_minutes is not None else None,
            )

    return {
        "orphans_by_day": orphans_by_day,
        "books_by_id": books_by_id,
        "checkins_by_book": checkins_by_book,
    }


def _words_from_period_data(start: date, end: date, data: dict) -> int:
    orphan_words = sum(
        words for day, words in data["orphans_by_day"].items() if start <= day <= end
    )
    total = orphan_words
    for book in data["books_by_id"].values():
        total += _book_words_in_period(book, start, end, data["checkins_by_book"])
    return total


def _goal_out(g: Goal) -> GoalOut:
    return GoalOut(
        id=g.id,
        created_at=g.created_at,
        period_type=g.period_type,  # type: ignore[arg-type]
        period_start=g.period_start,
        metric=g.metric,  # type: ignore[arg-type]
        target=int(g.target),
        title=g.title,
    )


def _goal_period_range(goal: Goal) -> tuple[date, date]:
    if goal.period_type == "year":
        return year_range(goal.period_start.year)
    return month_range(goal.period_start.year, goal.period_start.month)


def _goal_current(metric: str, start: date, end: date, db: Session) -> int:
    if metric == "words":
        return _words_in_period(start, end, db)
    if metric == "pages":
        return _pages_in_period(start, end, db)
    return int(
        db.execute(select(func.count(Book.id)).where(Book.end_date >= start, Book.end_date <= end)).scalar_one()
    )


def _goal_progress_item(goal: Goal, db: Session) -> GoalProgressOut:
    start, end = _goal_period_range(goal)
    current = _goal_current(goal.metric, start, end, db)
    pct = 0.0 if int(goal.target) == 0 else (current / int(goal.target)) * 100.0
    return GoalProgressOut(goal=_goal_out(goal), current=current, percent=float(pct))


@router.get("/summary", response_model=SummaryOut)
def summary(
    year: int,
    month: int | None = None,
    db: Session = Depends(db_session),
) -> SummaryOut:
    if month is None:
        start, end = year_range(year)
    else:
        if month < 1 or month > 12:
            raise HTTPException(status_code=400, detail="month must be 1..12")
        start, end = month_range(year, month)

    words_read = _words_in_period(start, end, db)

    finished_books = (
        db.execute(select(func.count(Book.id)).where(Book.end_date >= start, Book.end_date <= end))
        .scalar_one()
    )
    finished_words = (
        db.execute(
            select(func.coalesce(func.sum(Book.words_total), 0)).where(Book.end_date >= start, Book.end_date <= end)
        )
        .scalar_one()
    )

    all_days = db.execute(select(Checkin.day).distinct()).scalars().all()
    strike = strike_days(list(all_days), date.today())

    return SummaryOut(
        period_start=start,
        period_end=end,
        words_read=int(words_read),
        finished_books=int(finished_books),
        finished_words=int(finished_words),
        current_strike_days=int(strike),
    )


@router.get("/goals/progress", response_model=list[GoalProgressOut])
def goals_progress(
    year: int,
    month: int | None = None,
    db: Session = Depends(db_session),
) -> list[GoalProgressOut]:
    if month is None:
        start, end = year_range(year)
        period_type = "year"
        period_start = start
    else:
        start, end = month_range(year, month)
        period_type = "month"
        period_start = start

    goals = db.execute(
        select(Goal).where(Goal.period_type == period_type, Goal.period_start == period_start).order_by(Goal.metric)
    ).scalars().all()

    return [_goal_progress_item(g, db) for g in goals]


@router.get("/goals/progress/all", response_model=list[GoalProgressOut])
def goals_progress_all(db: Session = Depends(db_session)) -> list[GoalProgressOut]:
    goals = db.execute(select(Goal).order_by(Goal.period_start.desc(), Goal.metric)).scalars().all()
    current_cache: dict[tuple[str, date, date], int] = {}

    def cached_current(metric: str, start: date, end: date) -> int:
        key = (metric, start, end)
        if key not in current_cache:
            current_cache[key] = _goal_current(metric, start, end, db)
        return current_cache[key]

    items: list[GoalProgressOut] = []
    for goal in goals:
        start, end = _goal_period_range(goal)
        current = cached_current(goal.metric, start, end)
        pct = 0.0 if int(goal.target) == 0 else (current / int(goal.target)) * 100.0
        items.append(GoalProgressOut(goal=_goal_out(goal), current=current, percent=float(pct)))
    return items


@router.get("/finished", response_model=FinishedListOut)
def finished(
    year: int,
    month: int | None = None,
    db: Session = Depends(db_session),
) -> FinishedListOut:
    if month is None:
        start, end = year_range(year)
    else:
        if month < 1 or month > 12:
            raise HTTPException(status_code=400, detail="month must be 1..12")
        start, end = month_range(year, month)

    rows = (
        db.execute(
            select(Book)
            .where(Book.end_date.is_not(None), Book.end_date >= start, Book.end_date <= end)
            .order_by(Book.end_date.desc())
        )
        .scalars()
        .all()
    )

    books = [
        FinishedBookOut(
            id=b.id,
            author=b.author,
            title=b.title,
            words_total=int(b.words_total),
            start_date=b.start_date,
            end_date=b.end_date,
        )
        for b in rows
    ]
    words_total = sum(b.words_total for b in books)
    return FinishedListOut(
        period_start=start,
        period_end=end,
        books=books,
        count=len(books),
        words_total=int(words_total),
    )


def _analytics_period_range(
    period: Literal["week", "month", "year", "all"],
    year: int | None,
    month: int | None,
    ref: date,
    db: Session,
) -> tuple[date, date]:
    if period == "week":
        return ref - timedelta(days=6), ref
    if period == "month":
        resolved_year = ref.year if year is None else year
        resolved_month = ref.month if month is None else month
        if resolved_month < 1 or resolved_month > 12:
            raise HTTPException(status_code=400, detail="month must be 1..12")
        return month_range(resolved_year, resolved_month)
    if period == "year":
        resolved_year = ref.year if year is None else year
        return year_range(resolved_year)
    if period == "all":
        min_day = db.execute(select(func.min(Checkin.day))).scalar_one()
        return (min_day if min_day else ref), ref
    raise HTTPException(status_code=400, detail="period must be week, month, year, or all")


def _checkin_day_aggregates(
    start: date,
    end: date,
    db: Session,
) -> tuple[dict[date, dict[str, int]], int, float | None]:
    checkins = (
        db.execute(select(Checkin).where(Checkin.day >= start, Checkin.day <= end).order_by(Checkin.day.asc()))
        .scalars()
        .all()
    )
    if not checkins:
        return {}, 0, None

    effective_words = effective_words_map(db, checkins)
    effective_pages = effective_pages_map(db, checkins, effective_words)
    by_day: dict[date, dict[str, int]] = {}
    minutes_total = 0
    speed_words = 0
    speed_minutes = 0

    for checkin in checkins:
        words = int(effective_words.get(checkin.id, checkin.words_delta))
        pages = int(effective_pages.get(checkin.id, checkin.pages_delta))
        minutes = int(checkin.reading_minutes) if checkin.reading_minutes else 0
        minutes_total += minutes

        entry = by_day.setdefault(checkin.day, {"words": 0, "pages": 0, "minutes": 0})
        entry["words"] += words
        entry["pages"] += pages
        entry["minutes"] += minutes

        if minutes > 0 and words > 0:
            speed_words += words
            speed_minutes += minutes

    words_per_minute = speed_words / speed_minutes if speed_minutes > 0 else None
    return by_day, minutes_total, words_per_minute


def _pages_in_period(start: date, end: date, db: Session) -> int:
    checkins = (
        db.execute(select(Checkin).where(Checkin.day >= start, Checkin.day <= end)).scalars().all()
    )
    if not checkins:
        return 0
    words_eff = effective_words_map(db, checkins)
    pages_eff = effective_pages_map(db, checkins, words_eff)
    return sum(int(pages_eff.get(checkin.id, checkin.pages_delta)) for checkin in checkins)


def _heatmap_range(ref: date) -> tuple[date, date]:
    end = ref
    rough_start = end - timedelta(days=HEATMAP_WEEKS * 7 - 1)
    start = rough_start - timedelta(days=rough_start.weekday())
    return start, end


def _recent_months(count: int, ref: date) -> list[tuple[int, int]]:
    year = ref.year
    month = ref.month
    months: list[tuple[int, int]] = []
    for _ in range(count):
        months.append((year, month))
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    months.reverse()
    return months


@router.get("/analytics/charts", response_model=StatsChartsOut)
def analytics_charts(
    months: int = 12,
    db: Session = Depends(db_session),
) -> StatsChartsOut:
    if months < 1 or months > 24:
        raise HTTPException(status_code=400, detail="months must be 1..24")

    ref = date.today()
    heatmap_start, heatmap_end = _heatmap_range(ref)
    month_keys = _recent_months(months, ref)
    first_start, _ = month_range(*month_keys[0])
    _, last_end = month_range(*month_keys[-1])
    span_start = min(heatmap_start, first_start)
    span_end = max(heatmap_end, last_end)

    # One load for heatmap + monthly series (same effective maps as before).
    checkins = (
        db.execute(
            select(Checkin)
            .where(Checkin.day >= span_start, Checkin.day <= span_end)
            .order_by(Checkin.day.asc())
        )
        .scalars()
        .all()
    )
    words_eff = effective_words_map(db, checkins) if checkins else {}
    pages_eff = effective_pages_map(db, checkins, words_eff) if checkins else {}

    by_day_full: dict[date, dict[str, int]] = {}
    for checkin in checkins:
        words = int(words_eff.get(checkin.id, checkin.words_delta))
        pages = int(pages_eff.get(checkin.id, checkin.pages_delta))
        minutes = int(checkin.reading_minutes) if checkin.reading_minutes else 0
        entry = by_day_full.setdefault(checkin.day, {"words": 0, "pages": 0, "minutes": 0})
        entry["words"] += words
        entry["pages"] += pages
        entry["minutes"] += minutes

    by_day = [
        StatsDayPoint(day=day, words=entry["words"], pages=entry["pages"], minutes=entry["minutes"])
        for day, entry in sorted(by_day_full.items())
        if heatmap_start <= day <= heatmap_end
    ]

    # Words series still uses book-level allocation (same as _words_in_period),
    # but the heavy book/check-in load runs once for the full span.
    words_data = _load_words_period_data(db, span_start, span_end)

    by_month: list[StatsMonthPoint] = []
    for year, month in month_keys:
        start, end = month_range(year, month)
        words_total = _words_from_period_data(start, end, words_data)
        pages_total = 0
        minutes_total = 0
        for day, entry in by_day_full.items():
            if start <= day <= end:
                pages_total += entry["pages"]
                minutes_total += entry["minutes"]
        by_month.append(
            StatsMonthPoint(
                year=year,
                month=month,
                words=int(words_total),
                pages=int(pages_total),
                minutes=int(minutes_total),
            )
        )

    return StatsChartsOut(
        heatmap_start=heatmap_start,
        heatmap_end=heatmap_end,
        by_day=by_day,
        by_month=by_month,
    )


@router.get("/analytics", response_model=StatsAnalyticsOut)
def analytics(
    period: Literal["week", "month", "year", "all"] = "month",
    year: int | None = None,
    month: int | None = None,
    db: Session = Depends(db_session),
) -> StatsAnalyticsOut:
    ref = date.today()
    start, end = _analytics_period_range(period, year, month, ref, db)

    words_total = _words_in_period(start, end, db)
    pages_total = _pages_in_period(start, end, db)
    by_day, minutes_total, words_per_minute = _checkin_day_aggregates(start, end, db)

    reading_days = len(by_day)
    best_day_words = max((entry["words"] for entry in by_day.values()), default=0)
    best_day_pages = max((entry["pages"] for entry in by_day.values()), default=0)
    best_day_minutes = max((entry["minutes"] for entry in by_day.values()), default=0)

    days_with_time = [entry for entry in by_day.values() if entry["minutes"] > 0]
    minutes_per_day = (
        sum(entry["minutes"] for entry in days_with_time) / len(days_with_time)
        if days_with_time
        else None
    )

    finished_books = int(
        db.execute(select(func.count(Book.id)).where(Book.end_date >= start, Book.end_date <= end)).scalar_one()
    )

    return StatsAnalyticsOut(
        period_start=start,
        period_end=end,
        words_total=int(words_total),
        pages_total=int(pages_total),
        minutes_total=int(minutes_total),
        words_per_minute=float(words_per_minute) if words_per_minute is not None else None,
        minutes_per_day=float(minutes_per_day) if minutes_per_day is not None else None,
        reading_days=int(reading_days),
        finished_books=finished_books,
        best_day_words=int(best_day_words),
        best_day_pages=int(best_day_pages),
        best_day_minutes=int(best_day_minutes),
    )


@router.get("/checkin-days", response_model=CheckinDaysOut)
def checkin_days(
    year: int | None = None,
    month: int | None = None,
    db: Session = Depends(db_session),
) -> CheckinDaysOut:
    stmt = select(Checkin.day).distinct().order_by(Checkin.day.asc())
    start = end = None
    if year is not None:
        if month is None:
            start, end = year_range(year)
        else:
            if month < 1 or month > 12:
                raise HTTPException(status_code=400, detail="month must be 1..12")
            start, end = month_range(year, month)
        stmt = stmt.where(Checkin.day >= start, Checkin.day <= end)

    days = list(db.execute(stmt).scalars().all())
    if start is None:
        start = days[0] if days else date.today()
        end = days[-1] if days else date.today()
    return CheckinDaysOut(period_start=start, period_end=end, days=days)

