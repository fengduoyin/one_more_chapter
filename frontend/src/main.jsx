import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { LocaleProvider } from "./i18n/LocaleContext.jsx";
import { initLocale } from "./locale.js";
import { initTheme } from "./theme.js";
import "./styles.css";

initTheme();
initLocale();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </React.StrictMode>
);

