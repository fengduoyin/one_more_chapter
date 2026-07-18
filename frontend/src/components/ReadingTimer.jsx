import React, { useEffect, useRef, useState } from "react";
import { useLocale } from "../i18n/LocaleContext.jsx";

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) return `${hours}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

function elapsedMinutes(ms) {
  return Math.max(1, Math.round(ms / 60000));
}

function PlayIcon() {
  return (
    <svg className="readingTimerIcon" viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor" d="M4.2 2.6a1 1 0 0 1 1.52-.86l8.1 5.05a1 1 0 0 1 0 1.72l-8.1 5.05A1 1 0 0 1 4 12.7V3.3a1 1 0 0 1 .2-.7Z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg className="readingTimerIcon" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" fill="currentColor" />
    </svg>
  );
}

/**
 * Stopwatch that fills a minutes field on stop — does not submit a check-in.
 */
export default function ReadingTimer({ onStop, onRunningChange, disabled = false }) {
  const { t } = useLocale();
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return undefined;
    }

    intervalRef.current = setInterval(() => setNow(Date.now()), 250);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running]);

  const elapsedMs = running && startedAt != null ? Math.max(0, now - startedAt) : 0;

  useEffect(() => {
    onRunningChange?.(running);
  }, [running, onRunningChange]);

  function start() {
    if (disabled || running) return;
    const stamp = Date.now();
    setStartedAt(stamp);
    setNow(stamp);
    setRunning(true);
  }

  function stop() {
    if (!running || startedAt == null) return;
    const ms = Math.max(0, Date.now() - startedAt);
    setRunning(false);
    setStartedAt(null);
    if (ms > 0) onStop?.(elapsedMinutes(ms));
  }

  return (
    <div className={["readingTimer", running ? "readingTimerLive" : ""].filter(Boolean).join(" ")}>
      <span className={["readingTimerDot", running ? "readingTimerDotPulse" : ""].filter(Boolean).join(" ")} aria-hidden="true" />
      <div className="readingTimerMeta">
        <div className="readingTimerDisplay" aria-live="polite">
          {running ? formatElapsed(elapsedMs) : "00:00"}
        </div>
        <div className="muted readingTimerCaption">
          {running ? t("bookDetail.timerRunning") : t("bookDetail.timerIdle")}
        </div>
      </div>
      {!running ? (
        <button
          type="button"
          className="readingTimerToggle"
          disabled={disabled}
          onClick={start}
          aria-label={t("bookDetail.timerStart")}
          title={t("bookDetail.timerStart")}
        >
          <PlayIcon />
        </button>
      ) : (
        <button
          type="button"
          className="readingTimerToggle readingTimerToggleStop"
          disabled={disabled}
          onClick={stop}
          aria-label={t("bookDetail.timerStop")}
          title={t("bookDetail.timerStop")}
        >
          <StopIcon />
        </button>
      )}
    </div>
  );
}
