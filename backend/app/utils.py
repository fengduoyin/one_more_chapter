"""Shared date helpers, reading-word allocation, and streak calculation."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta


def month_range(year: int, month: int) -> tuple[date, date]:
    """Inclusive calendar bounds for a month (1-based month index)."""
    start = date(year, month, 1)
    if month == 12:
        next_month = date(year + 1, 1, 1)
    else:
        next_month = date(year, month + 1, 1)
    end = next_month - timedelta(days=1)
    return start, end


def year_range(year: int) -> tuple[date, date]:
    """Inclusive calendar bounds for a calendar year."""
    return date(year, 1, 1), date(year, 12, 31)


def reading_end_date(
    start_date: date | None,
    end_date: date | None,
    *,
    today: date | None = None,
) -> date | None:
    """Last day of a reading interval; books still in progress end on today."""
    if start_date is None:
        return None
    return end_date or (today or date.today())


def clamp_int(value: int, min_value: int, max_value: int) -> int:
    return max(min_value, min(max_value, value))


def iter_dates(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


@dataclass(frozen=True)
class CheckinDayEntry:
    words: int = 0
    pages: int = 0
    minutes: int | None = None


@dataclass(frozen=True)
class ReadingAllocation:
    by_day: dict[date, int]


def _split_evenly(total: int, days: list[date]) -> dict[date, int]:
    # Spread remainder one unit at a time across the first N days.
    if not days:
        return {}
    per_day = total // len(days)
    remainder = total % len(days)
    allocation: dict[date, int] = {}
    for index, day in enumerate(days):
        allocation[day] = per_day + (1 if index < remainder else 0)
    return allocation


def _split_by_reading_minutes(
    total: int,
    days: list[date],
    minutes_by_day: dict[date, int | None],
) -> dict[date, int]:
    if not days:
        return {}

    weights = [max(0, int(minutes_by_day.get(day) or 0)) for day in days]
    weight_sum = sum(weights)
    if weight_sum <= 0:
        return _split_evenly(total, days)

    allocation: dict[date, int] = {}
    distributed = 0
    for index, day in enumerate(days):
        if index == len(days) - 1:
            allocation[day] = total - distributed
            continue
        share = (total * weights[index]) // weight_sum
        allocation[day] = share
        distributed += share
    return allocation


def _allocate_amount_by_day(
    total: int,
    reading_start: date,
    reading_end: date,
    checkins_by_day: dict[date, CheckinDayEntry],
    *,
    amount_of,
) -> ReadingAllocation:
    checkins_in_range = {
        day: entry
        for day, entry in checkins_by_day.items()
        if reading_start <= day <= reading_end
    }

    if not checkins_in_range:
        calendar_days = list(iter_dates(reading_start, reading_end))
        return ReadingAllocation(by_day=_split_evenly(int(total), calendar_days))

    checkin_days = sorted(checkins_in_range)
    minutes_by_day = {day: entry.minutes for day, entry in checkins_in_range.items()}
    specified = {day: amount_of(entry) for day, entry in checkins_in_range.items() if amount_of(entry) > 0}
    unspecified_days = [day for day in checkin_days if day not in specified]

    explicit_total = sum(specified.values())
    remaining = max(0, int(total) - explicit_total)

    allocation: dict[date, int] = {}
    for day, amount in specified.items():
        allocation[day] = amount

    if unspecified_days:
        split = _split_by_reading_minutes(remaining, unspecified_days, minutes_by_day)
        for day, amount in split.items():
            allocation[day] = amount
    elif remaining > 0 and len(checkin_days) == 1:
        allocation[checkin_days[0]] = int(total)

    return ReadingAllocation(by_day=allocation)


def allocate_reading_words_by_day(
    total_words: int,
    reading_start: date,
    reading_end: date,
    checkins_by_day: dict[date, CheckinDayEntry],
) -> ReadingAllocation:
    """Distribute book progress across days using explicit deltas, minutes, or even split."""
    return _allocate_amount_by_day(
        total_words,
        reading_start,
        reading_end,
        checkins_by_day,
        amount_of=lambda entry: entry.words,
    )


def allocate_reading_pages_by_day(
    total_pages: int,
    reading_start: date,
    reading_end: date,
    checkins_by_day: dict[date, CheckinDayEntry],
) -> ReadingAllocation:
    """Distribute book page progress across days (same rules as words)."""
    return _allocate_amount_by_day(
        total_pages,
        reading_start,
        reading_end,
        checkins_by_day,
        amount_of=lambda entry: entry.pages,
    )


def sum_words_in_period(allocation: dict[date, int], start: date, end: date) -> int:
    return sum(words for day, words in allocation.items() if start <= day <= end)


def sum_allocated_words_in_period(allocation: ReadingAllocation, start: date, end: date) -> int:
    return sum_words_in_period(allocation.by_day, start, end)


def strike_days(checkin_days: list[date], today: date) -> int:
    """Consecutive check-in days ending today or yesterday."""
    days = set(checkin_days)
    anchor = today if today in days else today - timedelta(days=1)
    if anchor not in days:
        return 0

    count = 0
    current = anchor
    while current in days:
        count += 1
        current -= timedelta(days=1)
    return count
