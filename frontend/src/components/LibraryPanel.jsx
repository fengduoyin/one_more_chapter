import React, { useMemo, useState } from "react";
import {
  bookStatusLabel,
  bookStatusFilterOptions,
  filterLibraryBooks,
  sortLibraryBooksBy
} from "../bookStatus.js";
import { useLocale } from "../i18n/LocaleContext.jsx";
import BookTable from "./BookTable.jsx";
import BookTile from "./BookTile.jsx";
import SelectMenu from "./SelectMenu.jsx";

const VIEW_STORAGE_KEY = "libraryViewMode";

function loadViewMode() {
  try {
    const value = localStorage.getItem(VIEW_STORAGE_KEY);
    return value === "table" ? "table" : "grid";
  } catch {
    return "grid";
  }
}

export default function LibraryPanel({
  books,
  status,
  onStatusChange,
  onReload,
  onSelect,
  onAddBook
}) {
  const { locale, t } = useLocale();
  const [viewMode, setViewMode] = useState(loadViewMode);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("default");

  const sortOptions = useMemo(
    () => [
      { value: "default", label: t("library.sortStatus") },
      { value: "title", label: t("library.sortTitle") },
      { value: "author", label: t("library.sortAuthor") },
      { value: "added", label: t("library.sortAdded") },
      { value: "progress", label: t("library.sortProgress") },
      { value: "last_open", label: t("library.sortLastCheckin") }
    ],
    [t]
  );

  const filteredTitle = useMemo(() => {
    if (!status) return t("nav.library");
    return bookStatusLabel(status, t);
  }, [status, t]);

  const visibleBooks = useMemo(() => {
    const filtered = filterLibraryBooks(books, search);
    return sortLibraryBooksBy(filtered, sortBy, locale);
  }, [books, search, sortBy, locale]);

  function switchView(mode) {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }

  return (
    <div className="panelShell">
      <div className="panelShellHead">
        <div className="libraryHeader">
          <div className="title">{filteredTitle}</div>
          <div className="row libraryHeaderActions">
            <button type="button" className="btn" onClick={onAddBook}>
              {t("library.addBook")}
            </button>
            <button type="button" className="btnSecondary" onClick={onReload}>
              {t("library.refresh")}
            </button>
          </div>
        </div>

        <div className="libraryToolbar">
          <input
            className="input librarySearch"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("library.searchPlaceholder")}
          />
          <SelectMenu
            className="libraryFilter"
            value={status ?? ""}
            onChange={(next) => onStatusChange(next || null)}
            options={bookStatusFilterOptions(t)}
          />
          <SelectMenu className="librarySort" value={sortBy} onChange={setSortBy} options={sortOptions} />
          <div className="viewToggle" role="group" aria-label={t("library.viewMode")}>
            <button
              type="button"
              className={viewMode === "table" ? "viewToggleBtn active" : "viewToggleBtn"}
              onClick={() => switchView("table")}
              title={t("library.tableView")}
            >
              ☰
            </button>
            <button
              type="button"
              className={viewMode === "grid" ? "viewToggleBtn active" : "viewToggleBtn"}
              onClick={() => switchView("grid")}
              title={t("library.gridView")}
            >
              ⊞
            </button>
          </div>
        </div>
      </div>

      <div className="panelShellBody libraryBody">
        {visibleBooks.length === 0 ? (
          <div className="muted libraryEmpty">
            {books.length === 0 ? t("library.empty") : t("library.notFound")}
          </div>
        ) : viewMode === "table" ? (
          <BookTable books={visibleBooks} onSelect={onSelect} />
        ) : (
          <div className="libraryGrid">
            {visibleBooks.map((book) => (
              <BookTile key={book.id} book={book} onSelect={onSelect} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
