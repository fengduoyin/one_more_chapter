import React, { useMemo } from "react";
import { formatReadingDuration } from "../bookStatus.js";
import { getWeekdayLabels } from "../i18n/format.js";
import { useLocale } from "../i18n/LocaleContext.jsx";
import BookCoverThumb from "./BookCoverThumb.jsx";

function weekdayMon0(year, month, day) {
  const js = new Date(year, month - 1, day).getDay();
  return (js + 6) % 7;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

export default function MonthCalendar({
  year,
  month,
  daySummaries,
  booksById,
  finishedDaysToBooks,
  streakDaysSet,
  connectedDaysSet,
  selectedIso,
  onSelect
}) {
  const { locale, t } = useLocale();
  const weekLabels = useMemo(() => getWeekdayLabels(locale, "short"), [locale]);

  const todayIso = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const cells = useMemo(() => {
    const dim = daysInMonth(year, month);
    const offset = weekdayMon0(year, month, 1);
    const total = 42;
    const out = [];
    for (let i = 0; i < total; i++) {
      const day = i - offset + 1;
      if (day < 1 || day > dim) out.push(null);
      else out.push(day);
    }
    return out;
  }, [year, month]);

  return (
    <div>
      <div className="calWeek">
        {weekLabels.map((w) => (
          <div key={w} className="calWeekday">
            {w}
          </div>
        ))}
      </div>
      <div className="calGrid calGridRich">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} className="calCell calEmpty" />;
          const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const summary = daySummaries?.get(iso);
          const hasCheckin = Boolean(summary);
          const finishedBooks = finishedDaysToBooks?.get(iso) || [];
          const inStreak = streakDaysSet?.has(iso);
          const inConnected = connectedDaysSet?.has(iso);
          const isSelected = selectedIso === iso;
          const isToday = iso === todayIso;
          const primaryBook =
            summary?.primaryCheckin?.book_id != null
              ? booksById?.get(summary.primaryCheckin.book_id)
              : null;

          const tooltipParts = [];
          if (hasCheckin) {
            tooltipParts.push(
              summary.totalMinutes > 0
                ? formatReadingDuration(summary.totalMinutes)
                : `${summary.checkins.length} ${t("common.entry")}`
            );
          }
          if (finishedBooks.length) {
            tooltipParts.push(
              t("calendar.tooltipFinished", { titles: finishedBooks.map((b) => b.title).join(", ") })
            );
          }

          return (
            <button
              key={idx}
              type="button"
              className={[
                "calCell",
                "calCellRich",
                hasCheckin ? "calCheckin" : "",
                finishedBooks.length ? "calFinished" : "",
                inStreak ? "calStreak" : "",
                inConnected && !inStreak ? "calConnected" : "",
                isToday ? "calToday" : "",
                isSelected ? "calSelected" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelect?.(iso)}
              title={tooltipParts.join(" • ")}
            >
              <div className="calCellTop">
                <div className="calDay">{day}</div>
                {finishedBooks.length ? (
                  <span className="calFinishMark" title={t("calendar.finishedBook")} />
                ) : null}
              </div>

              {hasCheckin ? (
                <div className="calCellBody">
                  {primaryBook ? (
                    <BookCoverThumb book={primaryBook} className="calCellCover" />
                  ) : (
                    <div className="calCellCover calCellCoverStub">···</div>
                  )}
                  <div className="calCellMeta">
                    {summary.totalMinutes > 0 ? (
                      <span className="calCellTime">{formatReadingDuration(summary.totalMinutes)}</span>
                    ) : (
                      <span className="calCellTime calCellTimeMuted">{t("common.entry")}</span>
                    )}
                    {summary.extraBooks > 0 ? (
                      <span className="calCellMore">+{summary.extraBooks}</span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="calLegend">
        <span className="legendItem">
          <span className="calLegendSwatch calLegendSwatchCheckin" /> {t("calendar.legendCheckin")}
        </span>
        <span className="legendItem">
          <span className="calLegendSwatch calLegendSwatchStreak" /> {t("calendar.legendStreak")}
        </span>
        <span className="legendItem">
          <span className="calLegendSwatch calLegendSwatchFinished" /> {t("calendar.legendFinished")}
        </span>
      </div>
    </div>
  );
}
