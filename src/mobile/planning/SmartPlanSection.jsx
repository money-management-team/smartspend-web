import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { getGoalSmartPlanPath } from "../../routes/Path.js";
import { keys } from "../data/loaders.js";
import { readGoalPlan } from "../data/readPlanApi.js";
import { useResource } from "../data/useResource.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatDay } from "../money/format.js";
import Money from "../money/Money.jsx";
import { buildPlanSummary } from "../models/plan.js";
import "./smartPlanMessages.js";
import Chevron from "../ui/Chevron.jsx";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import Skeleton from "../ui/Skeleton.jsx";

const MALFORMED = Object.freeze({ code: "MALFORMED_RESPONSE" });

/*
 * A goal's Smart Savings plan, read-only. This file is only in a build with Smart
 * Savings on (planning/smartSavingsGate.js), and it only ever reads: it shows the
 * next planned contribution and whether the backend says the plan needs
 * attention. There is no confirm, postpone, skip, create or revise here; the link
 * goes to the full version, which is where a plan is managed.
 *
 * GET /savings-goals/{id}/plan answers 404 for a goal with no active plan. That is
 * the normal state of a flexible goal, so it is "no plan", not an error.
 */
export default function SmartPlanSection({ goal, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const loader = useMemo(() => async (signal) => (await readGoalPlan(goal.id, signal)).data, [goal.id]);
  const resource = useResource(keys.goalPlan(goal.id), loader);
  const summary = useMemo(() => (resource.data === undefined ? null : buildPlanSummary(resource.data, goal.id, goal.currency)), [resource.data, goal.id, goal.currency]);
  const noPlan = resource.status === "error" && resource.error?.code === "NOT_FOUND";

  let body;

  if (resource.loading) body = <Skeleton lines={2} label={t("planning.goals.plan.loading")} />;
  else if (noPlan) body = <p className="sm-text sm-muted" data-sm-plan="none">{t("planning.goals.plan.none")}</p>;
  else if (resource.status === "error" || !summary) body = <ErrorPanel error={resource.error ?? MALFORMED} onRetry={resource.reload} retrying={resource.refreshing} compact />;
  else {
    const date = formatDay(summary.next?.date, locale);

    body = (
      <div data-sm-plan="active">
        <dl className="sm-stats sm-stats-stacked">
          <div className="sm-stat">
            <dt>{t("planning.goals.plan.next")}</dt>
            <dd>{date ? <bdi>{date}</bdi> : t("planning.goals.plan.noNext")}</dd>
          </div>
          {summary.next && (
            <div className="sm-stat">
              <dt>{t("planning.goals.plan.nextAmount")}</dt>
              <dd><Money plain value={summary.next.amount} currency={goal.currency} /></dd>
            </div>
          )}
        </dl>
        <p className="sm-chips-inline">
          {summary.next?.overdue === true && <span className="sm-chip" data-sm-tone="warn">{t("planning.goals.plan.overdue")}</span>}
          {summary.replanningRecommended === true && <span className="sm-chip" data-sm-tone="warn">{t("planning.goals.plan.replan")}</span>}
          {summary.executable === false && <span className="sm-chip" data-sm-tone="neutral">{t("planning.goals.plan.notExecutable")}</span>}
        </p>
        <p className="sm-text sm-muted sm-fine">{t("planning.goals.plan.readOnly")}</p>
        <Link className="sm-link-row" to={getGoalSmartPlanPath(goal.id)}>
          <span>{t("planning.goals.plan.openFull")}</span>
          <Chevron />
        </Link>
      </div>
    );
  }

  return (
    <section className="sm-card" aria-labelledby="sm-goal-plan" data-sm-section="smart-plan">
      <h2 id="sm-goal-plan" className="sm-card-title">{t("planning.goals.plan.title")}</h2>
      {body}
    </section>
  );
}
