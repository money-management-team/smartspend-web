import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { LuArrowRight, LuBellRing, LuCalendarClock, LuCircleStop, LuEye, LuLandmark, LuRefreshCw, LuSparkles, LuWallet, LuX } from "react-icons/lu";

import { ApiError } from "../../../api/apiClient";
import { savingsPlansApi } from "../../../api/savingsPlansApi";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import PrivateMoney from "../../../Experience/PrivateMoney";
import { translateEnum } from "../../../FinancialOperations/transactionHelpers";
import { formatDate, formatMoney } from "../../../utils/formatters";
import { getGoalPlanRevisionPath, getGoalSmartPlanPath } from "../../../../../../routes/Path";
import { getGoalCurrency, getGoalProgress, getGoalStatus } from "../../savingsGoalHelpers";
import {
  EDITABLE_FUNDING_MODES,
  canReverseLegs,
  formatAllocation,
  getInstallmentState,
  getOverdueInstallmentIds,
  getFrequencyLabel,
  getSmartPlanErrorMessage,
  isDateOnly,
  isOpenInstallment,
  readPlanResponse,
} from "../../smartPlanHelpers";
import { canHaveActivePlan } from "../../smartSavings";
import ConfirmInstallmentDialog from "../ConfirmInstallmentDialog/ConfirmInstallmentDialog";
import DiscontinuePlanDialog from "../DiscontinuePlanDialog/DiscontinuePlanDialog";
import FundingBreakdownDialog from "../FundingBreakdownDialog/FundingBreakdownDialog";
import InstallmentTimeline from "../InstallmentTimeline/InstallmentTimeline";
import PlanHealth from "../PlanHealth/PlanHealth";
import PostponeInstallmentDialog from "../PostponeInstallmentDialog/PostponeInstallmentDialog";
import ReverseLegsDialog from "../ReverseLegsDialog/ReverseLegsDialog";
import SkipInstallmentDialog from "../SkipInstallmentDialog/SkipInstallmentDialog";

import "./SmartPlanPanel.css";

/*
 * When an open dialog's installment changed under it — in another tab, or through this user's own
 * write whose response was lost (the dialog refetches on an unknown outcome) — and the change is a
 * recorded payment ("confirmed") or reversal ("reversed"), that outcome is reported as done rather
 * than "not started". Keyed by the installment's lock version so it is reported once. Reads only;
 * nothing is sent.
 */
function getSettledKey({ dialog, result, goalId, lookupKey }) {
  if (!dialog || !lookupKey || result.key !== lookupKey || String(result.goalId) !== String(goalId)) return null;
  const installment = result.data?.plan?.installments?.find((item) => String(item.id) === String(dialog.installmentId));
  if (!installment) return null;

  const outcome =
    (dialog.type === "confirm" || dialog.type === "fund") && installment.status === "fulfilled"
      ? "confirmed"
      : dialog.type === "reverse" && !canReverseLegs(installment) && installment.reversal_state !== "partially_reversed"
        ? "reversed"
        : null;

  return outcome ? `${outcome}:${installment.id}:${installment.lock_version}` : null;
}

/*
 * The goal's active smart plan (GET /savings-goals/{id}/plan), on the goal's
 * page. Gated by the page (VITE_SMART_SAVINGS_ENABLED). Renders nothing for
 * a flexible goal (404) and is not looked up for achieved or archived goals,
 * which can't have an active plan — they're never called flexible here.
 *
 * Every figure is the backend's: saved / remaining from `balance` (the
 * ledger), schedule and amounts from `savings_plan`, signals from
 * `plan_health`. The plan is fetched again whenever `refreshKey` changes
 * (money moved, goal paused or resumed) and after each installment action;
 * the last plan stays visible while it refreshes, with actions disabled.
 *
 * `onInstallmentConfirmed(data)` / `onInstallmentReversed(data)` hand a
 * confirmation's or reversal's response to the page, which shows the goal
 * it returns and refreshes the activity.
 *
 * Multi-account payments: an allocated plan confirms through
 * FundingBreakdownDialog; priority and at-confirmation plans keep the
 * single-account dialog, which can switch to it. ReverseLegsDialog reads an
 * installment's payments fresh (GET …/funding-legs) every time it opens.
 *
 * Managing the plan (F5): "Revise schedule" and "Change funding" open the
 * revision page (PATCH …/plan); "Discontinue" opens DiscontinuePlanDialog,
 * whose response goes to `onPlanDiscontinued(data)`. Arriving back from a
 * revision (`state.smartPlanRevised`) shows a one-time notice.
 *
 * Permission (F5.2): every action — confirm, postpone, skip, reverse,
 * revise, discontinue — is offered only when the backend says this user
 * manages the plan (`savings_plan.can_manage === true`). Anyone else sees
 * the plan read only. That is permission, not eligibility: each action
 * still checks the plan's and installment's state, and the backend decides.
 *
 * A savings reminder opens the goal with `?plan={id}&installment={id}`.
 * When that is this active plan (or no plan is named), the row is revealed
 * and highlighted, and a banner shows its current state; only an open
 * installment the user may act on gets "Review installment". A reminder for
 * an earlier plan is left to plan history, which opens that plan. Reviewing opens the usual
 * dialog, which fetches a fresh confirmation preview; nothing moves until
 * the user confirms there.
 */
export default function SmartPlanPanel({
  goal,
  refreshKey,
  timeZone,
  onInstallmentConfirmed,
  onInstallmentReversed,
  onPlanDiscontinued,
}) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const currency = getGoalCurrency(goal);
  const goalId = goal.id;
  const prefix = "dashboard.savingsGoals.smartPlan";

  const [reloadCount, setReloadCount] = useState(0);
  const lookupKey = canHaveActivePlan(goal) ? `${goalId}|${refreshKey}|${reloadCount}` : null;
  const [result, setResult] = useState({ key: null, goalId: null, data: null, error: null, flexible: false });
  // { type: "confirm" | "fund" | "postpone" | "skip" | "reverse", installmentId } or { type: "discontinue" }
  const [dialog, setDialog] = useState(null);
  // One-time message after a postpone / skip: { action, sequence, date }.
  const [notice, setNotice] = useState(null);
  // Arriving from the plan wizard: a one-time "plan ready" message.
  const location = useLocation();
  const [createdDismissed, setCreatedDismissed] = useState(false);
  const showCreated = location.state?.smartPlanCreated === true && !createdDismissed;
  const [revisedDismissed, setRevisedDismissed] = useState(false);
  const revised = ["schedule", "funding"].includes(location.state?.smartPlanRevised) && !revisedDismissed
    ? location.state.smartPlanRevised
    : null;
  // The plan and installment a savings reminder points to (`?plan=&installment=`).
  const [searchParams, setSearchParams] = useSearchParams();
  const asId = (value) => (/^[1-9]\d{0,17}$/.test(value ?? "") ? value : null);
  const requestedInstallment = asId(searchParams.get("installment"));
  const requestedPlan = asId(searchParams.get("plan"));
  // This panel answers for the active plan only; another plan is plan history's.
  const activePlanId = result.data?.plan?.id != null ? String(result.data.plan.id) : null;
  const focusIsHere = requestedInstallment != null && (requestedPlan == null || requestedPlan === activePlanId);
  const focusId = focusIsHere ? requestedInstallment : null;
  const panelRef = useRef(null);
  const hasPlan = result.data != null;

  useEffect(() => {
    if (!lookupKey) return undefined;

    const controller = new AbortController();

    savingsPlansApi
      .getActive(goalId, { signal: controller.signal })
      .then((response) => {
        const data = readPlanResponse(response?.data, goalId);

        setResult({
          key: lookupKey,
          goalId,
          data,
          error: data ? null : new ApiError("", { code: "MALFORMED_RESPONSE" }),
          flexible: false,
        });
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;

        // 404: no active plan, which is a flexible goal.
        setResult(
          error?.code === "NOT_FOUND"
            ? { key: lookupKey, goalId, data: null, error: null, flexible: true }
            : { key: lookupKey, goalId, data: null, error, flexible: false },
        );
      });

    return () => controller.abort();
  }, [goalId, lookupKey]);

  // Bring the reminded installment into view once the plan is shown.
  useEffect(() => {
    if (!focusId || !hasPlan) return;

    const row = panelRef.current?.querySelector(`[data-installment-id="${focusId}"]`);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    row?.scrollIntoView?.({ behavior: reduced ? "auto" : "smooth", block: "center" });
  }, [focusId, hasPlan]);

  // A payment or reversal that turned out to be recorded is reported once; the page refreshes the goal.
  const settledKey = getSettledKey({ dialog, result, goalId, lookupKey });
  const reportedRef = useRef(null);
  useEffect(() => {
    if (!settledKey || reportedRef.current === settledKey) return;
    reportedRef.current = settledKey;
    if (settledKey.startsWith("confirmed")) onInstallmentConfirmed(null);
    else onInstallmentReversed(null);
  }, [settledKey, onInstallmentConfirmed, onInstallmentReversed]);

  if (!lookupKey) return null;

  const isRefreshing = result.key !== lookupKey;
  const data = String(result.goalId) === String(goalId) ? result.data : null;

  // A flexible goal keeps its page; an active one with money still to save
  // is invited to take a plan (never paused, funded or archived goals).
  if (!isRefreshing && result.flexible) {
    const remaining = getGoalProgress(goal)?.remaining_amount;
    const canPlan =
      getGoalStatus(goal) === "active" && remaining != null && !/^-?0*(\.0*)?$/.test(String(remaining).trim());

    if (!canPlan) return null;

    return (
      <section className="smart-plan smart-plan--invite" aria-labelledby="smart-plan-invite-title">
        <p className="smart-plan__eyebrow">
          <LuSparkles aria-hidden="true" />
          <span>{t(`${prefix}.eyebrow`)}</span>
        </p>
        <div className="smart-plan__invite">
          <div>
            <h2 id="smart-plan-invite-title">{t(`${prefix}.invite.title`)}</h2>
            <p>{t(`${prefix}.invite.body`)}</p>
          </div>
          <Link className="smart-plan__invite-action" to={getGoalSmartPlanPath(goalId)}>
            <span>{t(`${prefix}.invite.action`)}</span>
            <LuArrowRight aria-hidden="true" />
          </Link>
        </div>
      </section>
    );
  }

  const reload = () => setReloadCount((count) => count + 1);

  const shell = (children, modifier = "") => (
    <section ref={panelRef} className={`smart-plan${modifier}`} aria-labelledby="smart-plan-title">
      {children}
    </section>
  );

  const eyebrow = (
    <p className="smart-plan__eyebrow">
      <LuSparkles aria-hidden="true" />
      <span>{t(`${prefix}.eyebrow`)}</span>
    </p>
  );

  if (!data) {
    if (isRefreshing) {
      return shell(
        <>
          {eyebrow}
          <h2 id="smart-plan-title" className="smart-plan__sr-only">
            {t(`${prefix}.eyebrow`)}
          </h2>
          <div className="smart-plan__skeleton" role="status">
            <span className="smart-plan__sr-only">{t(`${prefix}.loading`)}</span>
            <span />
            <span />
            <span />
          </div>
        </>,
        " smart-plan--loading",
      );
    }

    return shell(
      <>
        {eyebrow}
        <h2 id="smart-plan-title">{t(`${prefix}.errorTitle`)}</h2>
        <div className="smart-plan__error" role="alert">
          <p>{getSmartPlanErrorMessage(result.error, t, i18n, "load")}</p>
          <button type="button" onClick={reload}>
            {t("common.retry")}
          </button>
        </div>
      </>,
    );
  }

  const { plan, health, balance } = data;
  const managePrefix = "dashboard.savingsGoals.planManagement.actions";
  const reminderPrefix = "dashboard.savingsGoals.planManagement.reminder";

  const money = (value) =>
    value == null || value === "" ? (
      "—"
    ) : (
      <bdi dir="ltr">
        <PrivateMoney>{formatMoney(value, currency, locale)}</PrivateMoney>
      </bdi>
    );
  const day = (value) => (isDateOnly(value) ? <bdi>{formatDate(value, locale)}</bdi> : "—");

  const frequency = getFrequencyLabel(plan);
  const intensity = translateEnum(t, i18n, "dashboard.savingsGoals.overview.intensity", plan.intensity);
  const fundingMode = translateEnum(t, i18n, `${prefix}.funding.modes`, plan.funding_mode);
  const sources = [...(plan.funding_sources ?? [])].sort(
    (left, right) => Number(left.priority) - Number(right.priority),
  );
  // Permission from the backend; state checks follow per action.
  const canManage = plan.can_manage === true;
  const canAct = canManage && !isRefreshing && health.executable !== false && getGoalStatus(goal) === "active";

  const dialogInstallment = dialog
    ? plan.installments.find((installment) => String(installment.id) === String(dialog.installmentId))
    : null;
  // A dialog is shown only while its installment still allows it; the
  // discontinue dialog while there is an active plan to end.
  const dialogIsOpen =
    dialog?.type === "discontinue"
      ? true
      : dialog?.type === "reverse"
        ? canReverseLegs(dialogInstallment)
        : isOpenInstallment(dialogInstallment);
  const canReverse = canManage && !isRefreshing;
  const settled = settledKey ? settledKey.split(":")[0] : null;
  const focused = focusId ? plan.installments.find((installment) => String(installment.id) === focusId) : null;
  const focusedState = focused ? getInstallmentState(focused, getOverdueInstallmentIds(plan, health)) : null;
  const clearFocus = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("installment");
    next.delete("plan");
    setSearchParams(next, { replace: true, preventScrollReset: true });
  };
  const showHistory = () => {
    const target = document.getElementById("plan-history-title");
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    target?.scrollIntoView?.({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  const closeDialog = () => setDialog(null);

  const handleAction = (type, installment) => {
    setNotice(null);
    // An allocated plan always splits each installment across its accounts.
    const resolved = type === "confirm" && plan.funding_mode === "allocated" ? "fund" : type;
    setDialog({ type: resolved, installmentId: installment.id });
  };

  const handleScheduleDone = (outcome) => {
    setDialog(null);
    setNotice(outcome);
    reload();
  };

  const handleConfirmed = (response) => {
    setDialog(null);
    setNotice(null);
    onInstallmentConfirmed(response);
  };

  const handleReversed = (response) => {
    setDialog(null);
    setNotice(null);
    onInstallmentReversed(response);
  };

  const handleDiscontinued = (response) => {
    setDialog(null);
    setNotice(null);
    onPlanDiscontinued?.(response);
    reload();
  };

  const dialogProps = {
    goal,
    plan,
    installment: dialogInstallment,
    disabled: isRefreshing,
    money,
    day,
    onOutdated: reload,
    onClose: closeDialog,
  };

  const figures = [
    ["saved", money(balance.saved_amount)],
    ["remaining", money(balance.remaining_amount)],
    [
      "scheduled",
      money(health.outstanding_amount),
      health.outstanding_count != null &&
        t(`${prefix}.figures.openCount`, { count: Number(health.outstanding_count) }),
    ],
    [
      "perInstallment",
      money(plan.installment_amount),
      plan.final_installment_amount != null &&
        plan.final_installment_amount !== plan.installment_amount && (
          <>
            {t(`${prefix}.figures.finalInstallment`)} {money(plan.final_installment_amount)}
          </>
        ),
    ],
  ];

  const schedule = [
    ["start", day(plan.start_date)],
    ["expectedCompletion", day(plan.expected_completion_date)],
    health.completion_delayed === true && ["scheduledCompletion", day(health.scheduled_completion_date)],
    ["targetDate", day(plan.target_date)],
    ["installments", <bdi key="count">{new Intl.NumberFormat(locale).format(Number(plan.installment_count) || 0)}</bdi>],
  ].filter(Boolean);

  return shell(
    <>
      <header className="smart-plan__head">
        <div className="smart-plan__identity">
          {eyebrow}
          <h2 id="smart-plan-title">{t(`${prefix}.title`, { intensity })}</h2>
          {frequency && (
            <p className="smart-plan__rhythm">{t(frequency.key, { count: frequency.count })}</p>
          )}
        </div>

        {isRefreshing && (
          <span className="smart-plan__refreshing" role="status">
            <LuRefreshCw aria-hidden="true" />
            {t(`${prefix}.refreshing`)}
          </span>
        )}
      </header>

      {!isRefreshing && !canManage && (
        <p className="smart-plan__readonly">
          <LuEye aria-hidden="true" />
          <span>{t(`${managePrefix}.readOnly`)}</span>
        </p>
      )}

      {requestedInstallment && !focusIsHere && !isRefreshing && (
        <div className="smart-plan__reminder smart-plan__reminder--closed" role="status">
          <LuBellRing aria-hidden="true" />
          <div>
            <p>{t(`${reminderPrefix}.earlierPlan`)}</p>
            <button type="button" className="smart-plan__reminder-link" onClick={showHistory}>
              {t(`${reminderPrefix}.showHistory`)}
            </button>
          </div>
          <button type="button" className="smart-plan__reminder-close" onClick={clearFocus} aria-label={t("common.close")}>
            <LuX aria-hidden="true" />
          </button>
        </div>
      )}

      {focusId && !isRefreshing && (
        <div className={`smart-plan__reminder${focused && isOpenInstallment(focused) ? "" : " smart-plan__reminder--closed"}`} role="status">
          <LuBellRing aria-hidden="true" />
          <div>
            {focused && isOpenInstallment(focused) ? (
              <>
                <p>
                  <strong>{t(`${reminderPrefix}.title`, { number: focused.sequence })}</strong>
                  <span className="smart-plan__reminder-facts">
                    {day(focused.planned_date)} · {money(focused.amount)}
                  </span>
                </p>
                <p>{t(canAct ? `${reminderPrefix}.body` : `${reminderPrefix}.cannotAct`)}</p>
                {canAct && (
                  <button type="button" className="smart-plan__reminder-action" onClick={() => handleAction("confirm", focused)}>
                    {t(`${reminderPrefix}.review`)}
                  </button>
                )}
              </>
            ) : focused ? (
              // Already resolved: its current state, and nothing to confirm.
              <p>
                {t(`${reminderPrefix}.resolved`, {
                  number: focused.sequence,
                  state: translateEnum(t, i18n, `${prefix}.timeline.states`, focusedState),
                })}
              </p>
            ) : (
              <p>{t(`${reminderPrefix}.closed`)}</p>
            )}
          </div>
          <button type="button" className="smart-plan__reminder-close" onClick={clearFocus} aria-label={t("common.close")}>
            <LuX aria-hidden="true" />
          </button>
        </div>
      )}

      {!isRefreshing && canManage && (
        <nav className="smart-plan__manage" aria-label={t(`${managePrefix}.label`)}>
          <Link className="smart-plan__manage-action" to={getGoalPlanRevisionPath(goalId, "schedule")}>
            <LuCalendarClock aria-hidden="true" />
            <span>{t(`${managePrefix}.schedule`)}</span>
          </Link>
          <Link className="smart-plan__manage-action" to={getGoalPlanRevisionPath(goalId, "funding")}>
            <LuWallet aria-hidden="true" />
            <span>{t(`${managePrefix}.funding`)}</span>
          </Link>
          <button
            type="button"
            className="smart-plan__manage-action smart-plan__manage-action--caution"
            onClick={() => {
              setNotice(null);
              setDialog({ type: "discontinue" });
            }}
          >
            <LuCircleStop aria-hidden="true" />
            <span>{t(`${managePrefix}.discontinue`)}</span>
          </button>
        </nav>
      )}

      {revised && (
        <div className="smart-plan__notice" role="status">
          <p>{t(`${managePrefix}.notices.${revised}`)}</p>
          <button type="button" onClick={() => setRevisedDismissed(true)} aria-label={t("common.close")}>
            <LuX aria-hidden="true" />
          </button>
        </div>
      )}

      {showCreated && (
        <div className="smart-plan__notice" role="status">
          <p>{t(`${prefix}.notices.created`)}</p>
          <button type="button" onClick={() => setCreatedDismissed(true)} aria-label={t("common.close")}>
            <LuX aria-hidden="true" />
          </button>
        </div>
      )}

      {notice && (
        <div className="smart-plan__notice" role="status">
          <p>
            {t(`${prefix}.notices.${notice.action}`, { number: notice.sequence })}
            {notice.action === "postponed" && <> {day(notice.date)}</>}
            {" "}
            {t(`${prefix}.notices.noMoney`)}
          </p>
          <button type="button" onClick={() => setNotice(null)} aria-label={t("common.close")}>
            <LuX aria-hidden="true" />
          </button>
        </div>
      )}

      {dialog && !dialogIsOpen && !isRefreshing && !settled && (
        <div className="smart-plan__notice smart-plan__notice--info" role="status">
          <p>{t(`${prefix}.notices.closed`, { number: dialogInstallment?.sequence ?? "" })}</p>
          <button type="button" onClick={closeDialog} aria-label={t("common.close")}>
            <LuX aria-hidden="true" />
          </button>
        </div>
      )}

      <dl className="smart-plan__figures">
        {figures.map(([key, value, hint]) => (
          <div key={key} className="smart-plan__figure">
            <dt>{t(`${prefix}.figures.${key}`)}</dt>
            <dd>{value}</dd>
            {hint && <small>{hint}</small>}
          </div>
        ))}
      </dl>

      <div className="smart-plan__layout">
        <section className="smart-plan__timeline" aria-labelledby="smart-plan-timeline-title">
          <h3 id="smart-plan-timeline-title">{t(`${prefix}.timeline.title`)}</h3>
          {health.executable === false && (
            <p className="smart-plan__hint">{t(`${prefix}.timeline.onHold`)}</p>
          )}
          <InstallmentTimeline
            plan={plan}
            health={health}
            canAct={canAct}
            canReverse={canReverse}
            onAction={handleAction}
            highlightId={focusId}
            money={money}
            day={day}
          />
        </section>

        <aside className="smart-plan__aside">
          <PlanHealth health={health} money={money} day={day} />

          <section className="smart-plan__card" aria-labelledby="smart-plan-funding-title">
            <h3 id="smart-plan-funding-title">{t(`${prefix}.funding.title`)}</h3>
            <p className="smart-plan__mode">
              <LuLandmark aria-hidden="true" />
              <span>
                <strong>{fundingMode}</strong>
                <span>{t(`${prefix}.funding.hints.${plan.funding_mode}`, { defaultValue: "" })}</span>
              </span>
            </p>

            {sources.length > 0 && (
              <ol className="smart-plan__sources">
                {sources.map((source) => (
                  <li key={source.account_id}>
                    <span dir="auto" title={source.account_name ?? undefined}>{source.account_name ?? `#${source.account_id}`}</span>
                    {plan.funding_mode === "allocated" && source.allocation_bps != null && (
                      <bdi>{formatAllocation(source.allocation_bps, locale)}</bdi>
                    )}
                    {plan.funding_mode === "priority" && (
                      <small>{t(`${prefix}.funding.priority`, { number: source.priority })}</small>
                    )}
                  </li>
                ))}
              </ol>
            )}

            {plan.funding_mode === "allocated" && (
              <p className="smart-plan__hint">{t(`${prefix}.funding.allocatedLater`)}</p>
            )}
          </section>

          <section className="smart-plan__card" aria-labelledby="smart-plan-schedule-title">
            <h3 id="smart-plan-schedule-title">{t(`${prefix}.schedule.title`)}</h3>
            <dl className="smart-plan__facts">
              {schedule.map(([key, value]) => (
                <div key={key}>
                  <dt>{t(`${prefix}.schedule.${key}`)}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>

      {dialogIsOpen && dialog.type === "confirm" && (
        <ConfirmInstallmentDialog
          {...dialogProps}
          onConfirmed={handleConfirmed}
          onSplit={
            EDITABLE_FUNDING_MODES.includes(plan.funding_mode)
              ? () => setDialog({ type: "fund", installmentId: dialog.installmentId })
              : undefined
          }
        />
      )}
      {dialogIsOpen && dialog.type === "fund" && (
        <FundingBreakdownDialog {...dialogProps} mode={plan.funding_mode} onConfirmed={handleConfirmed} />
      )}
      {dialogIsOpen && dialog.type === "reverse" && (
        <ReverseLegsDialog {...dialogProps} onReversed={handleReversed} />
      )}
      {dialogIsOpen && dialog.type === "postpone" && (
        <PostponeInstallmentDialog {...dialogProps} timeZone={timeZone} onDone={handleScheduleDone} />
      )}
      {dialogIsOpen && dialog.type === "skip" && (
        <SkipInstallmentDialog {...dialogProps} onDone={handleScheduleDone} />
      )}
      {dialog?.type === "discontinue" && canManage && (
        <DiscontinuePlanDialog {...dialogProps} health={health} balance={balance} onDone={handleDiscontinued} />
      )}
    </>,
  );
}
