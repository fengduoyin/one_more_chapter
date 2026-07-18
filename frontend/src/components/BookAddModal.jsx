import React from "react";
import { useLocale } from "../i18n/LocaleContext.jsx";
import BookForm from "./BookForm.jsx";

export default function BookAddModal({ onClose, onCreated }) {
  const { t } = useLocale();

  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div className="modal modalForm" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div>
            <div className="title">{t("library.addBook")}</div>
            <div className="muted" style={{ marginTop: 6 }}>
              {t("library.coverHint")}
            </div>
          </div>
          <button className="btnGhost" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
        <BookForm
          onCreated={(book) => {
            onCreated?.(book);
            onClose();
          }}
        />
      </div>
    </div>
  );
}
