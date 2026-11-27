import { useMemo } from "react";
import { LuCheck, LuChartColumn, LuCircleHelp, LuInfo, LuRefreshCw, LuScanLine, LuSparkles } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { PATH, getNewOperationPath, getNewSavingsGoalPath } from "../../routes/Path.js";
import { budgetsLoader, dashboardLoader, goalsLoader, keys, loadAccounts } from "../data/loaders.js";
import { planningWorkspaceId } from "../data/readApi.js";
import { useResource } from "../data/useResource.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { SETUP_STEPS, hasAccount, hasListTotal, hasTransactions, stepState, summarize } from "../models/setup.js";
import { parsePercent } from "../models/planning.js";
import { MOBILE_ACCOUNTS, MOBILE_ACTIVITY, MOBILE_AI, MOBILE_BUDGETS, MOBILE_CAPTURES, MOBILE_GOALS, MOBILE_REPORTS } from "../navigation.js";
import Progress from "../planning/Progress.jsx";
import Chevron from "../ui/Chevron.jsx";
import IconButton from "../ui/IconButton.jsx";
import Skeleton from "../ui/Skeleton.jsx";

// Where each step is looked at on Mobile, and where it is done (the full version: Mobile cannot create these yet).
const VIEW = { account: MOBILE_ACCOUNTS, transaction: MOBILE_ACTIVITY, budget: MOBILE_BUDGETS, goal: MOBILE_GOALS };
const FULL = { account: PATH.USER.ACCOUNTS, transaction: getNewOperationPath("expense"), budget: PATH.USER.BUDGETS, goal: getNewSavingsGoalPath() };

function useSetup(workspaceId) {
  const enabled = Boolean(workspaceId);
  const listQuery = useMemo(() => ({ workspace_id: workspaceId, per_page: 1, page: 1 }), [workspaceId]);
  const everything = useMemo(() => dashboardLoader("all"), []);
  const budgetLoader = useMemo(() => budgetsLoader(listQuery), [listQuery]);
  const goalLoader = useMemo(() => goalsLoader(listQuery), [listQuery]);

  const resources = {
    account: useResource(keys.accounts, loadAccounts, { enabled }),
    transaction: useResource(keys.dashboardFor("all"), everything, { enabled }),
    budget: useResource(keys.budgets("setup", 1), budgetLoader, { enabled }),
    goal: useResource(keys.goals("setup", 1), goalLoader, { enabled }),
  };
  const readers = {
    account: (data) => hasAccount(data, workspaceId),
    transaction: (data) => hasTransactions(data, workspaceId),
    budget: (data) => hasListTotal(data, "budgets"),
    goal: (data) => hasListTotal(data, "savings_goals"),
  };
  const checking = enabled && SETUP_STEPS.some((step) => resources[step].loading);
  const refreshing = SETUP_STEPS.some((step) => resources[step].refreshing);
  const states = Object.fromEntries(SETUP_STEPS.map((step) => [step, enabled ? stepState(resources[step], readers[step]) : null]));

  return { states, checking, refreshing, enabled, reload: () => SETUP_STEPS.forEach((step) => resources[step].reload()) };
}

function StepBadge({ state, index }) {
  if (state === true) return <span className="sm-guide-badge" data-sm-badge="done" aria-hidden="true"><LuCheck /></span>;
  if (state === null) return <span className="sm-guide-badge" data-sm-badge="unknown" aria-hidden="true"><LuCircleHelp /></span>;
  return <span className="sm-guide-badge" data-sm-badge="todo" aria-hidden="true">{index + 1}</span>;
}

/*
 * Getting started, read-only: the full version's four first steps, each worked out from a read this app already makes
 * (models/setup.js). A step is done only when the backend says so; a read that fails leaves it "couldn't check" and
 * not counted. Nothing is saved or dismissed here, and since Mobile cannot create accounts, expenses, budgets or goals
 * yet, a step that is not done opens the full version, where it can be.
 */
export default function MobileGettingStarted() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const workspaceId = planningWorkspaceId();
  const setup = useSetup(workspaceId);
  const known = SETUP_STEPS.filter((step) => setup.states[step] !== null).length;
  const summary = summarize(SETUP_STEPS.map((step) => setup.states[step]));
  const percent = parsePercent(summary.percent);

  return (
    <section className="sm-page sm-guide" data-sm-screen="getting-started" data-sm-state={setup.checking ? "loading" : summary.complete ? "complete" : "ready"} aria-busy={setup.checking || undefined}>
      <section className="sm-card sm-hero sm-guide-hero" aria-labelledby="sm-guide-title" data-sm-section="progress">
        <div className="sm-card-head">
          <h2 id="sm-guide-title" className="sm-card-title">{t("guide.heroTitle")}</h2>
          {setup.enabled && <IconButton label={t(setup.refreshing ? "guide.refreshing" : "guide.refresh")} icon={LuRefreshCw} spinning={setup.refreshing} onClick={setup.reload} disabled={setup.refreshing || setup.checking} aria-busy={setup.refreshing} data-sm-action="recheck" />}
        </div>
        {setup.checking ? (
          <p className="sm-guide-lead" role="status">{t("guide.checking")}</p>
        ) : (
          <>
            <p className="sm-guide-lead" data-sm-progress={`${summary.done}/${summary.total}`}>{t("guide.progress", { done: summary.done, total: summary.total })}</p>
            {known > 0 && percent && <Progress percent={percent} tone="calm" spoken={t("guide.progress", { done: summary.done, total: summary.total })} />}
            {summary.unknown > 0 && <p className="sm-hero-note" data-sm-note="unknown">{setup.enabled ? t("guide.progressUnknown", { unknown: summary.unknown }) : t("guide.noWorkspace")}</p>}
          </>
        )}
        <p className="sm-hero-note">{t("guide.heroBody")}</p>
      </section>

      {setup.checking ? (
        <Skeleton lines={5} label={t("guide.checking")} />
      ) : (
        <ol className="sm-guide-steps" aria-label={t("guide.heroTitle")}>
          {SETUP_STEPS.map((step, index) => {
            const state = setup.states[step];
            const label = state === true ? "done" : state === null ? "unknown" : "todo";
            return (
              <li key={step} className="sm-card sm-guide-step" data-sm-step={step} data-sm-state={label}>
                <StepBadge state={state} index={index} />
                <div className="sm-guide-body">
                  <div className="sm-guide-head">
                    <h3 className="sm-row-title">{t(`guide.step.${step}.title`)}</h3>
                    <span className="sm-chip sm-guide-chip" data-sm-chip={label}>{t(`guide.state.${label}`)}</span>
                  </div>
                  <p className="sm-text sm-muted">{t(`guide.step.${step}.body`)}</p>
                  {state === null && <p className="sm-text sm-muted sm-fine" data-sm-note="unknown-step">{t("guide.unknownHint")}</p>}
                  {state === true ? (
                    <Link className="sm-link-row sm-guide-link" to={VIEW[step]} data-sm-action={`view-${step}`}>
                      <span>{t(`guide.view.${step}`)}</span>
                      <Chevron />
                    </Link>
                  ) : (
                    <Link className="sm-button sm-button-small sm-button-quiet sm-guide-cta" to={FULL[step]} data-sm-action={`setup-${step}`}>{t("guide.setUp")}</Link>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {summary.complete && !setup.checking && (
        <div className="sm-card sm-all-clear" role="status" data-sm-section="done">
          <span className="sm-all-clear-icon" aria-hidden="true"><LuCheck /></span>
          <h2 className="sm-card-title">{t("guide.allDoneTitle")}</h2>
          <p className="sm-text sm-muted">{t("guide.allDoneBody")}</p>
        </div>
      )}

      <p className="sm-draft-note" role="note" data-sm-note="read-only"><LuInfo aria-hidden="true" /><span>{t("guide.readOnly")}</span></p>

      <section className="sm-an-explore" aria-labelledby="sm-guide-explore" data-sm-section="explore">
        <h2 id="sm-guide-explore" className="sm-group-label">{t("guide.exploreTitle")}</h2>
        <ul className="sm-an-reports sm-guide-explore">
          {[[MOBILE_CAPTURES, LuScanLine, "captures"], [MOBILE_AI, LuSparkles, "assistant"], [MOBILE_REPORTS, LuChartColumn, "reports"]].map(([to, Icon, id]) => (
            <li key={id}>
              <Link className="sm-an-report" to={to} data-sm-explore={id}>
                <span className="sm-tile-icon" aria-hidden="true"><Icon /></span>
                <span className="sm-an-report-title">{t(`guide.explore.${id}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
