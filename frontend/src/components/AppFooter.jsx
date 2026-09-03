import React, { useEffect, useState } from "react";
import { apiGet } from "../api.js";
import { useLocale } from "../i18n/LocaleContext.jsx";

const GITHUB_URL = "https://github.com/fengduoyin/one_more_chapter";

function formatTag(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.toLowerCase().startsWith("v") ? `v${text.slice(1).trim()}` : `v${text}`;
}

const bundledLabel = formatTag(import.meta.env.VITE_APP_VERSION);

export default function AppFooter() {
  const { t } = useLocale();
  const [info, setInfo] = useState(null);
  const currentLabel = info?.current_label || bundledLabel;

  useEffect(() => {
    let cancelled = false;

    function load() {
      apiGet("/api/version")
        .then((payload) => {
          if (!cancelled) setInfo(payload);
        })
        .catch(() => {});
    }

    load();
    const retry = window.setTimeout(load, 2500);
    return () => {
      cancelled = true;
      window.clearTimeout(retry);
    };
  }, []);

  return (
    <footer className="appFooter">
      <span>{t("brand.madeBy", { name: "fengduoyin" })}</span>
      <span className="appFooterSep" aria-hidden="true">
        ·
      </span>
      <a className="appFooterLink" href={GITHUB_URL} target="_blank" rel="noreferrer">
        {t("brand.github")}
      </a>
      {currentLabel ? (
        <>
          <span className="appFooterSep" aria-hidden="true">
            ·
          </span>
          <span className="appFooterVersion">{currentLabel}</span>
        </>
      ) : null}
      {info?.update_available && info.latest_label ? (
        <>
          <span className="appFooterSep" aria-hidden="true">
            ·
          </span>
          <a
            className="appFooterLink appFooterUpdate"
            href={info.release_url || `${GITHUB_URL}/releases/latest`}
            target="_blank"
            rel="noreferrer"
          >
            {t("brand.updateAvailable", { version: info.latest_label })}
          </a>
        </>
      ) : null}
    </footer>
  );
}
