"""Estimate per-check-in word/page counts when explicit deltas are missing."""

from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models import Book, Checkin
from backend.app.progress import pages_from_words
from backend.app.utils import (
    CheckinDayEntry,
    allocate_reading_pages_by_day,
    allocate_reading_words_by_day,
    reading_end_date,
)


def _checkin_entries_for_book(db: Session, book_id: int) -> dict[date, CheckinDayEntry]:
    rows = db.execute(
        select(
            Checkin.day,
            Checkin.words_delta,
            Checkin.pages_delta,
            Checkin.reading_minutes,
        ).where(Checkin.book_id == book_id)
    ).all()
    return {
        day: CheckinDayEntry(
            words=int(words_delta),
            pages=int(pages_delta),
            minutes=int(reading_minutes) if reading_minutes is not None else None,
        )
        for day, words_delta, pages_delta, reading_minutes in rows
    }


def _books_for_checkins(db: Session, checkins: list[Checkin]) -> dict[int, Book]:
    book_ids = {c.book_id for c in checkins if c.book_id is not None}
    if not book_ids:
        return {}
    return {
        book.id: book for book in db.execute(select(Book).where(Book.id.in_(book_ids))).scalars().all()
    }


def effective_words_map(db: Session, checkins: list[Checkin]) -> dict[int, int]:
    books = _books_for_checkins(db, checkins)
    book_ids = set(books)

    allocation_by_book: dict[int, dict[date, int]] = {}
    for book_id in book_ids:
        book = books.get(book_id)
        if book is None or book.start_date is None:
            continue
        entries = _checkin_entries_for_book(db, book_id)
        allocation_by_book[book_id] = allocate_reading_words_by_day(
            int(book.words_read),
            book.start_date,
            reading_end_date(book.start_date, book.end_date),
            entries,
        ).by_day

    result: dict[int, int] = {}
    for checkin in checkins:
        stored = int(checkin.words_delta)
        if stored > 0:
            # Prefer what the user entered — same rule as pages.
            result[checkin.id] = stored
            continue
        if checkin.book_id is None or checkin.book_id not in allocation_by_book:
            result[checkin.id] = stored
            continue
        result[checkin.id] = allocation_by_book[checkin.book_id].get(checkin.day, stored)
    return result


def effective_pages_map(
    db: Session,
    checkins: list[Checkin],
    effective_words: dict[int, int] | None = None,
) -> dict[int, int]:
    """
    Resolve pages per check-in.

    Prefer stored pages_delta; otherwise allocate pages_read across days (like words);
    if pages_read is still empty, derive from effective words via book density.
    """
    books = _books_for_checkins(db, checkins)
    words_eff = effective_words if effective_words is not None else effective_words_map(db, checkins)

    page_allocation_by_book: dict[int, dict[date, int]] = {}
    for book_id, book in books.items():
        if book.start_date is None:
            continue
        pages_read = int(book.pages_read or 0)
        if pages_read <= 0:
            continue
        entries = _checkin_entries_for_book(db, book_id)
        page_allocation_by_book[book_id] = allocate_reading_pages_by_day(
            pages_read,
            book.start_date,
            reading_end_date(book.start_date, book.end_date),
            entries,
        ).by_day

    result: dict[int, int] = {}
    for checkin in checkins:
        stored = int(checkin.pages_delta)
        if stored > 0:
            result[checkin.id] = stored
            continue

        book = books.get(checkin.book_id) if checkin.book_id is not None else None
        if book is not None and checkin.book_id in page_allocation_by_book:
            allocated = page_allocation_by_book[checkin.book_id].get(checkin.day, 0)
            if allocated > 0:
                result[checkin.id] = allocated
                continue

        if book is not None:
            pages_total = int(book.pages_total) if book.pages_total is not None else None
            words = int(words_eff.get(checkin.id, checkin.words_delta))
            derived = pages_from_words(words, int(book.words_total), pages_total)
            if derived > 0:
                result[checkin.id] = derived
                continue

        result[checkin.id] = stored
    return result
