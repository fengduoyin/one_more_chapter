import React, { useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiJson, isoDate } from "../api.js";
import {
  buildDaySummaries,
  computeConnectedDaysInMonth,
  computeCurrentStreakDays,
  getMonthNames,
  groupConsecutiveDays,
  monthEndIso,
  monthStartIso
} from "../calendarUtils.js";
import {
  formatBookTitle,
  formatCalendarDayLabel,
  formatCheckinPages,
  formatCheckinWords,
  formatNumber,
  formatReadingDaysLabel,
  formatReadingTimeHours,
  formatStrikeDaysLabel,
  suggestCheckinBookId
} from "../bookStatus.js";
import { useLocale } from "../i18n/LocaleContext.jsx";
import BookCoverThumb from "./BookCoverThumb.jsx";
import BookPickerField from "./BookPickerField.jsx";
import MonthCalendar from "./MonthCalendar.jsx";
import MonthYearPicker from "./MonthYearPicker.jsx";
import ReadingRuns from "./ReadingRuns.jsx";

function CheckinTimelineItem({
  checkin,
  linkedBook,
  bookLabel,
  checkinBusy,
  onEdit,
  onRemove,
  locale,
  t
}) {
  return (
    <article className="calTimelineItem">
      {linkedBook ? (
        <BookCoverThumb book={linkedBook} className="calTimelineCover" />
      ) : (
        <div className="calTimelineCover calTimelineCoverStub">···</div>
      )}
      <div className="calTimelineBody">
        <div className="calTimelineTitle">
          {linkedBook ? bookLabel(linkedBook) : t("calendar.unlinked")}
        </div>
        <div className="muted calTimelineMeta">
          {formatCheckinWords(checkin, locale)} {t("common.wordsLower")}
          {formatCheckinPages(checkin, locale)
            ? ` · ${formatCheckinPages(checkin, locale)} ${t("common.pagesLower")}`
            : ""}
          {formatReadingTimeHours(checkin.reading_minutes, t)
            ? ` · ${formatReadingTimeHours(checkin.reading_minutes, t)}`
            : ""}
        </div>
        {checkin.note ? <div className="calTimelineNote">{checkin.note}</div> : null}
      </div>
      <div className="calTimelineActions">
        <button type="button" className="btnSecondary" disabled={checkinBusy} onClick={() => onEdit(checkin)}>
          {t("common.edit")}
        </button>
        <button
          type="button"
          className="btnSecondary"
          disabled={checkinBusy}
          onClick={() => onRemove(checkin.id)}
        >
          {t("common.delete")}
        </button>
      </div>
    </article>
  );
}

export default function CalendarPanel({ onBooksChanged }) {
  const { locale, t } = useLocale();
  const now = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => isoDate(now), [now]);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [summary, setSummary] = useState(null);
  const [finished, setFinished] = useState(null);
  const [days, setDays] = useState(null);
  const [monthCheckins, setMonthCheckins] = useState([]);

  const [selectedDayIso, setSelectedDayIso] = useState(null);
  const [books, setBooks] = useState([]);
  const [selectedCheckins, setSelectedCheckins] = useState([]);
  const [editingCheckinId, setEditingCheckinId] = useState(null);
  const [editCheckinWords, setEditCheckinWords] = useState("");
  const [editCheckinPages, setEditCheckinPages] = useState("");
  const [editCheckinMinutes, setEditCheckinMinutes] = useState("");
  const [editCheckinBookId, setEditCheckinBookId] = useState("");
  const [editCheckinNote, setEditCheckinNote] = useState("");
  const [checkinWords, setCheckinWords] = useState("");
  const [checkinPages, setCheckinPages] = useState("");
  const [checkinMinutes, setCheckinMinutes] = useState("");
  const [checkinBookId, setCheckinBookId] = useState("");
  const [checkinNote, setCheckinNote] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [checkinError, setCheckinError] = useState("");

  async function reloadMonth() {
    const from = monthStartIso(year, month);
    const to = monthEndIso(year, month);
    const [s, f, d, checkins] = await Promise.all([
      apiGet(`/api/stats/summary?year=${year}&month=${month}`),
      apiGet(`/api/stats/finished?year=${year}&month=${month}`),
      apiGet(`/api/stats/checkin-days?year=${year}&month=${month}`),
      apiGet(`/api/checkins?from_day=${from}&to_day=${to}`)
    ]);
    setSummary(s);
    setFinished(f);
    setDays(d);
    setMonthCheckins(checkins);
  }

  useEffect(() => {
    reloadMonth().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  useEffect(() => {
    apiGet("/api/books")
      .then(setBooks)
      .catch(() => setBooks([]));
  }, []);

  useEffect(() => {
    setSelectedDayIso(null);
    setShowAddForm(false);
  }, [year, month]);

  async function reloadDayCheckins(dayIso = selectedDayIso) {
    if (!dayIso) {
      setSelectedCheckins([]);
      return;
    }
    const rows = await apiGet(`/api/checkins?from_day=${dayIso}&to_day=${dayIso}`);
    setSelectedCheckins(rows);
  }

  useEffect(() => {
    setCheckinWords("");
    setCheckinPages("");
    setCheckinMinutes("");
    setCheckinBookId("");
    setCheckinNote("");
    setCheckinError("");
    setEditingCheckinId(null);
    setShowAddForm(false);

    if (!selectedDayIso) {
      setSelectedCheckins([]);
      return;
    }

    reloadDayCheckins(selectedDayIso).catch(() => setSelectedCheckins([]));
  }, [selectedDayIso]);

  const checkinDaysSet = useMemo(() => new Set(days?.days || []), [days]);
  const checkinRanges = useMemo(() => groupConsecutiveDays(days?.days || []), [days]);
  const daySummaries = useMemo(() => buildDaySummaries(monthCheckins), [monthCheckins]);

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const streakDaysSet = useMemo(() => {
    if (!isCurrentMonth) return new Set();
    return computeCurrentStreakDays(checkinDaysSet, todayIso);
  }, [isCurrentMonth, checkinDaysSet, todayIso]);

  const connectedDaysSet = useMemo(
    () => computeConnectedDaysInMonth(days?.days || [], year, month),
    [days, year, month]
  );

  const finishedDaysToBooks = useMemo(() => {
    const m = new Map();
    for (const b of finished?.books || []) {
      if (!b.end_date) continue;
      const arr = m.get(b.end_date) || [];
      arr.push(b);
      m.set(b.end_date, arr);
    }
    return m;
  }, [finished]);

  const selectedDayBooks = useMemo(() => {
    if (!selectedDayIso) return [];
    return finishedDaysToBooks.get(selectedDayIso) || [];
  }, [selectedDayIso, finishedDaysToBooks]);

  const booksById = useMemo(() => {
    const m = new Map();
    for (const b of books) m.set(b.id, b);
    return m;
  }, [books]);

  const checkinBookIds = useMemo(
    () => new Set(selectedCheckins.filter((c) => c.book_id).map((c) => c.book_id)),
    [selectedCheckins]
  );

  const suggestedBookId = useMemo(
    () =>
      suggestCheckinBookId({
        books,
        selectedDayIso,
        selectedCheckins,
        daySummaries,
        takenBookIds: checkinBookIds
      }),
    [books, selectedDayIso, selectedCheckins, daySummaries, checkinBookIds]
  );

  function bookLabel(book) {
    return `${book.author} — ${formatBookTitle(book.title, book.volume)}`;
  }

  const monthNames = useMemo(() => getMonthNames(locale, "full"), [locale]);
  const monthShort = useMemo(() => getMonthNames(locale, "short"), [locale]);
  const monthLabel = `${monthNames[month - 1]} ${year}`;
  const readingDaysCount = days?.days?.length || 0;

  function openAddForm() {
    setCheckinBookId(
      suggestCheckinBookId({
        books,
        selectedDayIso,
        selectedCheckins,
        daySummaries,
        takenBookIds: checkinBookIds
      })
    );
    setShowAddForm(true);
  }

  function goToToday() {
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setSelectedDayIso(todayIso);
  }

  function prevMonth() {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  function startEditCheckin(checkin) {
    setEditingCheckinId(checkin.id);
    setEditCheckinWords(String(checkin.words_delta));
    setEditCheckinPages(String(checkin.pages_delta || 0));
    setEditCheckinMinutes(checkin.reading_minutes != null ? String(checkin.reading_minutes) : "");
    setEditCheckinBookId(checkin.book_id ? String(checkin.book_id) : "");
    setEditCheckinNote(checkin.note || "");
    setCheckinError("");
    setShowAddForm(false);
  }

  function cancelEditCheckin() {
    setEditingCheckinId(null);
    setCheckinError("");
  }

  async function saveEditedCheckin(e) {
    e?.preventDefault?.();
    if (!editingCheckinId) return;

    setCheckinError("");
    setCheckinBusy(true);
    try {
      await apiJson("PATCH", `/api/checkins/${editingCheckinId}`, {
        book_id: editCheckinBookId ? Number(editCheckinBookId) : null,
        words_delta: Number(editCheckinWords || 0),
        pages_delta: Number(editCheckinPages || 0),
        reading_minutes: editCheckinMinutes.trim() ? Number(editCheckinMinutes) : null,
        note: editCheckinNote || null
      });
      setEditingCheckinId(null);
      await reloadDayCheckins();
      await reloadMonth();
      apiGet("/api/books")
        .then((list) => {
          setBooks(list);
          onBooksChanged?.();
        })
        .catch(() => {});
    } catch (err) {
      const message = String(err?.message || "");
      setCheckinError(
        message.includes("already exists")
          ? t("calendar.errCheckinExists")
          : t("calendar.errSaveCheckin")
      );
    } finally {
      setCheckinBusy(false);
    }
  }

  async function createCheckin(e) {
    e?.preventDefault?.();
    if (!selectedDayIso) return;

    setCheckinError("");
    setCheckinBusy(true);
    try {
      await apiJson("POST", "/api/checkins", {
        day: selectedDayIso,
        book_id: checkinBookId ? Number(checkinBookId) : null,
        words_delta: Number(checkinWords || 0),
        pages_delta: Number(checkinPages || 0),
        reading_minutes: checkinMinutes.trim() ? Number(checkinMinutes) : null,
        note: checkinNote || null
      });
      setCheckinWords("");
      setCheckinPages("");
      setCheckinMinutes("");
      setCheckinBookId("");
      setCheckinNote("");
      setShowAddForm(false);
      await reloadDayCheckins();
      await reloadMonth();
      apiGet("/api/books")
        .then((list) => {
          setBooks(list);
          onBooksChanged?.();
        })
        .catch(() => {});
    } catch (err) {
      const message = String(err?.message || "");
      setCheckinError(
        message.includes("already exists")
          ? t("calendar.errCheckinExists")
          : t("calendar.errCreateCheckin")
      );
      await reloadDayCheckins().catch(() => {});
    } finally {
      setCheckinBusy(false);
    }
  }

  async function removeCheckin(checkinId) {
    if (!checkinId) return;

    setCheckinError("");
    setCheckinBusy(true);
    try {
      await apiDelete(`/api/checkins/${checkinId}`);
      if (editingCheckinId === checkinId) setEditingCheckinId(null);
      await reloadDayCheckins();
      await reloadMonth();
      apiGet("/api/books")
        .then((list) => {
          setBooks(list);
          onBooksChanged?.();
        })
        .catch(() => {});
    } catch {
      setCheckinError(t("calendar.errDeleteCheckin"));
    } finally {
      setCheckinBusy(false);
    }
  }

  return (
    <div className="panelShell">
      <div className="panelShellBody calendarBody">
        <div className="calendarHead">
          <div className="calendarNav">
            <button type="button" className="btnSecondary" onClick={prevMonth} title={t("calendar.prevMonth")}>
              ←
            </button>
            <button type="button" className="btnSecondary" onClick={goToToday}>
              {t("calendar.today")}
            </button>
            <button type="button" className="btnSecondary" onClick={nextMonth} title={t("calendar.nextMonth")}>
              →
            </button>
            <MonthYearPicker
              year={year}
              month={month}
              label={monthLabel}
              onChange={({ year: nextYear, month: nextMonth }) => {
                setYear(nextYear);
                setMonth(nextMonth);
              }}
            />
          </div>
          <div className="calendarBadges">
            <span className="calendarBadge">{formatReadingDaysLabel(readingDaysCount, locale, t)}</span>
            {isCurrentMonth && summary?.current_strike_days ? (
              <span className="calendarBadge calendarBadgeStreak">
                {formatStrikeDaysLabel(summary.current_strike_days, locale, t)}
              </span>
            ) : null}
          </div>
          <div className="calendarMonthChips">
            {monthShort.map((label, index) => {
              const monthNumber = index + 1;
              const active = monthNumber === month;
              return (
                <button
                  key={label}
                  type="button"
                  className={active ? "calendarMonthChip calendarMonthChipActive" : "calendarMonthChip"}
                  onClick={() => setMonth(monthNumber)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="calWrap calWrapHybrid">
          <div className="calLeft">
            <MonthCalendar
              year={year}
              month={month}
              daySummaries={daySummaries}
              booksById={booksById}
              finishedDaysToBooks={finishedDaysToBooks}
              streakDaysSet={streakDaysSet}
              connectedDaysSet={connectedDaysSet}
              selectedIso={selectedDayIso}
              onSelect={setSelectedDayIso}
            />
            <ReadingRuns year={year} month={month} ranges={checkinRanges} />
          </div>

          <div className="calRight calDayPanel">
            {selectedDayIso ? (
              <>
                <div className="calDayPanelHead">
                  <div className="title">{formatCalendarDayLabel(selectedDayIso, locale, t)}</div>
                </div>

                {selectedDayBooks.length ? (
                  <section className="calDaySection calDaySectionFinished">
                    <div className="label">{t("calendar.finishedOnDay")}</div>
                    <div className="stack">
                      {selectedDayBooks.map((b) => {
                        const fullBook = booksById.get(b.id);
                        return (
                          <article key={b.id} className="calFinishedItem">
                            {fullBook ? (
                              <BookCoverThumb book={fullBook} className="calTimelineCover" />
                            ) : (
                              <div className="calTimelineCover calTimelineCoverStub">✓</div>
                            )}
                            <div className="calTimelineBody">
                              <div className="calTimelineTitle">{b.title}</div>
                              <div className="muted">{b.author}</div>
                              <div className="muted calTimelineMeta">
                                {formatNumber(b.words_total, locale)} {t("common.wordsLower")}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                {selectedCheckins.length ? (
                  <section className="calDaySection">
                    <div className="label">{t("calendar.entries")}</div>
                    <div className="calTimeline">
                      {selectedCheckins.map((checkin) => {
                        const linkedBook = checkin.book_id ? booksById.get(checkin.book_id) : null;
                        if (editingCheckinId === checkin.id) {
                          return (
                            <form
                              key={checkin.id}
                              className="cardInner goalEditForm calDayEditForm"
                              onSubmit={saveEditedCheckin}
                            >
                              <div className="formRow">
                                <label className="label">{t("common.words")}</label>
                                <input
                                  className="input"
                                  value={editCheckinWords}
                                  onChange={(e) => setEditCheckinWords(e.target.value)}
                                  inputMode="numeric"
                                  placeholder="0"
                                />
                              </div>
                              <div className="formRow">
                                <label className="label">{t("common.pages")}</label>
                                <input
                                  className="input"
                                  value={editCheckinPages}
                                  onChange={(e) => setEditCheckinPages(e.target.value)}
                                  inputMode="numeric"
                                  placeholder="0"
                                />
                              </div>
                              <div className="formRow">
                                <label className="label">{t("common.timeMinutes")}</label>
                                <input
                                  className="input"
                                  value={editCheckinMinutes}
                                  onChange={(e) => setEditCheckinMinutes(e.target.value)}
                                  inputMode="numeric"
                                  placeholder="90"
                                />
                              </div>
                              <div className="formRow">
                                <label className="label">{t("common.book")}</label>
                                <BookPickerField
                                  books={books}
                                  value={editCheckinBookId}
                                  onChange={setEditCheckinBookId}
                                  takenBookIds={checkinBookIds}
                                  allowBookId={checkin.book_id}
                                  suggestedBookId={suggestedBookId}
                                />
                              </div>
                              <div className="formRow">
                                <label className="label">{t("common.note")}</label>
                                <input
                                  className="input"
                                  value={editCheckinNote}
                                  onChange={(e) => setEditCheckinNote(e.target.value)}
                                  placeholder={t("common.shortNote")}
                                />
                              </div>
                              <div className="row calDayFormActions">
                                <button
                                  type="button"
                                  className="btnSecondary"
                                  disabled={checkinBusy}
                                  onClick={cancelEditCheckin}
                                >
                                  {t("common.cancel")}
                                </button>
                                <button type="submit" className="btn" disabled={checkinBusy}>
                                  {checkinBusy ? t("common.saving") : t("common.save")}
                                </button>
                              </div>
                            </form>
                          );
                        }

                        return (
                          <CheckinTimelineItem
                            key={checkin.id}
                            checkin={checkin}
                            linkedBook={linkedBook}
                            bookLabel={bookLabel}
                            checkinBusy={checkinBusy}
                            onEdit={startEditCheckin}
                            onRemove={removeCheckin}
                            locale={locale}
                            t={t}
                          />
                        );
                      })}
                    </div>
                  </section>
                ) : !selectedDayBooks.length ? (
                  <div className="muted calDayEmpty">{t("calendar.noEntries")}</div>
                ) : null}

                {!showAddForm && !editingCheckinId ? (
                  <button type="button" className="btnSecondary calDayAddBtn" onClick={openAddForm}>
                    {t("calendar.addEntry")}
                  </button>
                ) : null}

                {showAddForm ? (
                  <form className="cardInner calDayAddForm" onSubmit={createCheckin}>
                    <div className="title calDayAddTitle">{t("calendar.newEntry")}</div>
                    <div className="formRow">
                      <label className="label">{t("common.words")}</label>
                      <input
                        className="input"
                        value={checkinWords}
                        onChange={(e) => setCheckinWords(e.target.value)}
                        inputMode="numeric"
                        placeholder="0"
                      />
                    </div>
                    <div className="formRow">
                      <label className="label">{t("common.pages")}</label>
                      <input
                        className="input"
                        value={checkinPages}
                        onChange={(e) => setCheckinPages(e.target.value)}
                        inputMode="numeric"
                        placeholder="0"
                      />
                    </div>
                    <div className="formRow">
                      <label className="label">{t("common.timeMinutes")}</label>
                      <input
                        className="input"
                        value={checkinMinutes}
                        onChange={(e) => setCheckinMinutes(e.target.value)}
                        inputMode="numeric"
                        placeholder="90"
                      />
                    </div>
                    <div className="formRow">
                      <label className="label">{t("common.book")}</label>
                      <BookPickerField
                        books={books}
                        value={checkinBookId}
                        onChange={setCheckinBookId}
                        takenBookIds={checkinBookIds}
                        suggestedBookId={suggestedBookId}
                      />
                    </div>
                    <div className="formRow">
                      <label className="label">{t("common.note")}</label>
                      <input
                        className="input"
                        value={checkinNote}
                        onChange={(e) => setCheckinNote(e.target.value)}
                        placeholder={t("common.shortNote")}
                      />
                    </div>
                    <div className="row calDayFormActions">
                      <button
                        type="button"
                        className="btnSecondary"
                        disabled={checkinBusy}
                        onClick={() => {
                          setShowAddForm(false);
                          setCheckinError("");
                        }}
                      >
                        {t("common.cancel")}
                      </button>
                      <button type="submit" className="btn" disabled={checkinBusy}>
                        {checkinBusy ? t("common.saving") : t("common.save")}
                      </button>
                    </div>
                    {checkinError ? <div className="error">{checkinError}</div> : null}
                  </form>
                ) : null}
              </>
            ) : (
              <div className="calDayPanelEmpty">
                <div className="title">{t("calendar.day")}</div>
                <div className="muted">{t("calendar.dayHint")}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
