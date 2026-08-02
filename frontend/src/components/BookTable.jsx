import React from "react";
import {
  bookStatusLabel,
  formatBookTitle,
  formatNumber,
  formatReadingDuration,
  formatRelativeDay
} from "../bookStatus.js";
import { useLocale } from "../i18n/LocaleContext.jsx";
import BookCoverThumb from "./BookCoverThumb.jsx";
import { ClockIcon } from "./MetaIcon.jsx";

export default function BookTable({ books, onSelect }) {
  const { locale, t } = useLocale();

  return (
    <div className="libraryTableWrap">
      <table className="libraryTable">
        <colgroup>
          <col className="libraryTableColTitle" />
          <col className="libraryTableColProgress" />
          <col className="libraryTableColWords" />
          <col className="libraryTableColPages" />
          <col className="libraryTableColTime" />
          <col className="libraryTableColCheckin" />
          <col className="libraryTableColStatus" />
        </colgroup>
        <thead>
          <tr>
            <th>{t("library.colTitle")}</th>
            <th>{t("library.colProgress")}</th>
            <th>{t("library.colWords")}</th>
            <th>{t("library.colPages")}</th>
            <th>{t("library.colReadingTime")}</th>
            <th>{t("library.colLastCheckin")}</th>
            <th>{t("library.colStatus")}</th>
          </tr>
        </thead>
        <tbody>
          {books.map((book) => {
            const progress = Math.min(100, Math.max(0, book.progress_percent));
            return (
              <tr key={book.id} className="libraryTableRow" onClick={() => onSelect?.(book)}>
                <td>
                  <div className="libraryTableTitleCell">
                    <BookCoverThumb book={book} />
                    <div className="libraryTableTitleMeta">
                      <div className="libraryTableTitle">
                        {formatBookTitle(book.title, book.number, book.series, t)}
                      </div>
                      <div className="muted libraryTableAuthor">{book.author}</div>
                      {book.description ? (
                        <div className="muted libraryTableSynopsis">
                          {book.description.replace(/\s+/g, " ").trim()}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td>
                  <div className="libraryTableProgress">
                    <div className="libraryTableProgressValue">{Math.round(progress)}%</div>
                    <div className="progress libraryTableProgressBar">
                      <div className="progressBar" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </td>
                <td className="libraryTableNumeric">{formatNumber(book.words_total, locale)}</td>
                <td className="libraryTableNumeric">
                  {book.pages_total != null && book.pages_total > 0
                    ? formatNumber(book.pages_total, locale)
                    : t("common.dash")}
                </td>
                <td className="libraryTableNumeric">
                  <span className="libraryTableIconRow">
                    <ClockIcon className="libraryTableIcon" />
                    <span className="libraryTableIconValue">
                      {formatReadingDuration(book.reading_minutes_total)}
                    </span>
                  </span>
                </td>
                <td className="libraryTableMuted">{formatRelativeDay(book.last_checkin_day, t)}</td>
                <td>
                  <span className={`pill pillStatus pillStatus--${book.status}`}>{bookStatusLabel(book.status, t)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
