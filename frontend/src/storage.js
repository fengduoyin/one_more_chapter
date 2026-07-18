/** Safe localStorage access (SSR-safe, quota errors ignored). */

export function readStorage(key, allowed, fallback) {
  try {
    const stored = localStorage.getItem(key);
    if (allowed.includes(stored)) return stored;
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
