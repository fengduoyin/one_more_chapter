import React, { useEffect, useState } from "react";
import { apiGet } from "./api.js";
import BookAddModal from "./components/BookAddModal.jsx";
import BookDetail from "./components/BookDetail.jsx";
import CalendarPanel from "./components/CalendarPanel.jsx";
import GoalsTab from "./components/GoalsTab.jsx";
import LibraryPanel from "./components/LibraryPanel.jsx";
import LocaleToggle from "./components/LocaleToggle.jsx";
import StatisticsPanel from "./components/StatisticsPanel.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";
import { useLocale } from "./i18n/LocaleContext.jsx";

export default function App() {
  const { t } = useLocale();
  // Always open on Books; theme/locale are persisted separately.
  const [tab, setTab] = useState("library");
  const [status, setStatus] = useState(null);
  const [books, setBooks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showAddBook, setShowAddBook] = useState(false);

  async function reloadBooks(nextStatus = status) {
    const qs = nextStatus ? `?status=${encodeURIComponent(nextStatus)}` : "";
    const list = await apiGet(`/api/books${qs}`);
    setBooks(list);
  }

  async function reloadSummary() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    await apiGet(`/api/stats/summary?year=${year}&month=${month}`);
  }

  useEffect(() => {
    reloadBooks().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function upsertBook(updated) {
    setBooks((prev) => {
      const idx = prev.findIndex((b) => b.id === updated.id);
      if (idx === -1) return [updated, ...prev];
      const copy = prev.slice();
      copy[idx] = updated;
      return copy;
    });
    setSelected((s) => (s?.id === updated.id ? updated : s));
    reloadSummary().catch(() => {});
  }

  function removeBook(bookId) {
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
    setSelected((s) => (s?.id === bookId ? null : s));
    reloadSummary().catch(() => {});
  }

  return (
    <div className="page">
      <header className="header appHeader">
        <div>
          <div className="brand">{t("brand.title")}</div>
          <div className="muted">{t("brand.tagline")}</div>
        </div>
        <div className="row appNav">
          <ThemeToggle />
          <LocaleToggle />
          <button
            type="button"
            className={`appNavTab ${tab === "library" ? "btn" : "btnSecondary"}`}
            onClick={() => setTab("library")}
          >
            {t("nav.library")}
          </button>
          <button
            type="button"
            className={`appNavTab ${tab === "goals" ? "btn" : "btnSecondary"}`}
            onClick={() => setTab("goals")}
          >
            {t("nav.goals")}
          </button>
          <button
            type="button"
            className={`appNavTab ${tab === "calendar" ? "btn" : "btnSecondary"}`}
            onClick={() => setTab("calendar")}
          >
            {t("nav.calendar")}
          </button>
          <button
            type="button"
            className={`appNavTab ${tab === "statistics" ? "btn" : "btnSecondary"}`}
            onClick={() => setTab("statistics")}
          >
            {t("nav.statistics")}
          </button>
        </div>
      </header>

      {tab === "library" ? (
        <main className="card appMain libraryCard">
          <LibraryPanel
            books={books}
            status={status}
            onStatusChange={(next) => {
              setStatus(next);
              reloadBooks(next).catch(() => {});
            }}
            onReload={() => reloadBooks().catch(() => {})}
            onSelect={setSelected}
            onAddBook={() => setShowAddBook(true)}
          />
        </main>
      ) : tab === "goals" ? (
        <main className="card appMain statsCard">
          <GoalsTab />
        </main>
      ) : tab === "calendar" ? (
        <main className="card appMain statsCard">
          <CalendarPanel />
        </main>
      ) : (
        <main className="card appMain statsCard">
          <StatisticsPanel />
        </main>
      )}

      {showAddBook ? (
        <BookAddModal
          onClose={() => setShowAddBook(false)}
          onCreated={(book) => {
            upsertBook(book);
            reloadBooks().catch(() => {});
          }}
        />
      ) : null}

      {selected ? (
        <BookDetail
          book={selected}
          onClose={() => setSelected(null)}
          onChanged={(b) => upsertBook(b)}
          onDeleted={removeBook}
        />
      ) : null}
    </div>
  );
}
