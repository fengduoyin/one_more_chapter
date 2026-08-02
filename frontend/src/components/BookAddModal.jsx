import React, { useCallback, useState } from "react";
import { useLocale } from "../i18n/LocaleContext.jsx";
import BookForm from "./BookForm.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";

export default function BookAddModal({ onClose, onCreated }) {
  const { t } = useLocale();
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const handleDirtyChange = useCallback((next) => setDirty(next), []);

  function requestClose() {
    if (dirty) {
      setConfirmClose(true);
      return;
    }
    onClose();
  }

  return (
    <div className="modalBackdrop" onClick={requestClose}>
      <div className="modal modalForm" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div>
            <div className="title">{t("library.addBook")}</div>
            <div className="muted" style={{ marginTop: 6 }}>
              {t("library.coverHint")}
            </div>
          </div>
          <button className="btnGhost" onClick={requestClose}>
            {t("common.close")}
          </button>
        </div>
        <BookForm
          onDirtyChange={handleDirtyChange}
          onCreated={(book) => {
            onCreated?.(book);
            onClose();
          }}
        />
      </div>

      {confirmClose ? (
        <ConfirmDialog
          className="confirmDialogNarrow"
          title={t("common.unsavedCloseTitle")}
          message={t("common.unsavedCloseMessage")}
          confirmLabel={t("common.unsavedCloseConfirm")}
          confirmTone="default"
          onCancel={() => setConfirmClose(false)}
          onConfirm={() => {
            setConfirmClose(false);
            onClose();
          }}
        />
      ) : null}
    </div>
  );
}
