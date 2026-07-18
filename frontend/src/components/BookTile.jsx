import React from "react";
import {
  bookStatusLabel,
  formatBookTitle,
  formatReadingDuration,
  formatNumber
} from "../bookStatus.js";
import { useLocale } from "../i18n/LocaleContext.jsx";
import BookCoverThumb from "./BookCoverThumb.jsx";
import { ClockIcon } from "./MetaIcon.jsx";

export default function BookTile({ book, onSelect }) {
  const { locale, t } = useLocale();
  const progress = Math.min(100, Math.max(0, book.progress_percent));

  return (
    <button type="button" className="bookTile" onClick={() => onSelect?.(book)}>
      <div className="bookTileCoverWrap">
        <BookCoverThumb book={book} className="bookTileCover" />
        <div className="bookTileProgressTrack">
          <div className="bookTileProgressFill" style={{ width: `${progress}%` }} />
        </div>
        <div className="bookTileOverlay">
          <div className="bookTileOverlayInner">
            <div className="bookTileOverlayTitle">{formatBookTitle(book.title, book.volume)}</div>
            <div className="bookTileOverlayRow">
              <span className="bookTileOverlayIcon" aria-hidden="true">
                ✎
              </span>
              <span>{book.author}</span>
            </div>
            {book.volume ? (
              <div className="bookTileOverlayRow">
                <span className="bookTileOverlayIcon" aria-hidden="true">
                  ▤
                </span>
                <span>{book.volume}</span>
              </div>
            ) : null}
            <div className="bookTileOverlayRow">
              <span className="bookTileOverlayIcon" aria-hidden="true">
                ◔
              </span>
              <span>{t("common.percentRead", { percent: Math.round(progress) })}</span>
            </div>
            <div className="bookTileOverlayRow">
              <span className="bookTileOverlayIcon" aria-hidden="true">
                Aa
              </span>
              <span>
                {formatNumber(book.words_total, locale)} {t("common.wordsLower")}
              </span>
            </div>
            {book.pages_total != null && book.pages_total > 0 ? (
              <div className="bookTileOverlayRow">
                <span className="bookTileOverlayIcon" aria-hidden="true">
                  ≡
                </span>
                <span>
                  {formatNumber(book.pages_total, locale)} {t("common.pagesLower")}
                </span>
              </div>
            ) : null}
            <div className="bookTileOverlayRow">
              <ClockIcon className="bookTileOverlayIcon" />
              <span>{formatReadingDuration(book.reading_minutes_total)}</span>
            </div>
            <div className={`pill pillStatus pillStatus--${book.status} bookTileStatus`}>
              {bookStatusLabel(book.status, t)}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
