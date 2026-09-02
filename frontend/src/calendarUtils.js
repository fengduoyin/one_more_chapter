/** Calendar grid helpers, streak ranges, and localized day labels. */

import { isoDate } from "./api.js";
import { getMonthNames } from "./i18n/format.js";

export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

export function monthStartIso(year, month) {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function monthEndIso(year, month) {
  const dim = daysInMonth(year, month);
  return `${year}-${String(month).padStart(2, "0")}-${String(dim).padStart(2, "0")}`;
}

export function parseIsoDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function groupConsecutiveDays(days) {
  if (!days?.length) return [];

  const sorted = [...days].sort();
  const ranges = [];
  let rangeStart = sorted[0];
  let rangeEnd = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const nextDay = sorted[i];
    const expected = parseIsoDate(rangeEnd);
    expected.setDate(expected.getDate() + 1);
    const expectedIso = isoDate(expected);

    if (nextDay === expectedIso) {
      rangeEnd = nextDay;
      continue;
    }

    ranges.push({ start: rangeStart, end: rangeEnd });
    rangeStart = nextDay;
    rangeEnd = nextDay;
  }

  ranges.push({ start: rangeStart, end: rangeEnd });
  return ranges;
}

export function rangeLength(range) {
  const start = parseIsoDate(range.start);
  const end = parseIsoDate(range.end);
  return Math.round((end - start) / 86400000) + 1;
}

export function buildDaySummaries(checkins) {
  const byDay = new Map();

  for (const checkin of checkins) {
    const day = checkin.day;
    if (!byDay.has(day)) {
      byDay.set(day, { checkins: [], totalMinutes: 0, extraBooks: 0, primaryCheckin: null });
    }
    const entry = byDay.get(day);
    entry.checkins.push(checkin);
    entry.totalMinutes += checkin.reading_minutes || 0;

    const candidateScore =
      (checkin.reading_minutes || 0) * 1000 + (checkin.effective_words ?? checkin.words_delta ?? 0);
    const currentScore = entry.primaryCheckin
      ? (entry.primaryCheckin.reading_minutes || 0) * 1000 +
        (entry.primaryCheckin.effective_words ?? entry.primaryCheckin.words_delta ?? 0)
      : -1;

    if (!entry.primaryCheckin || candidateScore > currentScore) {
      entry.primaryCheckin = checkin;
    }
  }

  for (const entry of byDay.values()) {
    const linked = entry.checkins.filter((c) => c.book_id).length;
    entry.extraBooks = Math.max(0, linked - 1);
  }

  return byDay;
}

export function computeCurrentStreakDays(checkinDaysSet, todayIso) {
  let d = parseIsoDate(todayIso);
  if (!checkinDaysSet.has(todayIso)) {
    d.setDate(d.getDate() - 1);
  }
  if (!checkinDaysSet.has(isoDate(d))) return new Set();

  const streak = new Set();
  for (;;) {
    const iso = isoDate(d);
    if (!checkinDaysSet.has(iso)) break;
    streak.add(iso);
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function computeConnectedDaysInMonth(checkinDays, year, month) {
  const set = new Set(checkinDays);
  const connected = new Set();
  const dim = daysInMonth(year, month);

  for (let day = 1; day <= dim; day++) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!set.has(iso)) continue;

    const prev = parseIsoDate(iso);
    prev.setDate(prev.getDate() - 1);
    const next = parseIsoDate(iso);
    next.setDate(next.getDate() + 1);

    if (set.has(isoDate(prev)) || set.has(isoDate(next))) {
      connected.add(iso);
    }
  }

  return connected;
}

export function clipRangeToMonth(range, year, month) {
  const start = monthStartIso(year, month);
  const end = monthEndIso(year, month);
  return {
    start: range.start < start ? start : range.start,
    end: range.end > end ? end : range.end
  };
}

export function rangesOverlappingMonth(days, year, month) {
  const start = monthStartIso(year, month);
  const end = monthEndIso(year, month);
  return groupConsecutiveDays(days).filter((range) => range.start <= end && range.end >= start);
}

export function runSegmentStyle(range, year, month) {
  const clipped = clipRangeToMonth(range, year, month);
  const dim = daysInMonth(year, month);
  const startDay = Number(clipped.start.split("-")[2]);
  const endDay = Number(clipped.end.split("-")[2]);
  const left = ((startDay - 1) / dim) * 100;
  const width = ((endDay - startDay + 1) / dim) * 100;
  return { left: `${left}%`, width: `${width}%` };
}

export { getMonthNames };
