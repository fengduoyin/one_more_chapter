"""Book CRUD, cover uploads, and reading progress actions."""

from __future__ import annotations

import os
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.api.deps import db_session
from backend.app.models import Book, BookStatus, Checkin
from backend.app.progress import apply_deltas_to_book, book_progress_percent, resolve_progress_deltas
from backend.app.schemas import BookCreate, BookOut, BookProgressIn, BookUpdate
from backend.app.settings import settings
from backend.app.utils import clamp_int


router = APIRouter(prefix="/api/books", tags=["books"])


def _require_book(db: Session, book_id: int) -> Book:
    book = db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


def _checkin_stats_for_books(db: Session, book_ids: list[int]) -> dict[int, tuple[int, date | None]]:
    if not book_ids:
        return {}
    rows = db.execute(
        select(
            Checkin.book_id,
            func.coalesce(func.sum(Checkin.reading_minutes), 0),
            func.max(Checkin.day),
        )
        .where(Checkin.book_id.in_(book_ids))
        .group_by(Checkin.book_id)
    ).all()
    return {book_id: (int(minutes), last_day) for book_id, minutes, last_day in rows if book_id is not None}


def _book_to_out(
    book: Book,
    *,
    reading_minutes_total: int = 0,
    last_checkin_day: date | None = None,
) -> BookOut:
    cover_url = f"/uploads/{book.cover_path}" if book.cover_path else None
    pages_total = int(book.pages_total) if book.pages_total is not None else None
    progress_percent = book_progress_percent(
        words_total=int(book.words_total),
        words_read=int(book.words_read),
        pages_total=pages_total,
        pages_read=int(book.pages_read),
    )
    return BookOut(
        id=book.id,
        created_at=book.created_at,
        updated_at=book.updated_at,
        status=book.status,  # type: ignore[arg-type]
        author=book.author,
        title=book.title,
        volume=book.volume,
        words_total=int(book.words_total),
        pages_total=pages_total,
        description=book.description,
        cover_url=cover_url,
        start_date=book.start_date,
        end_date=book.end_date,
        review=book.review,
        words_read=int(book.words_read),
        pages_read=int(book.pages_read),
        progress_percent=float(progress_percent),
        reading_minutes_total=reading_minutes_total,
        last_checkin_day=last_checkin_day,
    )


def _book_to_out_from_db(db: Session, book: Book) -> BookOut:
    stats = _checkin_stats_for_books(db, [book.id])
    minutes, last_day = stats.get(book.id, (0, None))
    return _book_to_out(book, reading_minutes_total=minutes, last_checkin_day=last_day)


def _clamp_book_counters(book: Book) -> None:
    book.words_read = clamp_int(int(book.words_read), 0, int(book.words_total))
    if book.pages_total is not None and int(book.pages_total) > 0:
        book.pages_read = clamp_int(int(book.pages_read), 0, int(book.pages_total))
    else:
        book.pages_read = max(0, int(book.pages_read))


@router.get("", response_model=list[BookOut])
def list_books(status: str | None = None, db: Session = Depends(db_session)) -> list[BookOut]:
    stmt = select(Book).order_by(Book.created_at.desc())
    if status:
        stmt = stmt.where(Book.status == status)
    books = db.execute(stmt).scalars().all()
    stats = _checkin_stats_for_books(db, [b.id for b in books])
    return [
        _book_to_out(
            b,
            reading_minutes_total=stats.get(b.id, (0, None))[0],
            last_checkin_day=stats.get(b.id, (0, None))[1],
        )
        for b in books
    ]


@router.post("", response_model=BookOut)
def create_book(payload: BookCreate, db: Session = Depends(db_session)) -> BookOut:
    book = Book(
        status=payload.status,
        author=payload.author,
        title=payload.title,
        volume=payload.volume,
        words_total=payload.words_total,
        pages_total=payload.pages_total,
        description=payload.description,
    )
    db.add(book)
    db.commit()
    db.refresh(book)
    return _book_to_out_from_db(db, book)


@router.get("/{book_id}", response_model=BookOut)
def get_book(book_id: int, db: Session = Depends(db_session)) -> BookOut:
    return _book_to_out_from_db(db, _require_book(db, book_id))


@router.patch("/{book_id}", response_model=BookOut)
def update_book(book_id: int, payload: BookUpdate, db: Session = Depends(db_session)) -> BookOut:
    book = _require_book(db, book_id)

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(book, k, v)

    _clamp_book_counters(book)

    db.add(book)
    db.commit()
    db.refresh(book)
    return _book_to_out_from_db(db, book)


@router.delete("/{book_id}")
def delete_book(book_id: int, db: Session = Depends(db_session)) -> dict[str, str]:
    book = _require_book(db, book_id)
    db.delete(book)
    db.commit()
    return {"status": "deleted"}


@router.post("/{book_id}/cover", response_model=BookOut)
def upload_cover(
    book_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(db_session),
) -> BookOut:
    book = _require_book(db, book_id)

    content_type = (file.content_type or "").lower()
    if content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=400, detail="Only jpeg/png/webp covers are supported")

    ext = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }[content_type]

    out_dir = Path(settings.uploads_dir) / "covers" / str(book_id)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"cover{ext}"

    data = file.file.read()
    out_path.write_bytes(data)

    # store relative path under uploads mount
    rel_path = os.path.relpath(out_path, settings.uploads_dir)
    book.cover_path = rel_path.replace("\\", "/")
    db.add(book)
    db.commit()
    db.refresh(book)
    return _book_to_out_from_db(db, book)


def _merge_day_checkin(
    db: Session,
    *,
    day: date,
    book_id: int,
    words_delta: int,
    pages_delta: int = 0,
    reading_minutes: int | None = None,
    note: str | None,
) -> None:
    existing = db.execute(
        select(Checkin).where(Checkin.day == day, Checkin.book_id == book_id)
    ).scalar_one_or_none()
    if existing is None:
        db.add(
            Checkin(
                day=day,
                book_id=book_id,
                words_delta=words_delta,
                pages_delta=pages_delta,
                reading_minutes=reading_minutes,
                note=note,
            )
        )
        return

    existing.words_delta = int(existing.words_delta) + words_delta
    existing.pages_delta = int(existing.pages_delta) + pages_delta
    existing.book_id = book_id
    if reading_minutes is not None:
        existing.reading_minutes = int(existing.reading_minutes or 0) + reading_minutes
    if note:
        existing.note = note
    db.add(existing)


@router.post("/{book_id}/progress", response_model=BookOut)
def add_progress(book_id: int, payload: BookProgressIn, db: Session = Depends(db_session)) -> BookOut:
    book = _require_book(db, book_id)

    if payload.percent is None and payload.words_delta is None and payload.pages_delta is None:
        raise HTTPException(status_code=400, detail="Provide percent, words_delta, or pages_delta")

    if payload.words_delta is not None and payload.words_delta < 0:
        raise HTTPException(status_code=400, detail="words_delta must be >= 0")

    day = payload.day or date.today()
    pages_total = int(book.pages_total) if book.pages_total is not None else None

    if payload.percent is not None:
        deltas = resolve_progress_deltas(
            words_total=int(book.words_total),
            pages_total=pages_total,
            words_read=int(book.words_read),
            pages_read=int(book.pages_read),
            percent=payload.percent,
        )
    elif payload.words_delta is not None and payload.pages_delta is not None:
        deltas = resolve_progress_deltas(
            words_total=int(book.words_total),
            pages_total=pages_total,
            words_read=int(book.words_read),
            pages_read=int(book.pages_read),
            words_delta=payload.words_delta,
            pages_delta=payload.pages_delta,
        )
    elif payload.words_delta is not None:
        deltas = resolve_progress_deltas(
            words_total=int(book.words_total),
            pages_total=pages_total,
            words_read=int(book.words_read),
            pages_read=int(book.pages_read),
            words_delta=payload.words_delta,
        )
    else:
        deltas = resolve_progress_deltas(
            words_total=int(book.words_total),
            pages_total=pages_total,
            words_read=int(book.words_read),
            pages_read=int(book.pages_read),
            pages_delta=payload.pages_delta,
        )

    if deltas.words == 0 and deltas.pages == 0:
        return _book_to_out_from_db(db, book)

    apply_deltas_to_book(book, deltas.words, deltas.pages)
    if book.status == BookStatus.planned.value:
        book.status = BookStatus.reading.value
    if book.start_date is None:
        book.start_date = day

    if payload.record_checkin:
        _merge_day_checkin(
            db,
            day=day,
            book_id=book.id,
            words_delta=deltas.words,
            pages_delta=deltas.pages,
            reading_minutes=payload.reading_minutes,
            note=payload.note,
        )
    db.add(book)
    db.commit()
    db.refresh(book)
    return _book_to_out_from_db(db, book)


@router.post("/{book_id}/finish", response_model=BookOut)
def finish_book(book_id: int, day: date | None = None, db: Session = Depends(db_session)) -> BookOut:
    book = _require_book(db, book_id)

    d = day or date.today()
    book.status = BookStatus.finished.value
    if book.start_date is None:
        book.start_date = d
    book.end_date = d
    if int(book.words_total) > 0 and int(book.words_read) < int(book.words_total):
        book.words_read = int(book.words_total)
    if book.pages_total is not None and int(book.pages_total) > 0 and int(book.pages_read) < int(book.pages_total):
        book.pages_read = int(book.pages_total)
    _clamp_book_counters(book)

    db.add(book)
    db.commit()
    db.refresh(book)
    return _book_to_out_from_db(db, book)


@router.post("/{book_id}/abandon", response_model=BookOut)
def abandon_book(book_id: int, day: date | None = None, db: Session = Depends(db_session)) -> BookOut:
    book = _require_book(db, book_id)

    d = day or date.today()
    book.status = BookStatus.abandoned.value
    if book.start_date is None:
        book.start_date = d
    book.end_date = d

    db.add(book)
    db.commit()
    db.refresh(book)
    return _book_to_out_from_db(db, book)
