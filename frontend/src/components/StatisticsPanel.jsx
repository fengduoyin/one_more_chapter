import React, { useEffect, useMemo, useState } from "react";
import { apiGet } from "../api.js";
import { formatNumber } from "../bookStatus.js";
import { getMonthNames } from "../calendarUtils.js";
import { useLocale } from "../i18n/LocaleContext.jsx";
import {
  analyticsQuery,
  chartsQuery,
  formatStatsHero,
  formatStatsMeta,
  formatStatsMetricTime,
  formatStatsPeriodLabel,
  formatWordsPerMinute,
  shiftMonth,
  statsPeriodOptions
} from "../statsUtils.js";
import MonthYearPicker from "./MonthYearPicker.jsx";
import MonthlyReadingChart from "./MonthlyReadingChart.jsx";
import ReadingHeatmap from "./ReadingHeatmap.jsx";

function MetricCard({ label, value, hint }) {
  return (
    <article className="cardInner statsMetricCard">
      <div className="statsMetricLabel">{label}</div>
      <div className="statsMetricValue">{value}</div>
      {hint ? <div className="muted statsMetricHint">{hint}</div> : null}
    </article>
  );
}

function ChartMetricToggle({ metric, onChange, t }) {
  return (
    <div className="viewToggle statsChartMetricToggle" role="group" aria-label={t("stats.chartMetric")}>
      <button
        type="button"
        className={metric === "words" ? "viewToggleBtn viewToggleBtnActive" : "viewToggleBtn"}
        onClick={() => onChange("words")}
      >
        {t("common.words")}
      </button>
      <button
        type="button"
        className={metric === "pages" ? "viewToggleBtn viewToggleBtnActive" : "viewToggleBtn"}
        onClick={() => onChange("pages")}
      >
        {t("common.pages")}
      </button>
      <button
        type="button"
        className={metric === "minutes" ? "viewToggleBtn viewToggleBtnActive" : "viewToggleBtn"}
        onClick={() => onChange("minutes")}
      >
        {t("common.minutes")}
      </button>
    </div>
  );
}

export default function StatisticsPanel() {
  const { locale, t } = useLocale();
  const now = useMemo(() => new Date(), []);
  const [period, setPeriod] = useState("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [analytics, setAnalytics] = useState(null);
  const [charts, setCharts] = useState(null);
  const [chartMetric, setChartMetric] = useState("words");
  const [busy, setBusy] = useState(false);
  const [chartsBusy, setChartsBusy] = useState(false);
  const [error, setError] = useState(null);

  const periodOptions = useMemo(() => statsPeriodOptions(t), [t]);
  const monthNames = useMemo(() => getMonthNames(locale, "full"), [locale]);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError(null);

    apiGet(analyticsQuery(period, year, month))
      .then((data) => {
        if (!cancelled) setAnalytics(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setAnalytics(null);
          setError(err?.message || t("stats.loadError"));
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [period, year, month, t]);

  useEffect(() => {
    let cancelled = false;
    setChartsBusy(true);

    apiGet(chartsQuery(12))
      .then((data) => {
        if (!cancelled) setCharts(data);
      })
      .catch(() => {
        if (!cancelled) setCharts(null);
      })
      .finally(() => {
        if (!cancelled) setChartsBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function goPrevMonth() {
    const next = shiftMonth(year, month, -1);
    setYear(next.year);
    setMonth(next.month);
  }

  function goNextMonth() {
    const next = shiftMonth(year, month, 1);
    setYear(next.year);
    setMonth(next.month);
  }

  const hero = formatStatsHero(analytics, period, year, month, locale, t);
  const periodLabel = formatStatsPeriodLabel(period, year, month, locale, t);
  const monthPickerLabel = `${monthNames[month - 1]} ${year}`;

  return (
    <div className="panelShell">
      <div className="panelShellHead statsHead">
        <div className="row statsHeadRow">
          <div className="title">{t("stats.title")}</div>
          <div className="viewToggle statsPeriodToggle" role="tablist" aria-label={t("stats.periodToggle")}>
            {periodOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={period === option.value}
                className={period === option.value ? "viewToggleBtn viewToggleBtnActive" : "viewToggleBtn"}
                onClick={() => setPeriod(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {period === "month" ? (
          <div className="statsPeriodNav">
            <div className="statsMonthNav">
              <button
                type="button"
                className="monthYearPickerYearBtn"
                aria-label={t("calendar.prevMonth")}
                onClick={goPrevMonth}
              >
                ‹
              </button>
              <MonthYearPicker
                year={year}
                month={month}
                label={monthPickerLabel}
                onChange={({ year: nextYear, month: nextMonth }) => {
                  setYear(nextYear);
                  setMonth(nextMonth);
                }}
              />
              <button
                type="button"
                className="monthYearPickerYearBtn"
                aria-label={t("calendar.nextMonth")}
                onClick={goNextMonth}
              >
                ›
              </button>
            </div>
          </div>
        ) : null}

        {period === "year" ? (
          <div className="statsPeriodNav">
            <div className="statsYearNav">
              <button
                type="button"
                className="monthYearPickerYearBtn"
                aria-label={t("calendar.prevYear")}
                onClick={() => setYear((value) => value - 1)}
              >
                ‹
              </button>
              <div className="statsYearNavLabel">{year}</div>
              <button
                type="button"
                className="monthYearPickerYearBtn"
                aria-label={t("calendar.nextYear")}
                onClick={() => setYear((value) => value + 1)}
              >
                ›
              </button>
            </div>
          </div>
        ) : null}

        {hero ? <div className="statsHero">{hero}</div> : null}
        {analytics ? <div className="statsHeroMeta muted">{formatStatsMeta(analytics, locale, t)}</div> : null}
        {error ? <div className="statsError">{error}</div> : null}
      </div>

      <div className="panelShellBody">
        <section className={`statsSummary grid6 ${busy ? "statsSummaryBusy" : ""}`} aria-busy={busy}>
          <MetricCard
            label={t("stats.readingTime")}
            value={formatStatsMetricTime(analytics?.minutes_total, locale, t)}
            hint={periodLabel}
          />
          <MetricCard
            label={t("stats.wordsRead")}
            value={formatNumber(analytics?.words_total, locale)}
            hint={periodLabel}
          />
          <MetricCard
            label={t("stats.pagesRead")}
            value={formatNumber(analytics?.pages_total, locale)}
            hint={periodLabel}
          />
          <MetricCard
            label={t("stats.avgTimePerDay")}
            value={
              analytics?.minutes_per_day != null
                ? formatStatsMetricTime(Math.round(analytics.minutes_per_day), locale, t)
                : "—"
            }
            hint={t("stats.avgTimeHint")}
          />
          <MetricCard
            label={t("stats.avgSpeed")}
            value={
              analytics?.words_per_minute != null
                ? t("common.wpm", { value: formatWordsPerMinute(analytics.words_per_minute, locale) })
                : "—"
            }
            hint={t("stats.speedHint")}
          />
          <MetricCard
            label={t("stats.dayRecord")}
            value={formatNumber(analytics?.best_day_words, locale)}
            hint={
              analytics?.best_day_minutes
                ? t("stats.recordDayHint", {
                    time: formatStatsMetricTime(analytics.best_day_minutes, locale, t)
                  })
                : t("stats.recordHint")
            }
          />
        </section>

        <div className={`statsCharts ${chartsBusy ? "statsChartsBusy" : ""}`}>
          <div className="statsChartsToolbar">
            <ChartMetricToggle metric={chartMetric} onChange={setChartMetric} t={t} />
          </div>
          <ReadingHeatmap charts={charts} metric={chartMetric} />
          <MonthlyReadingChart charts={charts} metric={chartMetric} />
        </div>
      </div>
    </div>
  );
}
