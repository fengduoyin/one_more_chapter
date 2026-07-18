/** Statistics panel labels, period options, and chart data shaping. */

import { formatCalendarDayLabel, formatNumber, formatReadingDuration } from "./bookStatus.js";
import { getMonthNames, getWeekdayLabels, intlLocale, pluralWord } from "./i18n/format.js";

export function statsPeriodOptions(t) {
  return [
    { value: "week", label: t("stats.periodWeek") },
    { value: "month", label: t("stats.periodMonth") },
    { value: "year", label: t("stats.periodYear") },
    { value: "all", label: t("stats.periodAll") }
  ];
}

export function analyticsQuery(period, year, month) {
  const params = new URLSearchParams({ period });
  if (period === "month") {
    params.set("year", String(year));
    params.set("month", String(month));
  } else if (period === "year") {
    params.set("year", String(year));
  }
  return `/api/stats/analytics?${params.toString()}`;
}

export function chartsQuery(months = 12) {
  return `/api/stats/analytics/charts?months=${months}`;
}

export function shiftMonth(year, month, delta) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function formatStatsPeriodLabel(period, year, month, locale, t) {
  const months = getMonthNames(locale, "full");
  if (period === "week") return t("stats.periodLast7");
  if (period === "month") return months[month - 1] || String(month);
  if (period === "year") return String(year);
  return t("stats.periodAllTime");
}

export function formatReadingTimeLong(minutes, locale) {
  if (minutes == null || minutes <= 0) return locale === "en" ? "0 min" : "0 мин";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (locale === "en") {
    if (hours && mins) return `${hours} h ${mins} min`;
    if (hours) return `${hours} h`;
    return `${mins} min`;
  }
  if (hours && mins) return `${hours} ч ${mins} мин`;
  if (hours) return `${hours} ч`;
  return `${mins} мин`;
}

export function formatWordsPerMinute(value, locale) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const rounded = Math.round(Number(value) * 10) / 10;
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 1 }).format(rounded);
}

export function formatStatsHero(analytics, period, year, month, locale, t) {
  if (!analytics) return null;
  const periodLabel = formatStatsPeriodLabel(period, year, month, locale, t);
  const words = formatNumber(analytics.words_total, locale);
  const pages = formatNumber(analytics.pages_total ?? 0, locale);
  const time = formatReadingTimeLong(analytics.minutes_total, locale);
  return t("stats.hero", { period: periodLabel, words, pages, time });
}

export function formatStatsMetricTime(minutes, locale, t) {
  if (minutes == null || minutes <= 0) return "—";
  const hoursLabel = formatReadingTimeHours(minutes, t);
  if (hoursLabel) return hoursLabel;
  return formatReadingDuration(minutes);
}

function formatReadingTimeHours(minutes, t) {
  if (minutes == null || minutes <= 0) return null;
  const hours = minutes / 60;
  if (minutes % 60 === 0) return t("common.hoursShort", { hours });
  const rounded = Math.round(hours * 10) / 10;
  return t("common.hoursShort", { hours: rounded });
}

export function formatStatsMeta(analytics, locale, t) {
  if (!analytics) return null;
  const dayWord = pluralWord(locale, analytics.reading_days, "day", t);
  const days = t("stats.metaDays", {
    days: formatNumber(analytics.reading_days, locale),
    word: dayWord
  });
  if (!analytics.finished_books) return days;
  const bookWord = pluralWord(locale, analytics.finished_books, "book", t);
  const books = t("stats.metaBooks", {
    books: formatNumber(analytics.finished_books, locale),
    word: bookWord
  });
  return `${days} · ${books}`;
}

export function heatmapWeekdayLabels(locale) {
  return getWeekdayLabels(locale, "heatmap");
}

function parseIsoDate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfWeekMonday(date) {
  const copy = new Date(date);
  const weekday = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - weekday);
  return copy;
}

function endOfWeekSunday(date) {
  const copy = new Date(date);
  const weekday = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() + (6 - weekday));
  return copy;
}

export function buildHeatmapWeeks(heatmapStart, heatmapEnd, byDay, metric = "words") {
  if (!heatmapStart || !heatmapEnd) return [];

  const points = new Map((byDay || []).map((item) => [item.day, item]));
  const rangeStart = parseIsoDate(heatmapStart);
  const rangeEnd = parseIsoDate(heatmapEnd);
  const gridStart = startOfWeekMonday(rangeStart);
  const gridEnd = endOfWeekSunday(rangeEnd);
  const weeks = [];
  const cursor = new Date(gridStart);

  while (cursor <= gridEnd) {
    const week = [];
    for (let index = 0; index < 7; index += 1) {
      const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      const inRange = cursor >= rangeStart && cursor <= rangeEnd;
      const point = points.get(iso);
      week.push({
        day: iso,
        words: inRange ? Number(point?.words ?? 0) : 0,
        pages: inRange ? Number(point?.pages ?? 0) : 0,
        minutes: inRange ? Number(point?.minutes ?? 0) : 0,
        value: inRange ? Number(point?.[metric] ?? 0) : null,
        inRange
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}

export const HEATMAP_WORD_THRESHOLDS = [0, 3500, 7500, 11000];
export const HEATMAP_PAGE_THRESHOLDS = [0, 10, 25, 40];
export const HEATMAP_MINUTE_THRESHOLDS = [0, 20, 40, 60];

export function heatmapLevel(cell, metric = "words") {
  if (!cell?.inRange) return null;

  const words = Number(cell.words ?? 0);
  const pages = Number(cell.pages ?? 0);
  const minutes = Number(cell.minutes ?? 0);
  const value = metric === "minutes" ? minutes : metric === "pages" ? pages : words;
  const thresholds =
    metric === "minutes"
      ? HEATMAP_MINUTE_THRESHOLDS
      : metric === "pages"
        ? HEATMAP_PAGE_THRESHOLDS
        : HEATMAP_WORD_THRESHOLDS;

  if (value <= 0) return 1;

  if (value > thresholds[3]) return 5;
  if (value > thresholds[2]) return 4;
  if (value > thresholds[1]) return 3;
  return 2;
}

export function maxMonthMetric(byMonth, metric) {
  return Math.max(0, ...(byMonth || []).map((item) => Number(item[metric] ?? 0)));
}

export function getHeatmapDayDetails(cell, locale, t) {
  if (!cell?.inRange) return null;

  const words = Number(cell.words ?? 0);
  const pages = Number(cell.pages ?? 0);
  const minutes = Number(cell.minutes ?? 0);

  return {
    label: formatCalendarDayLabel(cell.day, locale, t),
    words,
    pages,
    minutes,
    empty: words <= 0 && pages <= 0 && minutes <= 0
  };
}

export function formatHeatmapTooltip(cell, locale, t) {
  if (!cell?.inRange) return undefined;

  const details = getHeatmapDayDetails(cell, locale, t);
  if (!details) return undefined;

  const parts = [details.label];
  if (details.words > 0) {
    parts.push(`${formatNumber(details.words, locale)} ${t("common.wordsLower")}`);
  }
  if (details.pages > 0) {
    parts.push(`${formatNumber(details.pages, locale)} ${t("common.pagesLower")}`);
  }
  if (details.minutes > 0) parts.push(formatReadingDuration(details.minutes));
  if (details.empty) parts.push(t("stats.noInfo"));

  return parts.join(" • ");
}
