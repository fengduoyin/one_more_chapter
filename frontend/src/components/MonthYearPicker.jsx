import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getMonthNames } from "../calendarUtils.js";
import { useLocale } from "../i18n/LocaleContext.jsx";

export default function MonthYearPicker({ year, month, label, onChange }) {
  const { locale, t } = useLocale();
  const monthShort = getMonthNames(locale, "short");
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  const [panelStyle, setPanelStyle] = useState(null);
  const rootRef = useRef(null);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setPanelStyle(null);
      return;
    }

    function updatePosition() {
      const rect = rootRef.current.getBoundingClientRect();
      setPanelStyle({
        top: rect.bottom + 8,
        left: rect.left
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    function onDocumentClick(event) {
      if (!rootRef.current?.contains(event.target) && !event.target.closest(".monthYearPickerPortal")) {
        setOpen(false);
      }
    }

    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) setPickerYear(year);
  }, [open, year]);

  function selectMonth(monthNumber) {
    onChange({ year: pickerYear, month: monthNumber });
    setOpen(false);
  }

  const panel =
    open && panelStyle ? (
      <div className="monthYearPickerPortal" style={panelStyle}>
        <div className="monthYearPickerPanel">
          <div className="monthYearPickerYearNav">
            <button
              type="button"
              className="monthYearPickerYearBtn"
              onClick={() => setPickerYear((value) => value - 1)}
              aria-label={t("calendar.prevYear")}
            >
              ‹
            </button>
            <div className="monthYearPickerYear">{pickerYear}</div>
            <button
              type="button"
              className="monthYearPickerYearBtn"
              onClick={() => setPickerYear((value) => value + 1)}
              aria-label={t("calendar.nextYear")}
            >
              ›
            </button>
          </div>
          <div className="monthYearPickerGrid">
            {monthShort.map((shortLabel, index) => {
              const monthNumber = index + 1;
              const isActive = pickerYear === year && monthNumber === month;
              return (
                <button
                  key={shortLabel}
                  type="button"
                  className={
                    isActive ? "monthYearPickerMonth monthYearPickerMonthActive" : "monthYearPickerMonth"
                  }
                  onClick={() => selectMonth(monthNumber)}
                >
                  {shortLabel}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    ) : null;

  return (
    <div ref={rootRef} className={["monthYearPicker", open ? "monthYearPickerOpen" : ""].filter(Boolean).join(" ")}>
      <button
        type="button"
        className="monthYearPickerTrigger title"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {label}
      </button>
      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
