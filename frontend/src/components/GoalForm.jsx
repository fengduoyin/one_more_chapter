import React, { useState } from "react";
import { apiJson } from "../api.js";
import { useLocale } from "../i18n/LocaleContext.jsx";
import {
  clamp,
  goalPeriodStartIso,
  metricOptions,
  monthNameOptions,
  periodTypeOptions
} from "../goalUtils.js";
import SelectMenu from "./SelectMenu.jsx";

export default function GoalForm({ onCreated }) {
  const { locale, t } = useLocale();
  const now = new Date();
  const [goalPeriodType, setGoalPeriodType] = useState("month");
  const [goalYear, setGoalYear] = useState(now.getFullYear());
  const [goalMonth, setGoalMonth] = useState(now.getMonth() + 1);
  const [metric, setMetric] = useState("words");
  const [target, setTarget] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await apiJson("POST", "/api/goals", {
        period_type: goalPeriodType,
        period_start: goalPeriodStartIso(goalPeriodType, goalYear, goalMonth),
        metric,
        target: Number(target || 0),
        title: title || null
      });
      setTarget("");
      setTitle("");
      onCreated?.();
    } catch (err) {
      const message = String(err?.message || "");
      setError(message.includes("already exists") ? t("goals.errExists") : t("goals.errSave"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="grid2">
        <div className="formRow">
          <label className="label">{t("goals.periodType")}</label>
          <SelectMenu
            value={goalPeriodType}
            onChange={setGoalPeriodType}
            options={periodTypeOptions(t)}
          />
        </div>
        <div className="formRow">
          <label className="label">{t("common.year")}</label>
          <input
            className="input"
            value={goalYear}
            onChange={(e) => setGoalYear(Number(e.target.value || now.getFullYear()))}
            inputMode="numeric"
          />
        </div>
      </div>
      {goalPeriodType === "month" ? (
        <div className="formRow">
          <label className="label">{t("common.month")}</label>
          <SelectMenu
            value={String(goalMonth)}
            onChange={(value) => setGoalMonth(clamp(Number(value), 1, 12))}
            options={monthNameOptions(locale)}
          />
        </div>
      ) : null}
      <div className="grid2">
        <div className="formRow">
          <label className="label">{t("goals.metric")}</label>
          <SelectMenu value={metric} onChange={setMetric} options={metricOptions(t)} />
        </div>
        <div className="formRow">
          <label className="label">{t("goals.target")}</label>
          <input
            className="input"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            inputMode="numeric"
            placeholder={metric === "words" ? "200000" : metric === "pages" ? "500" : "12"}
          />
        </div>
      </div>
      <div className="formRow">
        <label className="label">{t("goals.titleOptional")}</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button className="btn" disabled={busy}>
          {busy ? t("common.saving") : t("goals.addGoal")}
        </button>
      </div>
      {error ? <div className="error">{error}</div> : null}
    </form>
  );
}
