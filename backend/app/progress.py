"""Resolve words/pages deltas and progress percent from book density."""

from __future__ import annotations

from dataclasses import dataclass

from backend.app.utils import clamp_int


@dataclass(frozen=True)
class ProgressDeltas:
    words: int
    pages: int


def book_progress_percent(
    *,
    words_total: int,
    words_read: int,
    pages_total: int | None,
    pages_read: int,
) -> float:
    """Prefer words when words_total > 0; otherwise fall back to pages."""
    if words_total > 0:
        return min(100.0, max(0.0, (words_read / words_total) * 100.0))
    if pages_total and pages_total > 0:
        return min(100.0, max(0.0, (pages_read / pages_total) * 100.0))
    return 0.0


def words_from_pages(pages: int, words_total: int, pages_total: int | None) -> int:
    if pages <= 0 or not pages_total or pages_total <= 0 or words_total <= 0:
        return 0
    return int(round(pages * words_total / pages_total))


def pages_from_words(words: int, words_total: int, pages_total: int | None) -> int:
    if words <= 0 or not pages_total or pages_total <= 0 or words_total <= 0:
        return 0
    return int(round(words * pages_total / words_total))


def resolve_progress_deltas(
    *,
    words_total: int,
    pages_total: int | None,
    words_read: int,
    pages_read: int,
    percent: float | None = None,
    words_delta: int | None = None,
    pages_delta: int | None = None,
) -> ProgressDeltas:
    """
    Convert check-in / progress input into word and page deltas.

    - percent → both counters to that share of totals
    - only words → derive pages via density when both totals exist
    - only pages → derive words via density when both totals exist
    - both words and pages → keep explicit values (no cross-derive)
    """
    pages_cap = int(pages_total) if pages_total and pages_total > 0 else None

    if percent is not None:
        new_words = clamp_int(int(round((percent / 100.0) * words_total)), 0, words_total) if words_total > 0 else 0
        new_pages = (
            clamp_int(int(round((percent / 100.0) * pages_cap)), 0, pages_cap) if pages_cap is not None else 0
        )
        return ProgressDeltas(
            words=max(0, new_words - int(words_read)),
            pages=max(0, new_pages - int(pages_read)),
        )

    words_in = int(words_delta) if words_delta is not None else None
    pages_in = int(pages_delta) if pages_delta is not None else None

    if words_in is not None and pages_in is not None:
        return ProgressDeltas(words=max(0, words_in), pages=max(0, pages_in))

    if words_in is not None:
        words = max(0, words_in)
        return ProgressDeltas(words=words, pages=pages_from_words(words, words_total, pages_total))

    if pages_in is not None:
        pages = max(0, pages_in)
        return ProgressDeltas(words=words_from_pages(pages, words_total, pages_total), pages=pages)

    return ProgressDeltas(words=0, pages=0)


def apply_deltas_to_book(book, words_delta: int, pages_delta: int) -> None:
    pages_cap = int(book.pages_total) if book.pages_total and int(book.pages_total) > 0 else None
    if words_delta:
        book.words_read = clamp_int(int(book.words_read) + words_delta, 0, int(book.words_total))
    if pages_delta and pages_cap is not None:
        book.pages_read = clamp_int(int(book.pages_read) + pages_delta, 0, pages_cap)
    elif pages_delta and pages_cap is None:
        book.pages_read = max(0, int(book.pages_read) + pages_delta)
