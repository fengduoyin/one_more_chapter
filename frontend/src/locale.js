/** Locale persistence and <html lang> attribute sync. */

import { readStorage, writeStorage } from "./storage.js";

const STORAGE_KEY = "reading-library-locale";

export const LOCALES = ["ru", "en"];

export function getInitialLocale() {
  return readStorage(STORAGE_KEY, LOCALES, "ru");
}

export function applyLocale(locale) {
  const next = LOCALES.includes(locale) ? locale : "ru";
  document.documentElement.setAttribute("lang", next);
  writeStorage(STORAGE_KEY, next);
  return next;
}

export function initLocale() {
  return applyLocale(getInitialLocale());
}

export function toggleLocale(locale) {
  const next = locale === "ru" ? "en" : "ru";
  return applyLocale(next);
}
