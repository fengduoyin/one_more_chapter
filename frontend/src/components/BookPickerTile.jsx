import React from "react";
import { bookStatusLabel, formatBookTitle } from "../bookStatus.js";
import { useLocale } from "../i18n/LocaleContext.jsx";
import BookCoverThumb from "./BookCoverThumb.jsx";

export default function BookPickerTile({ book, selected = false, disabled = false, onSelect }) {
  const { t } = useLocale();

  return (
    <button
      type="button"
      className={[
        "bookPickerTile",
        selected ? "bookPickerTileSelected" : "",
        disabled ? "bookPickerTileDisabled" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      onClick={() => onSelect?.(book)}
      title={disabled ? t("bookPicker.alreadyMarked") : undefined}
    >
      <div className="bookPickerTileCover">
        <BookCoverThumb book={book} />
      </div>
      <div className="bookPickerTileMeta">
        <div className="bookPickerTileTitle">
          {formatBookTitle(book.title, book.number, book.series, t)}
        </div>
        <div className="muted bookPickerTileAuthor">{book.author}</div>
        <span className={`pill pillStatus pillStatus--${book.status} bookPickerTileStatus`}>
          {bookStatusLabel(book.status, t)}
        </span>
      </div>
    </button>
  );
}
