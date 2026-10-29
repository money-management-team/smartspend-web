import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { getGoalSmartPlanPath } from "../../routes/Path.js";
import { keys } from "../data/loaders.js";
import { sessionWorkspace } from "../data/readApi.js";
import { readGoalPlan, readPlanOptions } from "../data/readPlanApi.js";
import { useResource } from "../data/useResource.js";
import { todayIn } from "../forms/validation.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatDay } from "../money/format.js";
import Money from "../money/Money.jsx";
import "./smartPlanMessages.js";
import InstallmentReview from "./smart/InstallmentReview.jsx";
import { RHYTHMS, buildPlanDetail, buildPlanOptions } from "./smart/planModel.js";
import Chevron from "../ui/Chevron.jsx";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import Skeleton from "../ui/Skeleton.jsx";

const MALFORMED = Object.freeze({ code: "MALFORMED_RESPONSE" });
const P = "planning.goals.plan";
const OPEN_SHOWN = 4;

/*
 * A goal's Smart Savings plan. This file (and planning/smart/) is only in a build
 * with Smart Savings on (planning/smartSavingsGate.js), and it only ever reads:
 *
 *   GET …/plan                         the plan: rhythm, amounts, health, installments, versions
 *   GET …/plan-options                 for a goal with no plan, once asked for, per rhythm
 *   GET …/confirmation-preview         when a confirm review opens
 *
 * Each open installment (status `planned`) can be reviewed for confirm,
 * postpone or skip (smart/InstallmentReview.jsx); each review ends at a disabled
 * button. Creating, revising or discontinuing a plan is in the full version.
 *
 * GET …/plan answers 404 for a goal with no active plan. That is the normal state
 * of a flexible goal, so it is "no plan", not an error.
 */
function PlanOptions({ goal, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const [rhythm, setRhythm] = useState(null);
  const schedule = rhythm ? RHYTHMS[rhythm] : null;
  const loader = useMemo(() => (schedule ? async (signal) => (await readPlanOptions(goal.id, schedule, signal)).data : async () => null), [goal.id, schedule]);
  const resource = useResource(`goalPlanOptions:${goal.id}:${rhythm ?? "none"}`, loader, { enabled: Boolean(schedule) });
  const options = useMemo(() => (resource.data === undefined || resource.data === null ? null : buildPlanOptions(resource.data)), [resource.data]);

  return (
    <div className="sm-plan-options" data-sm-section="plan-options">
      <p className="sm-text sm-muted">{t(`${P}.optionsIntro`)}</p>
      <div className="sm-segment sm-segment-wrap" role="group" aria-label={t(`${P}.rhythm`)}>
        {Object.keys(RHYTHMS).map((key) => (
          <button key={key} type="button" className="sm-segment-button" aria-pressed={rhythm === key} onClick={() => setRhythm(key)} data-sm-rhythm={key}>{t(`${P}.rhythms.${key}`)}</button>
        ))}
      </div>
      {schedule && (resource.loading ? (
        <Skeleton lines={3} label={t(`${P}.optionsLoading`)} />
      ) : resource.status === "error" || !options ? (
        <ErrorPanel error={resource.error ?? MALFORMED} onRetry={resource.reload} retrying={resource.refreshing} compact />
      ) : options.length === 0 ? (
        <p className="sm-text sm-muted">{t(`${P}.noOptions`)}</p>
      ) : (
        <ul className="sm-list">
          {options.map((option) => (
            <li key={option.key} className="sm-row" data-sm-option={option.key} data-sm-feasible={option.feasible && !option.duplicate ? "true" : "false"}>
              <span className="sm-row-main">
                <span className="sm-row-title">{t(`${P}.intensity.${option.intensity}`, { defaultValue: option.intensity ?? t(`${P}.option`) })}</span>
                {option.installmentAmount && <span className="sm-row-meta">{t(`${P}.perInstallment`)} <Money plain value={option.installmentAmount} currency={goal.currency} />{option.installmentCount ? <> × <bdi dir="ltr">{option.installmentCount}</bdi></> : null}</span>}
                {option.completion && <span className="sm-row-meta">{t(`${P}.completes`)} <bdi>{formatDay(option.completion, locale, "UTC")}</bdi></span>}
                {option.affordability && <span className="sm-row-meta">{t(`${P}.estimate`)}: {t(`${P}.affordability.${option.affordability}`, { defaultValue: option.affordability })}</span>}
                {!option.feasible && <span className="sm-row-meta sm-form-error">{t(`${P}.notFeasible`)}{option.shortfall && <> · <Money plain value={option.shortfall} currency={goal.currency} /></>}</span>}
                {option.duplicate && <span className="sm-row-meta">{t(`${P}.duplicate`)}</span>}
              </span>
            </li>
          ))}
        </ul>
      ))}
      <p className="sm-text sm-muted sm-fine">{t(`${P}.notAdvice`)}</p>
      <button type="button" className="sm-button" disabled data-sm-action="create-plan" aria-describedby="sm-plan-create-closed">{t(`${P}.createPlan`)}</button>
      <p id="sm-plan-create-closed" className="sm-text sm-muted sm-fine" role="note" data-sm-note="write-closed" data-sm-write="plan.create">{t(`${P}.createClosed`)}</p>
    </div>
  );
}

export default function SmartPlanSection({ goal, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const loader = useMemo(() => async (signal) => (await readGoalPlan(goal.id, signal)).data, [goal.id]);
  const resource = useResource(keys.goalPlan(goal.id), loader);
  const plan = useMemo(() => (resource.data === undefined ? null : buildPlanDetail(resource.data, goal.id, goal.currency)), [resource.data, goal.id, goal.currency]);
  const noPlan = resource.status === "error" && resource.error?.code === "NOT_FOUND";
  const [review, setReview] = useState(null); // { kind, installment }
  const [showAll, setShowAll] = useState(false);
  const openerRef = useRef(null);
  const today = todayIn(sessionWorkspace()?.timezone);

  let body;

  if (resource.loading) body = <Skeleton lines={2} label={t(`${P}.loading`)} />;
  else if (noPlan) body = <><p className="sm-text sm-muted" data-sm-plan="none">{t(`${P}.none`)}</p>{goal.status === "active" && <PlanOptions goal={goal} locale={locale} />}</>;
  else if (resource.status === "error" || !plan) body = <ErrorPanel error={resource.error ?? MALFORMED} onRetry={resource.reload} retrying={resource.refreshing} compact />;
  else {
    const open = plan.installments.filter((item) => item.open);
    const resolved = plan.installments.filter((item) => !item.open);
    const openShown = showAll ? open : open.slice(0, OPEN_SHOWN);
    const day = (value) => (value ? <bdi>{formatDay(value, locale, "UTC")}</bdi> : null);

    body = (
      <div data-sm-plan="active" data-sm-plan-version={plan.planVersion ?? undefined}>
        <dl className="sm-stats sm-stats-stacked">
          {plan.intensity && <div className="sm-stat"><dt>{t(`${P}.plan`)}</dt><dd>{t(`${P}.intensity.${plan.intensity}`, { defaultValue: plan.intensity })}</dd></div>}
          {plan.frequency && <div className="sm-stat"><dt>{t(`${P}.rhythm`)}</dt><dd>{t(`${P}.every`, { count: plan.interval ?? 1, unit: t(`${P}.unit.${plan.frequency}`, { defaultValue: plan.frequency }) })}</dd></div>}
          {plan.installmentAmount && <div className="sm-stat"><dt>{t(`${P}.perInstallment`)}</dt><dd><Money plain value={plan.installmentAmount} currency={goal.currency} /></dd></div>}
          {plan.finalInstallmentAmount && plan.finalInstallmentAmount !== plan.installmentAmount && <div className="sm-stat"><dt>{t(`${P}.final`)}</dt><dd><Money plain value={plan.finalInstallmentAmount} currency={goal.currency} /></dd></div>}
          {plan.health.outstandingAmount && <div className="sm-stat"><dt>{t(`${P}.stillScheduled`)}</dt><dd><Money plain value={plan.health.outstandingAmount} currency={goal.currency} />{plan.health.outstandingCount !== null && <> · <bdi dir="ltr">{plan.health.outstandingCount}</bdi></>}</dd></div>}
          {plan.expectedCompletion && <div className="sm-stat"><dt>{t(`${P}.completes`)}</dt><dd>{day(plan.expectedCompletion)}</dd></div>}
          {plan.targetDate && <div className="sm-stat"><dt>{t(`${P}.target`)}</dt><dd>{day(plan.targetDate)}</dd></div>}
        </dl>
        <p className="sm-chips-inline">
          {plan.health.overdueCount ? <span className="sm-chip" data-sm-tone="warn">{t(`${P}.overdueCount`, { count: plan.health.overdueCount })}</span> : null}
          {plan.health.atRisk && <span className="sm-chip" data-sm-tone="bad">{t(`${P}.atRisk`)}</span>}
          {plan.health.replan && <span className="sm-chip" data-sm-tone="warn">{t(`${P}.replan`)}</span>}
          {plan.health.executable === false && <span className="sm-chip" data-sm-tone="neutral">{t(`${P}.notExecutable`)}</span>}
        </p>

        <h3 className="sm-row-title">{t(`${P}.installments`)}</h3>
        {open.length === 0 && <p className="sm-text sm-muted">{t(`${P}.noOpen`)}</p>}
        <ul className="sm-list" data-sm-list="installments">
          {openShown.map((item) => (
            <li key={item.id} className="sm-row sm-installment" data-sm-installment={item.id} data-sm-status={item.status ?? "unknown"}>
              <span className="sm-row-main">
                <span className="sm-row-title">{t(`${P}.number`, { sequence: item.sequence ?? "?" })} · {day(item.date)}</span>
                <span className="sm-row-meta"><Money plain value={item.amount ?? undefined} currency={goal.currency} />{item.overdue && <> · <span className="sm-chip" data-sm-tone="warn">{t(`${P}.overdue`)}</span></>}{item.postponedCount ? <> · {t(`${P}.postponedTimes`, { count: item.postponedCount })}</> : null}</span>
                <span className="sm-installment-actions">
                  {["confirm", "postpone", "skip"].map((kind) => (
                    <button key={kind} type="button" className="sm-button sm-button-quiet sm-button-small" disabled={kind === "confirm" && plan.health.executable === false} onClick={(event) => { openerRef.current = event.currentTarget; setReview({ kind, installment: item }); }} data-sm-action={`review-${kind}`}>{t(`${P}.review.${kind}.open`)}</button>
                  ))}
                </span>
              </span>
            </li>
          ))}
        </ul>
        {open.length > OPEN_SHOWN && <button type="button" className="sm-button sm-button-quiet sm-button-small" onClick={() => setShowAll(!showAll)}>{t(showAll ? `${P}.showFewer` : `${P}.showAll`, { count: open.length })}</button>}
        {resolved.length > 0 && (
          <details className="sm-plan-history">
            <summary>{t(`${P}.resolved`, { count: resolved.length })}</summary>
            <ul className="sm-list">
              {resolved.map((item) => (
                <li key={item.id} className="sm-row" data-sm-installment={item.id} data-sm-status={item.status ?? "unknown"}>
                  <span className="sm-row-main"><span className="sm-row-title">{t(`${P}.number`, { sequence: item.sequence ?? "?" })} · {day(item.date)}</span><span className="sm-row-meta">{t(`${P}.status.${item.status}`, { defaultValue: item.status ?? "—" })} · <Money plain value={item.amount ?? undefined} currency={goal.currency} /></span></span>
                </li>
              ))}
            </ul>
          </details>
        )}
        <p className="sm-text sm-muted sm-fine">{t(`${P}.readOnly`)}</p>
        <Link className="sm-link-row" to={getGoalSmartPlanPath(goal.id)}>
          <span>{t(`${P}.openFull`)}</span>
          <Chevron />
        </Link>
        {review && <InstallmentReview kind={review.kind} goalId={goal.id} installment={review.installment} installments={plan.installments} currency={goal.currency} targetDate={plan.targetDate} today={today} locale={locale} onClose={() => setReview(null)} returnFocusRef={openerRef} />}
      </div>
    );
  }

  return (
    <section className="sm-card" aria-labelledby="sm-goal-plan" data-sm-section="smart-plan">
      <h2 id="sm-goal-plan" className="sm-card-title">{t(`${P}.title`)}</h2>
      {body}
    </section>
  );
}
