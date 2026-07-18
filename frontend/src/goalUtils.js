/** Goal period helpers and progress display formatting. */

import { getMonthNames } from "./i18n/format.js";

export function periodTypeOptions(t) {
  return [
    { value: "month", label: t("goals.periodMonth") },
    { value: "year", label: t("goals.periodYear") }
  ];
}

export function metricOptions(t) {
  return [
    { value: "words", label: t("goals.metricWords") },
    { value: "pages", label: t("goals.metricPages") },
    { value: "books", label: t("goals.metricBooks") }
  ];
}

export function monthNameOptions(locale) {
  return getMonthNames(locale, "short").map((name, index) => ({
    value: String(index + 1),
    label: name
  }));
}

export function startOfMonth(year, month) {
  return new Date(year, month - 1, 1);
}

export function startOfYear(year) {
  return new Date(year, 0, 1);
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function goalPeriodStartIso(periodType, year, month) {
  if (periodType === "year") return isoDate(startOfYear(year));
  return isoDate(startOfMonth(year, month));
}

export function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatGoalPeriod(goal, locale, t) {
  const [y, m] = goal.period_start.split("-");
  if (goal.period_type === "year") return t("goals.yearLabel", { year: y });
  const months = getMonthNames(locale, "short");
  return `${months[Number(m) - 1]} ${y}`;
}

export function metricLabel(metric, t) {
  if (metric === "words") return t("goals.metricWords");
  if (metric === "pages") return t("goals.metricPages");
  return t("goals.metricBooks");
}

export function goalPeriodParts(goal) {
  const [y, m] = goal.period_start.split("-").map(Number);
  if (goal.period_type === "year") return { periodType: "year", year: y, month: 1 };
  return { periodType: "month", year: y, month: m };
}

export function goalPeriodEndDate(goal) {
  const [y, m] = goal.period_start.split("-").map(Number);
  if (goal.period_type === "year") return new Date(y, 11, 31);
  return new Date(y, m, 0);
}

export function isGoalPeriodEnded(goal, referenceDate = new Date()) {
  const end = goalPeriodEndDate(goal);
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  return today > end;
}

export function goalPercent(current, target) {
  if (!target) return 0;
  return (current / target) * 100;
}

export function goalStatusTone(item, referenceDate = new Date()) {
  const percent = goalPercent(item.current, item.goal.target);
  if (percent >= 100) return "done";
  if (isGoalPeriodEnded(item.goal, referenceDate)) return "missed";
  return "active";
}

export function sortGoalsByPeriodDesc(items) {
  return [...items].sort((a, b) => b.goal.period_start.localeCompare(a.goal.period_start));
}
