/** Safe localStorage access (SSR-safe, quota errors ignored). */

export function readStorage(key, allowed, fallback, legacyKeys = []) {
  try {
    for (const candidate of [key, ...legacyKeys]) {
      const stored = localStorage.getItem(candidate);
      if (allowed.includes(stored)) return stored;
    }
  } catch {
    // ignore storage errors
  }
  return fallback;
}

export function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage errors
  }
}
