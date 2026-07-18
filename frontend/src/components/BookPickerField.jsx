import React, { useMemo, useState } from "react";
import { formatBookTitle } from "../bookStatus.js";
import { useLocale } from "../i18n/LocaleContext.jsx";
import BookCoverThumb from "./BookCoverThumb.jsx";
import BookPickerModal from "./BookPickerModal.jsx";

export default function BookPickerField({
  books,
  value,
  onChange,
  takenBookIds,
  allowBookId = null,
  suggestedBookId = ""
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);

  const selectedBook = useMemo(
    () => (value ? books.find((book) => String(book.id) === String(value)) : null),
    [books, value]
  );

  const suggestedBook = useMemo(() => {
    if (!suggestedBookId) return null;
    const book = books.find((item) => String(item.id) === String(suggestedBookId));
    if (!book) return null;
    if (takenBookIds.has(book.id) && book.id !== allowBookId) return null;
    if (String(value) === String(book.id)) return null;
    return book;
  }, [books, suggestedBookId, takenBookIds, allowBookId, value]);

  return (
    <div className="bookPickerField">
      <button type="button" className="bookPickerTrigger" onClick={() => setOpen(true)}>
        {selectedBook ? (
          <>
            <BookCoverThumb book={selectedBook} className="bookPickerTriggerCover" />
            <div className="bookPickerTriggerMeta">
              <div className="bookPickerTriggerTitle">
                {formatBookTitle(selectedBook.title, selectedBook.volume)}
              </div>
              <div className="muted bookPickerTriggerAuthor">{selectedBook.author}</div>
            </div>
          </>
        ) : (
          <span className="muted">{t("bookPicker.unlinkedTrigger")}</span>
        )}
      </button>

      <div className="bookPickerFieldActions">
        {selectedBook ? (
          <button type="button" className="btnSecondary" onClick={() => onChange("")}>
            {t("bookPicker.reset")}
          </button>
        ) : null}
        {suggestedBook ? (
          <button
            type="button"
            className="btnSecondary"
            onClick={() => onChange(String(suggestedBook.id))}
          >
            {t("bookPicker.sameBook")}
          </button>
        ) : null}
      </div>

      {open ? (
        <BookPickerModal
          books={books}
          value={value}
          onChange={onChange}
          takenBookIds={takenBookIds}
          allowBookId={allowBookId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
