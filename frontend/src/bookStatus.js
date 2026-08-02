/** Book status labels, filters, and reading-date formatting. */

import { formatCalendarDayLabel as formatCalendarDayLabelI18n, formatNumber, intlLocale, pluralWord } from "./i18n/format.js";

export function bookStatusOptions(t) {
  return [
    { value: "planned", label: t("bookStatus.planned") },
    { value: "reading", label: t("bookStatus.reading") },
    { value: "finished", label: t("bookStatus.finished") },
    { value: "abandoned", label: t("bookStatus.abandoned") }
  ];
}

export function bookStatusFilterOptions(t) {
  return [{ value: "", label: t("bookStatus.allStatuses") }, ...bookStatusOptions(t)];
}

export function bookStatusLabel(status, t) {
  return bookStatusOptions(t).find((option) => option.value === status)?.label || status;
}

export function bookSeriesLabel(series, title) {
  if (!series) return null;
  if (series.trim() === (title || "").trim()) return null;
  return series;
}

export function formatBookNumber(number, t) {
  if (number == null || number === "") return null;
  return t("common.volLabel", { number });
}

export function formatBookTitle(title, number, series, t) {
  return [bookSeriesLabel(series, title), title, formatBookNumber(number, t)].filter(Boolean).join(" — ");
}

export function formatReadingDates(book, t) {
  const parts = [];
  if (book.start_date) parts.push(t("common.fromDate", { date: book.start_date }));
  if (book.end_date) parts.push(t("common.toDate", { date: book.end_date }));
  return parts.length ? parts.join(" • ") : null;
}

export function formatReadingTimeHours(minutes, t) {
  if (minutes == null || minutes <= 0) return null;
  const hours = minutes / 60;
  if (minutes % 60 === 0) return t("common.hoursShort", { hours });
  const rounded = Math.round(hours * 10) / 10;
  return t("common.hoursShort", { hours: rounded });
}

export function formatReadingDuration(minutes) {
  if (minutes == null || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatWordCount(value, locale) {
  return formatNumber(value, locale);
}

export function formatCheckinWords(checkin, locale) {
  const words = checkin.effective_words ?? checkin.words_delta;
  const formatted = formatNumber(words, locale);
  return checkin.words_estimated ? `≈${formatted}` : formatted;
}

export function formatCheckinPages(checkin, locale) {
  const pages = checkin.effective_pages ?? checkin.pages_delta;
  if (!pages || pages <= 0) return null;
  const formatted = formatNumber(pages, locale);
  return checkin.pages_estimated ? `≈${formatted}` : formatted;
}

export function formatReadingDaysLabel(count, locale, t) {
  const word = pluralWord(locale, count, "day", t);
  return t("calendar.readingDays", { count: formatNumber(count, locale), word });
}

export function formatStrikeDaysLabel(count, locale, t) {
  const word = pluralWord(locale, count, "day", t);
  return t("calendar.streak", { count: formatNumber(count, locale), word });
}

export function recentBooksForPicker(books, limit = 5) {
  return [...books]
    .filter((book) => book.last_checkin_day)
    .sort((a, b) => (b.last_checkin_day || "").localeCompare(a.last_checkin_day || ""))
    .slice(0, limit);
}

export function suggestCheckinBookId({ books, selectedDayIso, selectedCheckins, daySummaries, takenBookIds }) {
  const taken = takenBookIds || new Set();

  function isAvailable(bookId) {
    return bookId != null && !taken.has(bookId);
  }

  if (selectedDayIso && daySummaries) {
    const primaryId = daySummaries.get(selectedDayIso)?.primaryCheckin?.book_id;
    if (isAvailable(primaryId)) return String(primaryId);
  }

  if (selectedCheckins?.length) {
    const linked = selectedCheckins.filter((checkin) => checkin.book_id);
    if (linked.length === 1 && isAvailable(linked[0].book_id)) {
      return String(linked[0].book_id);
    }
    const latestLinked = linked[linked.length - 1];
    if (latestLinked && isAvailable(latestLinked.book_id)) {
      return String(latestLinked.book_id);
    }
  }

  const reading = books
    .filter((book) => book.status === "reading" && isAvailable(book.id))
    .sort((a, b) => (b.last_checkin_day || "").localeCompare(a.last_checkin_day || ""));

  if (reading[0]) return String(reading[0].id);
  return "";
}

export function formatRelativeDay(isoDay, t) {
  if (!isoDay) return "—";
  const day = new Date(`${isoDay}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diffDays = Math.round((today - day) / 86400000);
  if (diffDays === 0) return t("common.today");
  if (diffDays === 1) return t("common.yesterday");
  if (diffDays > 1 && diffDays < 7) return t("common.daysAgo", { count: diffDays });
  return isoDay;
}

export function filterLibraryBooks(books, query) {
  const q = query.trim().toLowerCase();
  if (!q) return books;
  return books.filter((book) => {
    const haystack = [
      book.title,
      book.author,
      book.series,
      book.number != null ? String(book.number) : null,
      book.number != null ? `Vol. ${book.number}` : null,
      book.number != null ? `Книга ${book.number}` : null,
      bookSeriesLabel(book.series, book.title),
      book.title
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

const LIBRARY_STATUS_ORDER = {
  reading: 0,
  finished: 1,
  planned: 2,
  abandoned: 3
};

function compareText(a, b, locale) {
  return (a || "").localeCompare(b || "", intlLocale(locale), { sensitivity: "base" });
}

function compareTitle(a, b, locale) {
  return compareText(a.title, b.title, locale);
}

function compareSeries(a, b, locale) {
  return compareText(a.series, b.series, locale);
}

function compareNumber(a, b) {
  const an = a.number;
  const bn = b.number;
  if (an == null && bn == null) return 0;
  if (an == null) return 1;
  if (bn == null) return -1;
  return an - bn;
}

function compareSeriesThenNumber(a, b, locale) {
  return compareSeries(a, b, locale) || compareNumber(a, b);
}

export function sortLibraryBooks(books, locale) {
  return [...books].sort((a, b) => {
    const statusDiff = (LIBRARY_STATUS_ORDER[a.status] ?? 99) - (LIBRARY_STATUS_ORDER[b.status] ?? 99);
    if (statusDiff !== 0) return statusDiff;

    if (a.status === "reading") {
      const aDay = a.last_checkin_day || "";
      const bDay = b.last_checkin_day || "";
      if (aDay !== bDay) return bDay.localeCompare(aDay);
    }

    const aEnd = a.end_date || "";
    const bEnd = b.end_date || "";
    if (aEnd || bEnd) {
      // Newest finished first; books without end_date after those with one.
      if (aEnd !== bEnd) return bEnd.localeCompare(aEnd);
    }

    if (a.status === "finished") {
      const aStart = a.start_date || "";
      const bStart = b.start_date || "";
      // Same end date: later start ranks higher (earlier start lower).
      if (aStart !== bStart) return bStart.localeCompare(aStart);
    }

    return compareSeriesThenNumber(a, b, locale);
  });
}

export function sortLibraryBooksBy(books, sortBy, locale) {
  const sorted = [...books];
  switch (sortBy) {
    case "title":
      return sorted.sort((a, b) => compareTitle(a, b, locale));
    case "series":
      return sorted.sort((a, b) => compareSeriesThenNumber(a, b, locale));
    case "author":
      return sorted.sort(
        (a, b) =>
          compareText(a.author, b.author, locale) || compareSeriesThenNumber(a, b, locale)
      );
    case "added":
      return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    case "progress":
      return sorted.sort(
        (a, b) => b.progress_percent - a.progress_percent || compareTitle(a, b, locale)
      );
    case "last_open":
      return sorted.sort(
        (a, b) =>
          (b.last_checkin_day || "").localeCompare(a.last_checkin_day || "") || compareTitle(a, b, locale)
      );
    default:
      return sortLibraryBooks(sorted, locale);
  }
}

export { formatNumber, formatCalendarDayLabelI18n as formatCalendarDayLabel };
