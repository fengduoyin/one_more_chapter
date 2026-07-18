import React from "react";
import { useLocale } from "../i18n/LocaleContext.jsx";

export default function LocaleToggle() {
  const { locale, switchLocale, t } = useLocale();
  const isRu = locale === "ru";

  return (
    <button
      type="button"
      className="localeToggle btnSecondary"
      onClick={switchLocale}
      aria-label={isRu ? t("locale.switchToEn") : t("locale.switchToRu")}
      title={isRu ? t("locale.ru") : t("locale.en")}
    >
      <span className="localeToggleLabel" aria-hidden="true">
        {isRu ? t("locale.ru") : t("locale.en")}
      </span>
    </button>
  );
}
