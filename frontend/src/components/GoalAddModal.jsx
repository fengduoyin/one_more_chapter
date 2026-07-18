import React from "react";
import { useLocale } from "../i18n/LocaleContext.jsx";
import GoalForm from "./GoalForm.jsx";

export default function GoalAddModal({ onClose, onCreated }) {
  const { t } = useLocale();

  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div className="modal modalForm" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div>
            <div className="title">{t("goals.addGoal")}</div>
          </div>
          <button className="btnGhost" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
        <GoalForm
          onCreated={() => {
            onCreated?.();
            onClose();
          }}
        />
      </div>
    </div>
  );
}
