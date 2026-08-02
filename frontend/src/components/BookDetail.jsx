import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiDelete, apiJson, isoDate, uploadCover } from "../api.js";
import {
  bookStatusLabel,
  formatBookTitle,
  formatNumber,
  formatReadingDates,
  formatReadingDuration
} from "../bookStatus.js";
import { useLocale } from "../i18n/LocaleContext.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";
import BookCoverThumb from "./BookCoverThumb.jsx";
import { ClockIcon } from "./MetaIcon.jsx";
import ReadingTimer from "./ReadingTimer.jsx";

function bookFormState(book) {
  return {
    author: book.author,
    title: book.title,
    series: book.series || "",
    number: book.number != null ? String(book.number) : "",
    description: book.description || "",
    pagesTotal: book.pages_total != null ? String(book.pages_total) : "",
    startDate: book.start_date || "",
    endDate: book.end_date || ""
  };
}

export default function BookDetail({ book, onClose, onChanged, onDeleted }) {
  const { locale, t } = useLocale();
  const coverInputRef = useRef(null);
  const [percent, setPercent] = useState("");
  const [quickCheckinMode, setQuickCheckinMode] = useState("percent");
  const [quickCheckinValue, setQuickCheckinValue] = useState("");
  const [quickCheckinMinutes, setQuickCheckinMinutes] = useState("");
  const [editing, setEditing] = useState(false);
  const [author, setAuthor] = useState(book.author);
  const [title, setTitle] = useState(book.title);
  const [series, setSeries] = useState(book.series || "");
  const [number, setNumber] = useState(book.number != null ? String(book.number) : "");
  const [description, setDescription] = useState(book.description || "");
  const [pagesTotal, setPagesTotal] = useState(book.pages_total != null ? String(book.pages_total) : "");
  const [startDate, setStartDate] = useState(book.start_date || "");
  const [endDate, setEndDate] = useState(book.end_date || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [confirmCloseTimer, setConfirmCloseTimer] = useState(false);
  const [confirmCloseUnsaved, setConfirmCloseUnsaved] = useState(false);

  useEffect(() => {
    const next = bookFormState(book);
    setAuthor(next.author);
    setTitle(next.title);
    setSeries(next.series);
    setNumber(next.number);
    setDescription(next.description);
    setPagesTotal(next.pagesTotal);
    setStartDate(next.startDate);
    setEndDate(next.endDate);
  }, [book]);

  const baseline = useMemo(() => bookFormState(book), [book]);
  const isEditDirty = useMemo(() => {
    if (!editing) return false;
    return (
      author !== baseline.author ||
      title !== baseline.title ||
      series !== baseline.series ||
      number !== baseline.number ||
      description !== baseline.description ||
      pagesTotal !== baseline.pagesTotal ||
      startDate !== baseline.startDate ||
      endDate !== baseline.endDate
    );
  }, [
    editing,
    author,
    title,
    series,
    number,
    description,
    pagesTotal,
    startDate,
    endDate,
    baseline
  ]);

  const header = useMemo(
    () => `${book.author} — ${formatBookTitle(book.title, book.number, book.series, t)}`,
    [book.author, book.title, book.number, book.series, t]
  );
  const dates = useMemo(() => formatReadingDates(book, t), [book, t]);
  const quickCheckinWordsPreview = useMemo(() => {
    const raw = Number(quickCheckinValue);
    if (Number.isNaN(raw) || raw <= 0) return 0;
    if (quickCheckinMode === "percent") {
      return Math.round((raw / 100) * book.words_total);
    }
    if (quickCheckinMode === "pages" && book.pages_total > 0 && book.words_total > 0) {
      return Math.round(raw * book.words_total / book.pages_total);
    }
    if (quickCheckinMode === "words") return Math.round(raw);
    return 0;
  }, [quickCheckinMode, quickCheckinValue, book.words_total, book.pages_total]);

  const quickCheckinPagesPreview = useMemo(() => {
    const raw = Number(quickCheckinValue);
    if (Number.isNaN(raw) || raw <= 0) return 0;
    if (quickCheckinMode === "percent" && book.pages_total > 0) {
      return Math.round((raw / 100) * book.pages_total);
    }
    if (quickCheckinMode === "words" && book.pages_total > 0 && book.words_total > 0) {
      return Math.round(raw * book.pages_total / book.words_total);
    }
    if (quickCheckinMode === "pages") return Math.round(raw);
    return 0;
  }, [quickCheckinMode, quickCheckinValue, book.words_total, book.pages_total]);

  function resetQuickCheckinForm() {
    setQuickCheckinValue("");
    setQuickCheckinMinutes("");
  }

  function applyTimerMinutes(minutes) {
    setQuickCheckinMinutes((prev) => {
      const existing = Number(prev);
      if (prev.trim() && !Number.isNaN(existing) && existing > 0) {
        return String(existing + minutes);
      }
      return String(minutes);
    });
  }

  async function saveQuickCheckin(e) {
    e?.preventDefault?.();
    const raw = Number(quickCheckinValue);
    if (Number.isNaN(raw) || raw <= 0) {
      setError(t("bookDetail.errReadAmount"));
      return;
    }

    setBusy(true);
    setError("");
    try {
      const minutesRaw = quickCheckinMinutes.trim();
      const payload = {
        record_checkin: true,
        day: isoDate(new Date()),
        reading_minutes: minutesRaw ? Number(minutesRaw) : null
      };
      if (quickCheckinMode === "percent") {
        // Incremental share of the book (matches the preview), not absolute progress.
        const wordsDelta = Math.round((raw / 100) * book.words_total);
        const pagesDelta =
          book.pages_total > 0 ? Math.round((raw / 100) * book.pages_total) : 0;
        if (wordsDelta <= 0 && pagesDelta <= 0) {
          setError(t("bookDetail.errReadAmount"));
          setBusy(false);
          return;
        }
        if (wordsDelta > 0) payload.words_delta = wordsDelta;
        if (pagesDelta > 0) payload.pages_delta = pagesDelta;
      } else if (quickCheckinMode === "pages") {
        payload.pages_delta = Math.round(raw);
      } else {
        payload.words_delta = Math.round(raw);
      }
      const updated = await apiJson("POST", `/api/books/${book.id}/progress`, payload);
      resetQuickCheckinForm();
      onChanged?.(updated);
    } catch {
      setError(t("bookDetail.errSaveCheckin"));
    } finally {
      setBusy(false);
    }
  }

  function resetEditForm() {
    const next = bookFormState(book);
    setAuthor(next.author);
    setTitle(next.title);
    setSeries(next.series);
    setNumber(next.number);
    setDescription(next.description);
    setPagesTotal(next.pagesTotal);
    setStartDate(next.startDate);
    setEndDate(next.endDate);
    setEditing(false);
  }

  async function saveDetails(e) {
    e?.preventDefault?.();
    setBusy(true);
    setError("");
    try {
      const updated = await apiJson("PATCH", `/api/books/${book.id}`, {
        author,
        title,
        series: series.trim() || null,
        number: number.trim() ? Number(number) : null,
        description: description || null,
        pages_total: pagesTotal.trim() ? Number(pagesTotal) : null,
        start_date: startDate || null,
        end_date: endDate || null
      });
      onChanged?.(updated);
      setEditing(false);
    } catch {
      setError(t("bookDetail.errSaveBook"));
    } finally {
      setBusy(false);
    }
  }

  async function addProgress(recordCheckin = false) {
    const p = Number(percent);
    if (Number.isNaN(p)) return;
    setBusy(true);
    setError("");
    try {
      const payload = {
        percent: p,
        record_checkin: recordCheckin
      };
      if (recordCheckin) {
        payload.day = isoDate(new Date());
      }
      const updated = await apiJson("POST", `/api/books/${book.id}/progress`, payload);
      setPercent("");
      onChanged?.(updated);
    } catch {
      setError(recordCheckin ? t("bookDetail.errRecordCheckin") : t("bookDetail.errUpdateProgress"));
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    setError("");
    try {
      const updated = await apiJson("POST", `/api/books/${book.id}/finish`, null);
      onChanged?.(updated);
    } catch {
      setError(t("bookDetail.errFinish"));
    } finally {
      setBusy(false);
    }
  }

  async function abandon() {
    setBusy(true);
    setError("");
    try {
      const updated = await apiJson("POST", `/api/books/${book.id}/abandon`, null);
      onChanged?.(updated);
    } catch {
      setError(t("bookDetail.errAbandon"));
    } finally {
      setBusy(false);
    }
  }

  async function saveCover(file) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const updated = await uploadCover(book.id, file);
      onChanged?.(updated);
    } catch {
      setError(t("bookDetail.errUploadCover"));
    } finally {
      setBusy(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  }

  async function deleteBook() {
    setBusy(true);
    setError("");
    try {
      await apiDelete(`/api/books/${book.id}`);
      setConfirmDelete(false);
      onDeleted?.(book.id);
    } catch {
      setError(t("library.errDelete"));
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  }

  function requestClose() {
    if (timerRunning) {
      setConfirmCloseTimer(true);
      return;
    }
    if (isEditDirty) {
      setConfirmCloseUnsaved(true);
      return;
    }
    onClose();
  }

  return (
    <div className="modalBackdrop" onClick={requestClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div>
            <div className="title">{header}</div>
            <div className="row bookDetailMetaRow">
              <div className={`pill pillStatus pillStatus--${book.status}`}>{bookStatusLabel(book.status, t)}</div>
              <div className="muted bookDetailMetaText">
                {t("bookDetail.wordsProgress", {
                  read: formatNumber(book.words_read, locale),
                  total: formatNumber(book.words_total, locale)
                })}
                {book.pages_total != null && book.pages_total > 0
                  ? ` • ${t("bookDetail.pagesProgress", {
                      read: formatNumber(book.pages_read, locale),
                      total: formatNumber(book.pages_total, locale)
                    })}`
                  : ""}
                {` • ${Math.round(book.progress_percent)}%`}
              </div>
              <div className="muted bookDetailMetaText bookDetailMetaTime">
                <ClockIcon className="bookDetailMetaIcon" />
                <span>{formatReadingDuration(book.reading_minutes_total)}</span>
              </div>
              {dates ? <div className="muted bookDetailMetaText">{dates}</div> : null}
            </div>
          </div>
          <div className="row bookDetailHeaderActions">
            <button
              type="button"
              className="btnSecondary btnDangerOutline"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
            >
              {t("library.deleteBook")}
            </button>
            <button className="btnGhost" onClick={requestClose}>
              {t("common.close")}
            </button>
          </div>
        </div>

        <div className="bookDetailTextRow">
          <div className="cardInner bookDetailPanel">
            <div className="row bookDetailPanelHeader">
              <div className="title">{t("bookDetail.about")}</div>
              {!editing ? (
                <button type="button" className="btnSecondary" disabled={busy} onClick={() => setEditing(true)}>
                  {t("common.edit")}
                </button>
              ) : null}
            </div>

            <div className="bookDetailPanelBody">
              {editing ? (
                <form className="form bookDetailPanelForm" onSubmit={saveDetails}>
                  <div className="grid2">
                    <div className="formRow">
                      <label className="label">{t("common.author")}</label>
                      <input className="input" value={author} onChange={(e) => setAuthor(e.target.value)} required />
                    </div>
                    <div className="formRow">
                      <label className="label">{t("common.title")}</label>
                      <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
                    </div>
                  </div>
                  <div className="grid2">
                    <div className="formRow">
                      <label className="label">{t("common.series")}</label>
                      <input
                        className="input"
                        value={series}
                        onChange={(e) => setSeries(e.target.value)}
                        placeholder={t("common.optional")}
                      />
                    </div>
                    <div className="formRow">
                      <label className="label">{t("common.number")}</label>
                      <input
                        className="input"
                        value={number}
                        onChange={(e) => setNumber(e.target.value)}
                        inputMode="numeric"
                        placeholder={t("common.optional")}
                      />
                    </div>
                  </div>
                  <div className="formRow">
                    <label className="label">{t("common.description")}</label>
                    <textarea
                      className="textarea bookDetailPanelTextarea"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t("common.shortDescription")}
                    />
                  </div>
                  <div className="formRow">
                    <label className="label">{t("library.pagesTotal")}</label>
                    <input
                      className="input"
                      value={pagesTotal}
                      onChange={(e) => setPagesTotal(e.target.value)}
                      inputMode="numeric"
                      placeholder={t("common.optional")}
                    />
                  </div>
                  <div className="grid2">
                    <div className="formRow">
                      <label className="label">{t("common.startDate")}</label>
                      <input
                        className="input"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="formRow">
                      <label className="label">{t("common.endDate")}</label>
                      <input
                        className="input"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="row bookDetailPanelActions">
                    <button type="button" className="btnSecondary" disabled={busy} onClick={resetEditForm}>
                      {t("common.cancel")}
                    </button>
                    <button type="button" className="btn" disabled={busy} onClick={saveDetails}>
                      {busy ? t("common.saving") : t("common.save")}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {book.description ? <div className="bookDetailDesc">{book.description}</div> : null}
                  {!book.description ? <div className="muted">{t("bookDetail.noDescription")}</div> : null}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="cardInner bookDetailActions">
          <div className="bookDetailCoverCol">
            <div className="bookDetailCover">
              <BookCoverThumb book={book} />
            </div>
            <input
              ref={coverInputRef}
              className="fileInputHidden"
              type="file"
              accept="image/*"
              onChange={(e) => saveCover(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              className="btnSecondary bookDetailCoverBtn"
              disabled={busy}
              onClick={() => coverInputRef.current?.click()}
            >
              {busy
                ? t("common.uploading")
                : book.cover_url
                  ? t("library.changeCover")
                  : t("library.uploadCover")}
            </button>
          </div>

          <div className="bookDetailProgressCol">
            <div className="label">{t("common.progressPercent")}</div>
            <div className="bookDetailProgressGrid">
              <input
                className="input"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                inputMode="numeric"
                placeholder="5"
              />
              <button type="button" className="btn" disabled={busy} onClick={() => addProgress(false)}>
                {t("bookDetail.apply")}
              </button>
              <button type="button" className="btnSecondary" disabled={busy} onClick={finish}>
                {t("bookDetail.finish")}
              </button>
              <button type="button" className="btnSecondary" disabled={busy} onClick={abandon}>
                {t("bookDetail.abandon")}
              </button>
            </div>
          </div>

          <div className="bookDetailQuickCheckinCol">
            <div className="label">{t("bookDetail.quickCheckin")}</div>
            <div className="muted bookDetailQuickCheckinHint">{t("bookDetail.quickCheckinHint")}</div>
            <div className="bookDetailQuickCheckinModes">
              <button
                type="button"
                className={
                  quickCheckinMode === "percent"
                    ? "bookDetailQuickCheckinMode bookDetailQuickCheckinModeActive"
                    : "bookDetailQuickCheckinMode"
                }
                onClick={() => setQuickCheckinMode("percent")}
              >
                %
              </button>
              <button
                type="button"
                className={
                  quickCheckinMode === "words"
                    ? "bookDetailQuickCheckinMode bookDetailQuickCheckinModeActive"
                    : "bookDetailQuickCheckinMode"
                }
                onClick={() => setQuickCheckinMode("words")}
              >
                {t("common.words")}
              </button>
              <button
                type="button"
                className={
                  quickCheckinMode === "pages"
                    ? "bookDetailQuickCheckinMode bookDetailQuickCheckinModeActive"
                    : "bookDetailQuickCheckinMode"
                }
                onClick={() => setQuickCheckinMode("pages")}
              >
                {t("common.pages")}
              </button>
            </div>
            <form className="bookDetailQuickCheckinForm" onSubmit={saveQuickCheckin}>
              <div className="formRow">
                <label className="label">
                  {quickCheckinMode === "percent"
                    ? t("bookDetail.readPercent")
                    : quickCheckinMode === "pages"
                      ? t("common.pages")
                      : t("common.words")}
                </label>
                <input
                  className="input"
                  value={quickCheckinValue}
                  onChange={(e) => setQuickCheckinValue(e.target.value)}
                  inputMode="numeric"
                  placeholder={
                    quickCheckinMode === "percent" ? "2" : quickCheckinMode === "pages" ? "12" : "5000"
                  }
                />
                {quickCheckinMode === "percent" && quickCheckinWordsPreview > 0 ? (
                  <div className="muted bookDetailQuickCheckinPreview">
                    {t("bookDetail.wordsApprox", { count: formatNumber(quickCheckinWordsPreview, locale) })}
                    {quickCheckinPagesPreview > 0
                      ? ` · ${t("bookDetail.pagesApprox", { count: formatNumber(quickCheckinPagesPreview, locale) })}`
                      : ""}
                  </div>
                ) : null}
                {quickCheckinMode === "pages" && quickCheckinWordsPreview > 0 ? (
                  <div className="muted bookDetailQuickCheckinPreview">
                    {t("bookDetail.wordsApprox", { count: formatNumber(quickCheckinWordsPreview, locale) })}
                  </div>
                ) : null}
                {quickCheckinMode === "words" && quickCheckinPagesPreview > 0 ? (
                  <div className="muted bookDetailQuickCheckinPreview">
                    {t("bookDetail.pagesApprox", { count: formatNumber(quickCheckinPagesPreview, locale) })}
                  </div>
                ) : null}
              </div>
              <div className="formRow">
                <label className="label">{t("common.timeMinutes")}</label>
                <div className="bookDetailTimeRow">
                  <input
                    className="input bookDetailTimeInput"
                    value={quickCheckinMinutes}
                    onChange={(e) => setQuickCheckinMinutes(e.target.value)}
                    inputMode="numeric"
                    placeholder="90"
                  />
                  <ReadingTimer onStop={applyTimerMinutes} onRunningChange={setTimerRunning} disabled={busy} />
                </div>
              </div>
              <div className="row bookDetailQuickCheckinActions">
                <button type="submit" className="btn" disabled={busy}>
                  {busy ? t("common.saving") : t("bookDetail.saveToCalendar")}
                </button>
              </div>
            </form>
          </div>
        </div>

        {error ? <div className="error" style={{ marginTop: 10 }}>{error}</div> : null}
      </div>

      {confirmCloseTimer ? (
        <ConfirmDialog
          className="confirmDialogNarrow"
          title={t("bookDetail.timerCloseTitle")}
          message={t("bookDetail.timerCloseMessage")}
          confirmLabel={t("bookDetail.timerCloseConfirm")}
          confirmTone="default"
          onCancel={() => setConfirmCloseTimer(false)}
          onConfirm={() => {
            setConfirmCloseTimer(false);
            if (isEditDirty) {
              setConfirmCloseUnsaved(true);
              return;
            }
            onClose();
          }}
        />
      ) : null}

      {confirmCloseUnsaved ? (
        <ConfirmDialog
          className="confirmDialogNarrow"
          title={t("common.unsavedCloseTitle")}
          message={t("common.unsavedCloseMessage")}
          confirmLabel={t("common.unsavedCloseConfirm")}
          confirmTone="default"
          onCancel={() => setConfirmCloseUnsaved(false)}
          onConfirm={() => {
            setConfirmCloseUnsaved(false);
            onClose();
          }}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title={t("library.deleteConfirmTitle")}
          message={t("library.deleteConfirmMessage", {
            title: formatBookTitle(book.title, book.number, book.series, t)
          })}
          confirmLabel={busy ? t("library.deleting") : t("library.deleteConfirm")}
          busy={busy}
          onCancel={() => !busy && setConfirmDelete(false)}
          onConfirm={deleteBook}
        />
      ) : null}
    </div>
  );
}
