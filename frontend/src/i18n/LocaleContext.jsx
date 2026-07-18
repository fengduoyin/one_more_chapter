/** React context for locale state and the t() translator. */

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { applyLocale, getInitialLocale, toggleLocale } from "../locale.js";
import { createTranslator } from "./messages.js";

const LocaleContext = createContext(null);

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(getInitialLocale);

  useEffect(() => {
    setLocaleState(document.documentElement.getAttribute("lang") || getInitialLocale());
  }, []);

  const value = useMemo(() => {
    const t = createTranslator(locale);

    function setLocale(next) {
      setLocaleState(applyLocale(next));
    }

    function switchLocale() {
      setLocaleState(toggleLocale(locale));
    }

    return { locale, setLocale, switchLocale, t };
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
}
