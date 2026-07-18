import React, { useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiJson } from "../api.js";
import { formatNumber } from "../bookStatus.js";
import {
  clamp,
  formatGoalPeriod,
  goalPeriodParts,
  goalPeriodStartIso,
  goalPercent,
  goalStatusTone,
  metricLabel,
  metricOptions,
  monthNameOptions,
  periodTypeOptions,
  sortGoalsByPeriodDesc
} from "../goalUtils.js";
import { useLocale } from "../i18n/LocaleContext.jsx";
import GoalAddModal from "./GoalAddModal.jsx";
import SelectMenu from "./SelectMenu.jsx";

function GoalEditForm({
  busy,
  editPeriodType,
  setEditPeriodType,
  editYear,
  setEditYear,
  editMonth,
  setEditMonth,
  editMetric,
  setEditMetric,
  editTarget,
  setEditTarget,
  editTitle,
  setEditTitle,
  now,
  onCancel,
  onSubmit,
  locale,
  t
}) {
  return (
    <form className="cardInner form goalEditForm" onSubmit={onSubmit}>
      <div className="grid2">
        <div className="formRow">
          <label className="label">{t("goals.periodType")}</label>
          <SelectMenu value={editPeriodType} onChange={setEditPeriodType} options={periodTypeOptions(t)} />
        </div>
        <div className="formRow">
          <label className="label">{t("common.year")}</label>
          <input
            className="input"
            value={editYear}
            onChange={(e) => setEditYear(Number(e.target.value || now.getFullYear()))}
            inputMode="numeric"
          />
        </div>
      </div>
      {editPeriodType === "month" ? (
        <div className="formRow">
          <label className="label">{t("common.month")}</label>
          <SelectMenu
            value={String(editMonth)}
            onChange={(value) => setEditMonth(clamp(Number(value), 1, 12))}
            options={monthNameOptions(locale)}
          />
        </div>
      ) : null}
      <div className="grid2">
        <div className="formRow">
          <label className="label">{t("goals.metric")}</label>
          <SelectMenu value={editMetric} onChange={setEditMetric} options={metricOptions(t)} />
        </div>
        <div className="formRow">
          <label className="label">{t("goals.target")}</label>
          <input
            className="input"
            value={editTarget}
            onChange={(e) => setEditTarget(e.target.value)}
            inputMode="numeric"
          />
        </div>
      </div>
      <div className="formRow">
        <label className="label">{t("goals.titleOptional")}</label>
        <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
      </div>
      <div className="row goalEditFormActions">
        <button type="button" className="btnSecondary" disabled={busy} onClick={onCancel}>
          {t("common.cancel")}
        </button>
        <button className="btn" disabled={busy}>
          {busy ? t("common.saving") : t("common.save")}
        </button>
      </div>
    </form>
  );
}

function GoalCard({ item, busy, editingGoalId, onEdit, onRemove, editForm, locale, t }) {
  if (editingGoalId === item.goal.id) return editForm;

  const percent = goalPercent(item.current, item.goal.target);
  const tone = goalStatusTone(item);
  const toneClass =
    tone === "done" ? "goalRow--done" : tone === "missed" ? "goalRow--missed" : "";

  return (
    <div className={`goalRow ${toneClass}`.trim()}>
      <div className="goalMain">
        <div className="goalTitle">{item.goal.title || metricLabel(item.goal.metric, t)}</div>
        <div className="muted">
          {formatGoalPeriod(item.goal, locale, t)} • {metricLabel(item.goal.metric, t)} •{" "}
          {formatNumber(item.current, locale)} / {formatNumber(item.goal.target, locale)}
        </div>
      </div>
      <div className="goalRight">
        <div className="row goalActions">
          <div className="muted">{Math.round(percent)}%</div>
          <button type="button" className="btnSecondary" disabled={busy} onClick={() => onEdit(item)}>
            {t("common.edit")}
          </button>
          <button type="button" className="btnSecondary" disabled={busy} onClick={() => onRemove(item.goal.id)}>
            {t("common.delete")}
          </button>
        </div>
        <div className="progress">
          <div className="progressBar" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
        </div>
      </div>
    </div>
  );
}

function GoalsColumn({ title, items, emptyLabel, ...cardProps }) {
  return (
    <section className="goalsColumn cardInner">
      <div className="goalsColumnHead">
        <div className="title">{title}</div>
      </div>
      <div className="goalsColumnBody">
        {items.length ? (
          items.map((item) => <GoalCard key={item.goal.id} item={item} {...cardProps} />)
        ) : (
          <div className="muted">{emptyLabel}</div>
        )}
      </div>
    </section>
  );
}

export default function GoalsTab() {
  const { locale, t } = useLocale();
  const now = useMemo(() => new Date(), []);
  const [progress, setProgress] = useState([]);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [editPeriodType, setEditPeriodType] = useState("month");
  const [editYear, setEditYear] = useState(now.getFullYear());
  const [editMonth, setEditMonth] = useState(now.getMonth() + 1);
  const [editMetric, setEditMetric] = useState("words");
  const [editTarget, setEditTarget] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showAddGoal, setShowAddGoal] = useState(false);

  async function reloadGoals() {
    const p = await apiGet("/api/stats/goals/progress/all");
    setProgress(p);
  }

  useEffect(() => {
    reloadGoals().catch(() => {});
  }, []);

  const yearGoals = useMemo(
    () => sortGoalsByPeriodDesc(progress.filter((item) => item.goal.period_type === "year")),
    [progress]
  );
  const monthGoals = useMemo(
    () => sortGoalsByPeriodDesc(progress.filter((item) => item.goal.period_type === "month")),
    [progress]
  );

  function startEditGoal(item) {
    const parts = goalPeriodParts(item.goal);
    setEditingGoalId(item.goal.id);
    setEditPeriodType(parts.periodType);
    setEditYear(parts.year);
    setEditMonth(parts.month);
    setEditMetric(item.goal.metric);
    setEditTarget(String(item.goal.target));
    setEditTitle(item.goal.title || "");
    setError("");
  }

  function cancelEditGoal() {
    setEditingGoalId(null);
    setError("");
  }

  async function saveEditedGoal(e) {
    e?.preventDefault?.();
    if (!editingGoalId) return;
    setBusy(true);
    setError("");
    try {
      await apiJson("PATCH", `/api/goals/${editingGoalId}`, {
        period_type: editPeriodType,
        period_start: goalPeriodStartIso(editPeriodType, editYear, editMonth),
        metric: editMetric,
        target: Number(editTarget),
        title: editTitle.trim() || null
      });
      setEditingGoalId(null);
      await reloadGoals();
    } catch {
      setError(t("goals.errSave"));
    } finally {
      setBusy(false);
    }
  }

  async function removeGoal(goalId) {
    setError("");
    setBusy(true);
    try {
      await apiDelete(`/api/goals/${goalId}`);
      if (editingGoalId === goalId) setEditingGoalId(null);
      await reloadGoals();
    } catch {
      setError(t("goals.errDelete"));
    } finally {
      setBusy(false);
    }
  }

  const editForm = (
    <GoalEditForm
      busy={busy}
      editPeriodType={editPeriodType}
      setEditPeriodType={setEditPeriodType}
      editYear={editYear}
      setEditYear={setEditYear}
      editMonth={editMonth}
      setEditMonth={setEditMonth}
      editMetric={editMetric}
      setEditMetric={setEditMetric}
      editTarget={editTarget}
      setEditTarget={setEditTarget}
      editTitle={editTitle}
      setEditTitle={setEditTitle}
      now={now}
      onCancel={cancelEditGoal}
      onSubmit={saveEditedGoal}
      locale={locale}
      t={t}
    />
  );

  const cardProps = {
    busy,
    editingGoalId,
    onEdit: startEditGoal,
    onRemove: removeGoal,
    editForm,
    locale,
    t
  };

  return (
    <div className="panelShell">
      <div className="panelShellBody goalsTabBody">
        <div className="goalsTabHead">
          <div className="title">{t("goals.title")}</div>
          <div className="goalsTabHeadActions">
            <button type="button" className="btn" onClick={() => setShowAddGoal(true)}>
              {t("goals.addGoal")}
            </button>
          </div>
        </div>

        <div className="goalsColumns">
          <GoalsColumn
            title={t("goals.yearly")}
            items={yearGoals}
            emptyLabel={t("goals.yearlyEmpty")}
            {...cardProps}
          />
          <GoalsColumn
            title={t("goals.monthly")}
            items={monthGoals}
            emptyLabel={t("goals.monthlyEmpty")}
            {...cardProps}
          />
        </div>
        {error ? <div className="error goalsTabError">{error}</div> : null}
      </div>

      {showAddGoal ? (
        <GoalAddModal onClose={() => setShowAddGoal(false)} onCreated={() => reloadGoals().catch(() => {})} />
      ) : null}
    </div>
  );
}
