"""Daily reading check-in CRUD and book progress sync."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from backend.app.api.checkin_allocation import effective_pages_map, effective_words_map
from backend.app.api.deps import db_session
from backend.app.models import Book, Checkin
from backend.app.progress import apply_deltas_to_book, resolve_progress_deltas
from backend.app.schemas import CheckinCreate, CheckinOut, CheckinUpdate


router = APIRouter(prefix="/api/checkins", tags=["checkins"])


def _to_out(
    checkin: Checkin,
    effective_words: int | None = None,
    effective_pages: int | None = None,
) -> CheckinOut:
    stored_words = int(checkin.words_delta)
    stored_pages = int(checkin.pages_delta)
    words = stored_words if effective_words is None else effective_words
    pages = stored_pages if effective_pages is None else effective_pages
    return CheckinOut(
        id=checkin.id,
        created_at=checkin.created_at,
        day=checkin.day,
        book_id=checkin.book_id,
        words_delta=stored_words,
        pages_delta=stored_pages,
        effective_words=words,
        words_estimated=stored_words == 0 and words > 0,
        effective_pages=pages,
        pages_estimated=stored_pages == 0 and pages > 0,
        reading_minutes=int(checkin.reading_minutes) if checkin.reading_minutes is not None else None,
        note=checkin.note,
    )


def _resolve_stored_deltas(book: Book | None, words_delta: int, pages_delta: int) -> tuple[int, int]:
    if book is None:
        return max(0, int(words_delta)), max(0, int(pages_delta))
    pages_total = int(book.pages_total) if book.pages_total is not None else None
    words_in = words_delta if words_delta > 0 else None
    pages_in = pages_delta if pages_delta > 0 else None
    if words_in is None and pages_in is None:
        return 0, 0
    if words_in is not None and pages_in is not None:
        deltas = resolve_progress_deltas(
            words_total=int(book.words_total),
            pages_total=pages_total,
            words_read=0,
            pages_read=0,
            words_delta=words_in,
            pages_delta=pages_in,
        )
    elif words_in is not None:
        deltas = resolve_progress_deltas(
            words_total=int(book.words_total),
            pages_total=pages_total,
            words_read=0,
            pages_read=0,
            words_delta=words_in,
        )
    else:
        deltas = resolve_progress_deltas(
            words_total=int(book.words_total),
            pages_total=pages_total,
            words_read=0,
            pages_read=0,
            pages_delta=pages_in,
        )
    return deltas.words, deltas.pages


def _apply_book_deltas(db: Session, book_id: int | None, words_delta: int, pages_delta: int) -> None:
    if book_id is None or (words_delta == 0 and pages_delta == 0):
        return
    book = db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    apply_deltas_to_book(book, words_delta, pages_delta)
    db.add(book)


def _find_by_day_book(db: Session, day: date, book_id: int | None) -> Checkin | None:
    if book_id is None:
        return db.execute(
            select(Checkin).where(and_(Checkin.day == day, Checkin.book_id.is_(None)))
        ).scalar_one_or_none()
    return db.execute(select(Checkin).where(Checkin.day == day, Checkin.book_id == book_id)).scalar_one_or_none()


@router.get("", response_model=list[CheckinOut])
def list_checkins(
    from_day: date | None = None,
    to_day: date | None = None,
    db: Session = Depends(db_session),
) -> list[CheckinOut]:
    stmt = select(Checkin).order_by(Checkin.day.desc(), Checkin.id.desc())
    if from_day:
        stmt = stmt.where(Checkin.day >= from_day)
    if to_day:
        stmt = stmt.where(Checkin.day <= to_day)
    rows = db.execute(stmt).scalars().all()
    words_eff = effective_words_map(db, rows)
    pages_eff = effective_pages_map(db, rows, words_eff)
    return [_to_out(row, words_eff.get(row.id), pages_eff.get(row.id)) for row in rows]


@router.post("", response_model=CheckinOut)
def create_checkin(payload: CheckinCreate, db: Session = Depends(db_session)) -> CheckinOut:
    existing = _find_by_day_book(db, payload.day, payload.book_id)
    if existing:
        raise HTTPException(status_code=409, detail="Checkin for this day and book already exists")

    book = db.get(Book, payload.book_id) if payload.book_id is not None else None
    if payload.book_id is not None and book is None:
        raise HTTPException(status_code=404, detail="Book not found")

    words_delta, pages_delta = _resolve_stored_deltas(book, int(payload.words_delta), int(payload.pages_delta))
    if payload.book_id is not None:
        _apply_book_deltas(db, payload.book_id, words_delta, pages_delta)

    checkin = Checkin(
        day=payload.day,
        book_id=payload.book_id,
        words_delta=words_delta,
        pages_delta=pages_delta,
        reading_minutes=payload.reading_minutes,
        note=payload.note,
    )
    db.add(checkin)
    db.commit()
    db.refresh(checkin)
    words_eff = effective_words_map(db, [checkin])
    pages_eff = effective_pages_map(db, [checkin], words_eff)
    return _to_out(checkin, words_eff.get(checkin.id), pages_eff.get(checkin.id))


@router.patch("/{checkin_id}", response_model=CheckinOut)
def update_checkin(
    checkin_id: int,
    payload: CheckinUpdate,
    db: Session = Depends(db_session),
) -> CheckinOut:
    checkin = db.get(Checkin, checkin_id)
    if not checkin:
        raise HTTPException(status_code=404, detail="Checkin not found")

    data = payload.model_dump(exclude_unset=True)
    old_book_id = checkin.book_id
    old_words = int(checkin.words_delta)
    old_pages = int(checkin.pages_delta)

    new_book_id = data["book_id"] if "book_id" in data else checkin.book_id
    words_changed = "words_delta" in data
    pages_changed = "pages_delta" in data

    book = db.get(Book, new_book_id) if new_book_id is not None else None
    if new_book_id is not None and book is None:
        raise HTTPException(status_code=404, detail="Book not found")

    if (checkin.day, new_book_id) != (checkin.day, checkin.book_id):
        existing = _find_by_day_book(db, checkin.day, new_book_id)
        if existing and existing.id != checkin_id:
            raise HTTPException(status_code=409, detail="Checkin for this day and book already exists")

    if not words_changed and not pages_changed and new_book_id == old_book_id:
        new_words, new_pages = old_words, old_pages
    elif words_changed and pages_changed:
        new_words, new_pages = _resolve_stored_deltas(
            book, int(data["words_delta"]), int(data["pages_delta"])
        )
    elif words_changed:
        # Words edited alone: keep explicit pages if both were set; else derive pages.
        words_raw = int(data["words_delta"])
        if old_words > 0 and old_pages > 0:
            new_words, new_pages = words_raw, old_pages
        else:
            new_words, new_pages = _resolve_stored_deltas(book, words_raw, 0)
    elif pages_changed:
        pages_raw = int(data["pages_delta"])
        if old_words > 0 and old_pages > 0:
            new_words, new_pages = old_words, pages_raw
        else:
            new_words, new_pages = _resolve_stored_deltas(book, 0, pages_raw)
    else:
        # Book link changed without delta edits — re-resolve from stored values.
        new_words, new_pages = _resolve_stored_deltas(book, old_words, old_pages)

    _apply_book_deltas(db, old_book_id, -old_words, -old_pages)

    for key, value in data.items():
        if key in {"words_delta", "pages_delta"}:
            continue
        setattr(checkin, key, value)
    checkin.words_delta = new_words
    checkin.pages_delta = new_pages

    _apply_book_deltas(db, new_book_id, new_words, new_pages)

    db.add(checkin)
    db.commit()
    db.refresh(checkin)
    words_eff = effective_words_map(db, [checkin])
    pages_eff = effective_pages_map(db, [checkin], words_eff)
    return _to_out(checkin, words_eff.get(checkin.id), pages_eff.get(checkin.id))


@router.delete("/{checkin_id}")
def delete_checkin(checkin_id: int, db: Session = Depends(db_session)) -> dict[str, str]:
    checkin = db.get(Checkin, checkin_id)
    if not checkin:
        raise HTTPException(status_code=404, detail="Checkin not found")

    _apply_book_deltas(db, checkin.book_id, -int(checkin.words_delta), -int(checkin.pages_delta))

    db.delete(checkin)
    db.commit()
    return {"status": "deleted"}
