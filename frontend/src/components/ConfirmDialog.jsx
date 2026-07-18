import React from "react";
import { useLocale } from "../i18n/LocaleContext.jsx";

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  confirmTone = "danger",
  busy = false,
  className = "",
  onConfirm,
  onCancel
}) {
  const { t } = useLocale();

  return (
    <div
      className="modalBackdrop confirmDialogBackdrop"
      onClick={(e) => {
        e.stopPropagation();
        if (!busy) onCancel?.();
      }}
    >
      <div
        className={["modal", "confirmDialog", className].filter(Boolean).join(" ")}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="title" id="confirm-dialog-title">
          {title}
        </div>
        <div className="muted confirmDialogMessage" id="confirm-dialog-message">
          {message}
        </div>
        <div className="row confirmDialogActions">
          <button type="button" className="btnSecondary" disabled={busy} onClick={onCancel}>
            {cancelLabel || t("common.cancel")}
          </button>
          <button
            type="button"
            className={confirmTone === "danger" ? "btn btnDanger" : "btn"}
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel || t("common.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
