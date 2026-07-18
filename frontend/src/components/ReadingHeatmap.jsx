import React, { useEffect, useMemo, useState } from "react";
import { formatNumber } from "../bookStatus.js";
import { useLocale } from "../i18n/LocaleContext.jsx";
import {
  buildHeatmapWeeks,
  formatStatsMetricTime,
  getHeatmapDayDetails,
  heatmapLevel,
  heatmapWeekdayLabels
} from "../statsUtils.js";

function HeatmapDayPanel({ cell, onClose }) {
  const { locale, t } = useLocale();
  const details = getHeatmapDayDetails(cell, locale, t);
  if (!details) return null;

  return (
    <div className="statsHeatmapDayPanel cardInner" role="region" aria-label={details.label}>
      <div className="statsHeatmapPopoverHead">
        <div className="title">{details.label}</div>
        <button
          type="button"
          className="btnGhost statsHeatmapPopoverClose"
          onClick={onClose}
          aria-label={t("common.close")}
        >
          ✕
        </button>
      </div>
      {details.empty ? (
        <div className="muted statsHeatmapPopoverEmpty">{t("stats.noInfo")}</div>
      ) : (
        <div className="statsHeatmapPopoverGrid">
          <div className="statsHeatmapPopoverMetric">
            <div className="statsMetricLabel">{t("common.words")}</div>
            <div className="statsHeatmapPopoverValue">{formatNumber(details.words, locale)}</div>
          </div>
          <div className="statsHeatmapPopoverMetric">
            <div className="statsMetricLabel">{t("common.pages")}</div>
            <div className="statsHeatmapPopoverValue">{formatNumber(details.pages, locale)}</div>
          </div>
          <div className="statsHeatmapPopoverMetric">
            <div className="statsMetricLabel">{t("stats.time")}</div>
            <div className="statsHeatmapPopoverValue">{formatStatsMetricTime(details.minutes, locale, t)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReadingHeatmap({ charts, metric }) {
  const { locale, t } = useLocale();
  const weekdayLabels = useMemo(() => heatmapWeekdayLabels(locale), [locale]);
  const weeks = useMemo(
    () => buildHeatmapWeeks(charts?.heatmap_start, charts?.heatmap_end, charts?.by_day, metric),
    [charts, metric]
  );
  const [selectedCell, setSelectedCell] = useState(null);

  useEffect(() => {
    if (!selectedCell) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape") setSelectedCell(null);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedCell]);

  function openCell(cell, event) {
    event.preventDefault();
    event.stopPropagation();
    if (!cell?.inRange) return;

    setSelectedCell((current) => (current?.day === cell.day ? null : cell));
  }

  if (!charts) return null;

  return (
    <section className="statsSection cardInner">
      <div className="statsSectionHead">
        <div>
          <div className="statsSectionTitle">{t("stats.history")}</div>
        </div>
      </div>

      {weeks.length ? (
        <div className="statsHeatmapWrap">
          <div className="statsHeatmapWeekdays" aria-hidden="true">
            {weekdayLabels.map((label, index) => (
              <span key={index} className="statsHeatmapWeekday">
                {label}
              </span>
            ))}
          </div>
          <div
            className="statsHeatmapGrid"
            style={{ "--heatmap-weeks": weeks.length }}
            aria-label={t("stats.heatmap")}
          >
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="statsHeatmapWeek">
                {week.map((cell, dayIndex) => {
                  const level = heatmapLevel(cell, metric);
                  const isSelected = selectedCell?.day === cell?.day;
                  const className = [
                    "statsHeatmapCell",
                    cell?.inRange ? `statsHeatmapLevel${level}` : "statsHeatmapCellEmpty",
                    cell?.inRange ? "statsHeatmapCellBtn" : "",
                    isSelected ? "statsHeatmapCellSelected" : ""
                  ]
                    .filter(Boolean)
                    .join(" ");

                  if (!cell?.inRange) {
                    return <span key={dayIndex} className={className} aria-hidden="true" />;
                  }

                  const details = getHeatmapDayDetails(cell, locale, t);

                  return (
                    <button
                      key={dayIndex}
                      type="button"
                      className={className}
                      aria-label={details?.label}
                      aria-pressed={isSelected}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={(event) => openCell(cell, event)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="muted statsSectionEmpty">{t("stats.heatmapEmpty")}</div>
      )}

      {selectedCell ? <HeatmapDayPanel cell={selectedCell} onClose={() => setSelectedCell(null)} /> : null}

      <div className="statsHeatmapLegend muted">
        <span>{t("stats.less")}</span>
        <span className="statsHeatmapLegendCells" aria-hidden="true">
          <span className="statsHeatmapCell statsHeatmapLevel1" />
          <span className="statsHeatmapCell statsHeatmapLevel2" />
          <span className="statsHeatmapCell statsHeatmapLevel3" />
          <span className="statsHeatmapCell statsHeatmapLevel4" />
          <span className="statsHeatmapCell statsHeatmapLevel5" />
        </span>
        <span>{t("stats.more")}</span>
      </div>
    </section>
  );
}
