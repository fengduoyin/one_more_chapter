import { getMessageList } from "./messages.js";

export function plural(locale, count, forms) {
  const n = Math.abs(Number(count));
  if (locale === "en") {
    return n === 1 ? forms.one : forms.many;
  }

  const n100 = n % 100;
  const n10 = n % 10;
  if (n100 > 10 && n100 < 20) return forms.many;
  if (n10 > 1 && n10 < 5) return forms.few;
  if (n10 === 1) return forms.one;
  return forms.many;
}

export function intlLocale(locale) {
  return locale === "en" ? "en-US" : "ru-RU";
}

export function formatNumber(value, locale) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat(intlLocale(locale)).format(Number(value));
}

export function getMonthNames(locale, variant = "full") {
  return getMessageList(locale, variant === "short" ? "months.short" : "months.full");
}

export function getWeekdayLabels(locale, variant = "short") {
  return getMessageList(locale, variant === "heatmap" ? "weekdays.heatmap" : "weekdays.short");
}

export function pluralWord(locale, count, key, t) {
  const forms = {
    one: t(`plural.${key}.one`),
    few: t(`plural.${key}.few`),
    many: t(`plural.${key}.many`)
  };
  return plural(locale, count, forms);
}

export function formatCalendarDayLabel(iso, locale, t) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const months = getMonthNames(locale, "full");
  const month = months[m - 1] || String(m);
  if (locale === "en") {
    return t("calendar.dayLabel", { day: d, month, year: y });
  }
  return t("calendar.dayLabel", { day: d, month, year: y });
}
