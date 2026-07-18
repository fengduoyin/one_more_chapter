import React from "react";
import { daysInMonth, rangeLength, runSegmentStyle } from "../calendarUtils.js";
import { useLocale } from "../i18n/LocaleContext.jsx";

export default function ReadingRuns({ year, month, ranges }) {
  const { t } = useLocale();
  const dim = daysInMonth(year, month);
  const multiDayRanges = ranges.filter((range) => rangeLength(range) > 1);

  if (!multiDayRanges.length) {
    return (
      <div className="calRuns">
        <div className="calRunsTitle">{t("calendar.continuousReading")}</div>
        <div className="muted calRunsEmpty">{t("calendar.noRuns")}</div>
      </div>
    );
  }

  return (
    <div className="calRuns">
      <div className="calRunsTitle">{t("calendar.continuousReading")}</div>
      <div className="calRunsTrack" style={{ gridTemplateColumns: `repeat(${dim}, minmax(0, 1fr))` }} aria-hidden="true">
        {Array.from({ length: dim }, (_, index) => (
          <span key={index} className="calRunsTick" />
        ))}
        {multiDayRanges.map((range) => (
          <span
            key={`${range.start}-${range.end}`}
            className="calRunsSegment"
            style={runSegmentStyle(range, year, month)}
            title={`${range.start} — ${range.end}`}
          />
        ))}
      </div>
      <div className="calRunsList">
        {multiDayRanges.map((range) => (
          <span key={`${range.start}-${range.end}`} className="calRunsChip">
            {range.start === range.end ? range.start : `${range.start} — ${range.end}`}
            <span className="muted">{t("calendar.runDays", { count: rangeLength(range) })}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
