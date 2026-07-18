import React, { useMemo, useState } from "react";
import { formatNumber } from "../bookStatus.js";
import { getMonthNames } from "../calendarUtils.js";
import { useLocale } from "../i18n/LocaleContext.jsx";
import { formatReadingTimeLong, maxMonthMetric } from "../statsUtils.js";

function formatMonthValue(value, metric, locale, t) {
  if (metric === "minutes") return formatReadingTimeLong(value, locale);
  if (metric === "pages") return `${formatNumber(value, locale)} ${t("common.pagesLower")}`;
  return `${formatNumber(value, locale)} ${t("common.wordsLower")}`;
}

export default function MonthlyReadingChart({ charts, metric }) {
  const { locale, t } = useLocale();
  const byMonth = charts?.by_month || [];
  const monthShort = useMemo(() => getMonthNames(locale, "short"), [locale]);
  const monthFull = useMemo(() => getMonthNames(locale, "full"), [locale]);
  const max = useMemo(() => Math.max(maxMonthMetric(byMonth, metric), 1), [byMonth, metric]);
  const [hoveredKey, setHoveredKey] = useState(null);

  if (!charts) return null;

  const metricLabel =
    metric === "minutes"
      ? t("stats.readingTime")
      : metric === "pages"
        ? t("stats.pagesRead")
        : t("stats.wordsRead");

  return (
    <section className="statsSection cardInner">
      <div className="statsSectionHead">
        <div>
          <div className="statsSectionTitle">{t("stats.byMonth")}</div>
          <div className="muted statsSectionHint">{t("stats.lastMonths", { count: byMonth.length })}</div>
        </div>
      </div>

      {byMonth.length ? (
        <div className="statsMonthBars" role="img" aria-label={t("stats.monthChart")}>
          {byMonth.map((item, index) => {
            const value = Number(item[metric] ?? 0);
            const height = value > 0 ? Math.max((value / max) * 100, 4) : 0;
            const showYear = item.month === 1 || index === 0;
            const key = `${item.year}-${item.month}`;
            const hovered = hoveredKey === key;
            const monthTitle = `${monthFull[item.month - 1]} ${item.year}`;

            return (
              <div
                key={key}
                className={["statsMonthBarCol", hovered ? "statsMonthBarColHovered" : ""]
                  .filter(Boolean)
                  .join(" ")}
                onMouseEnter={() => setHoveredKey(key)}
                onMouseLeave={() => setHoveredKey(null)}
                onFocus={() => setHoveredKey(key)}
                onBlur={() => setHoveredKey(null)}
              >
                <div className="statsMonthBarTrack">
                  {hovered ? (
                    <div className="statsMonthBarTooltip" role="tooltip">
                      <div className="statsMonthBarTooltipTitle">{monthTitle}</div>
                      <div className="statsMonthBarTooltipRow">
                        <span className="statsMonthBarTooltipDot" aria-hidden="true" />
                        <span className="statsMonthBarTooltipLabel">{metricLabel}</span>
                        <span className="statsMonthBarTooltipValue">
                          {formatMonthValue(value, metric, locale, t)}
                        </span>
                      </div>
                    </div>
                  ) : null}
                  <div
                    className={value > 0 ? "statsMonthBarFill" : "statsMonthBarFill statsMonthBarFillEmpty"}
                    style={{ height: `${height}%` }}
                    tabIndex={0}
                    aria-label={`${monthTitle}: ${formatMonthValue(value, metric, locale, t)}`}
                  />
                </div>
                <div className="statsMonthBarLabel">{monthShort[item.month - 1]}</div>
                {showYear ? <div className="statsMonthBarYear muted">{item.year}</div> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="muted statsSectionEmpty">{t("stats.monthChartEmpty")}</div>
      )}
    </section>
  );
}
