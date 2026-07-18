import React, { useEffect, useState } from "react";
import { getInitialTheme, toggleTheme } from "../theme.js";
import { useLocale } from "../i18n/LocaleContext.jsx";

export default function ThemeToggle() {
  const { t } = useLocale();
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    setTheme(document.documentElement.getAttribute("data-theme") || getInitialTheme());
  }, []);

  function onToggle() {
    setTheme((current) => toggleTheme(current));
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="themeToggle btnSecondary"
      onClick={onToggle}
      aria-label={isDark ? t("theme.enableLight") : t("theme.enableDark")}
      title={isDark ? t("theme.light") : t("theme.dark")}
    >
      <span className="themeToggleIcon" aria-hidden="true">
        {isDark ? "☾" : "☀"}
      </span>
    </button>
  );
}
