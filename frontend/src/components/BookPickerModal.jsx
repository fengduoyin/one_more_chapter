import React, { useMemo, useState } from "react";
import {
  filterLibraryBooks,
  recentBooksForPicker,
  sortLibraryBooksBy
} from "../bookStatus.js";
import { useLocale } from "../i18n/LocaleContext.jsx";
import BookPickerTile from "./BookPickerTile.jsx";

export default function BookPickerModal({
  onClose,
  books,
  value,
  onChange,
  takenBookIds,
  allowBookId = null
}) {
  const { locale, t } = useLocale();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("reading");

  const quickFilters = useMemo(
    () => [
      { value: "reading", label: t("bookStatus.reading") },
      { value: "planned", label: t("bookStatus.planned") },
      { value: "", label: t("common.all") }
    ],
    [t]
  );

  const selectableBooks = useMemo(() => {
    return books.filter((book) => {
      if (allowBookId != null && book.id === allowBookId) return true;
      return !takenBookIds.has(book.id);
    });
  }, [books, takenBookIds, allowBookId]);

  const recentBooks = useMemo(() => recentBooksForPicker(selectableBooks, 5), [selectableBooks]);

  const visibleBooks = useMemo(() => {
    const searched = filterLibraryBooks(selectableBooks, search);
    const filtered = statusFilter ? searched.filter((book) => book.status === statusFilter) : searched;
    return sortLibraryBooksBy(filtered, "last_open", locale);
  }, [selectableBooks, search, statusFilter, locale]);

  const recentIds = useMemo(() => new Set(recentBooks.map((book) => book.id)), [recentBooks]);

  const gridBooks = useMemo(() => {
    if (!search.trim() && statusFilter === "reading") {
      return visibleBooks.filter((book) => !recentIds.has(book.id));
    }
    return visibleBooks;
  }, [visibleBooks, recentIds, search, statusFilter]);

  function pickBook(bookId) {
    onChange(bookId == null ? "" : String(bookId));
    onClose();
  }

  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div className="modal bookPickerModal" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div>
            <div className="title">{t("bookPicker.select")}</div>
            <div className="muted bookPickerModalHint">{t("bookPicker.hint")}</div>
          </div>
          <button type="button" className="btnGhost" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>

        <div className="bookPickerToolbar">
          <input
            className="input bookPickerSearch"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("bookPicker.searchPlaceholder")}
            autoFocus
          />
          <div className="bookPickerFilters">
            {quickFilters.map((filter) => (
              <button
                key={filter.value || "all"}
                type="button"
                className={
                  statusFilter === filter.value ? "bookPickerFilter bookPickerFilterActive" : "bookPickerFilter"
                }
                onClick={() => setStatusFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <button type="button" className="bookPickerUnlinked" onClick={() => pickBook(null)}>
          {t("bookPicker.unlinked")}
        </button>

        {!search.trim() && recentBooks.length ? (
          <section className="bookPickerSection">
            <div className="label">{t("bookPicker.recent")}</div>
            <div className="bookPickerRecent">
              {recentBooks.map((book) => (
                <BookPickerTile
                  key={book.id}
                  book={book}
                  selected={String(value) === String(book.id)}
                  onSelect={() => pickBook(book.id)}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section className="bookPickerSection bookPickerSectionScroll">
          <div className="label">
            {gridBooks.length
              ? statusFilter === "reading"
                ? t("bookPicker.readingNow")
                : statusFilter === "planned"
                  ? t("bookStatus.planned")
                  : t("bookPicker.allBooks")
              : t("bookPicker.notFound")}
          </div>
          {gridBooks.length ? (
            <div className="bookPickerGrid">
              {gridBooks.map((book) => (
                <BookPickerTile
                  key={book.id}
                  book={book}
                  selected={String(value) === String(book.id)}
                  onSelect={() => pickBook(book.id)}
                />
              ))}
            </div>
          ) : (
            <div className="muted bookPickerEmpty">{t("bookPicker.tryOther")}</div>
          )}
        </section>
      </div>
    </div>
  );
}
