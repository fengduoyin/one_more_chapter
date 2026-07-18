/** Theme persistence and data-theme attribute sync. */

import { readStorage, writeStorage } from "./storage.js";

const STORAGE_KEY = "reading-library-theme";
const THEMES = ["light", "dark"];

export function getInitialTheme() {
  return readStorage(STORAGE_KEY, THEMES, "dark");
}

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  writeStorage(STORAGE_KEY, theme);
}

export function initTheme() {
  applyTheme(getInitialTheme());
}

export function toggleTheme(theme) {
  const next = theme === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}
