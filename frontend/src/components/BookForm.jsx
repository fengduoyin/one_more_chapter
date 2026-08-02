import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiJson, uploadCover } from "../api.js";
import { bookStatusOptions } from "../bookStatus.js";
import { useLocale } from "../i18n/LocaleContext.jsx";
import SelectMenu from "./SelectMenu.jsx";

export default function BookForm({ onCreated, onDirtyChange }) {
  const { t } = useLocale();
  const coverInputRef = useRef(null);
  const [author, setAuthor] = useState("");
  const [title, setTitle] = useState("");
  const [series, setSeries] = useState("");
  const [number, setNumber] = useState("");
  const [wordsTotal, setWordsTotal] = useState("");
  const [pagesTotal, setPagesTotal] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("planned");
  const [cover, setCover] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const dirty = useMemo(
    () =>
      Boolean(
        author.trim() ||
          title.trim() ||
          series.trim() ||
          number.trim() ||
          wordsTotal.trim() ||
          pagesTotal.trim() ||
          description.trim() ||
          cover ||
          status !== "planned"
      ),
    [author, title, series, number, wordsTotal, pagesTotal, description, cover, status]
  );

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const book = await apiJson("POST", "/api/books", {
        author,
        title,
        series: series.trim() || null,
        number: number.trim() ? Number(number) : null,
        words_total: Number(wordsTotal || 0),
        pages_total: pagesTotal.trim() ? Number(pagesTotal) : null,
        description: description || null,
        status
      });
      let finalBook = book;
      if (cover) finalBook = await uploadCover(book.id, cover);
      setAuthor("");
      setTitle("");
      setSeries("");
      setNumber("");
      setWordsTotal("");
      setPagesTotal("");
      setDescription("");
      setStatus("planned");
      setCover(null);
      if (coverInputRef.current) coverInputRef.current.value = "";
      onCreated?.(finalBook);
    } catch {
      setError(t("library.createError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="formRow">
        <label className="label">{t("common.author")}</label>
        <input className="input" value={author} onChange={(e) => setAuthor(e.target.value)} required />
      </div>
      <div className="formRow">
        <label className="label">{t("common.title")}</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
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
      <div className="grid2">
        <div className="formRow">
          <label className="label">{t("library.wordsTotal")}</label>
          <input
            className="input"
            value={wordsTotal}
            onChange={(e) => setWordsTotal(e.target.value)}
            inputMode="numeric"
            placeholder="100000"
          />
        </div>
        <div className="formRow">
          <label className="label">{t("library.pagesTotal")}</label>
          <input
            className="input"
            value={pagesTotal}
            onChange={(e) => setPagesTotal(e.target.value)}
            inputMode="numeric"
            placeholder="400"
          />
        </div>
      </div>
      <div className="formRow">
        <label className="label">{t("common.status")}</label>
        <SelectMenu value={status} onChange={setStatus} options={bookStatusOptions(t)} />
      </div>
      <div className="formRow">
        <label className="label">{t("common.shortDescription")}</label>
        <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid2">
        <div className="formRow formRowRight">
          <input
            ref={coverInputRef}
            className="fileInputHidden"
            type="file"
            accept="image/*"
            onChange={(e) => setCover(e.target.files?.[0] || null)}
          />
          <button type="button" className="btn" onClick={() => coverInputRef.current?.click()}>
            {t("library.uploadCover")}
          </button>
        </div>
        <div className="formRow formRowRight">
          <button className="btn" disabled={busy}>
            {busy ? t("common.saving") : t("library.addBook")}
          </button>
        </div>
      </div>
      {error ? <div className="error">{error}</div> : null}
    </form>
  );
}
