import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { LuArrowRight, LuLandmark, LuRefreshCw, LuSparkles, LuX } from "react-icons/lu";

import { ApiError } from "../../../api/apiClient";
import { savingsPlansApi } from "../../../api/savingsPlansApi";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import PrivateMoney from "../../../Experience/PrivateMoney";
import { translateEnum } from "../../../FinancialOperations/transactionHelpers";
import { formatDate, formatMoney } from "../../../utils/formatters";
import { getGoalSmartPlanPath } from "../../../../../../routes/Path";
import { getGoalCurrency, getGoalProgress, getGoalStatus } from "../../savingsGoalHelpers";
import {
  formatAllocation,
  getFrequencyLabel,
  getSmartPlanErrorMessage,
  isDateOnly,
  isOpenInstallment,
  readPlanResponse,
} from "../../smartPlanHelpers";
import { canHaveActivePlan } from "../../smartSavings";
import ConfirmInstallmentDialog from "../ConfirmInstallmentDialog/ConfirmInstallmentDialog";
import InstallmentTimeline from "../InstallmentTimeline/InstallmentTimeline";
import PlanHealth from "../PlanHealth/PlanHealth";
import PostponeInstallmentDialog from "../PostponeInstallmentDialog/PostponeInstallmentDialog";
import SkipInstallmentDialog from "../SkipInstallmentDialog/SkipInstallmentDialog";

import "./SmartPlanPanel.css";

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
 * `onInstallmentConfirmed(data)` hands the confirmation's response to the
 * page, which shows the goal it returns and refreshes the activity.
 */
export default function SmartPlanPanel({ goal, refreshKey, timeZone, onInstallmentConfirmed }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const currency = getGoalCurrency(goal);
  const goalId = goal.id;
  const prefix = "dashboard.savingsGoals.smartPlan";

  const [reloadCount, setReloadCount] = useState(0);
  const lookupKey = canHaveActivePlan(goal) ? `${goalId}|${refreshKey}|${reloadCount}` : null;
  const [result, setResult] = useState({ key: null, goalId: null, data: null, error: null, flexible: false });
  // { type: "confirm" | "postpone" | "skip", installmentId }
  const [dialog, setDialog] = useState(null);
  // One-time message after a postpone / skip: { action, sequence, date }.
  const [notice, setNotice] = useState(null);
  // Arriving from the plan wizard: a one-time "plan ready" message.
  const location = useLocation();
  const [createdDismissed, setCreatedDismissed] = useState(false);
  const showCreated = location.state?.smartPlanCreated === true && !createdDismissed;

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
    <section className={`smart-plan${modifier}`} aria-labelledby="smart-plan-title">
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
  const canAct = !isRefreshing && health.executable !== false && getGoalStatus(goal) === "active";

  const dialogInstallment = dialog
    ? plan.installments.find((installment) => String(installment.id) === String(dialog.installmentId))
    : null;
  const dialogIsOpen = isOpenInstallment(dialogInstallment);
  const closeDialog = () => setDialog(null);

  const handleAction = (type, installment) => {
    setNotice(null);
    setDialog({ type, installmentId: installment.id });
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

      {dialog && !dialogIsOpen && !isRefreshing && (
        <div className="smart-plan__notice smart-plan__notice--info" role="status">
          <p>{t(`${prefix}.notices.closed`)}</p>
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
            onAction={handleAction}
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
                    <span dir="auto">{source.account_name ?? `#${source.account_id}`}</span>
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
        <ConfirmInstallmentDialog {...dialogProps} onConfirmed={handleConfirmed} />
      )}
      {dialogIsOpen && dialog.type === "postpone" && (
        <PostponeInstallmentDialog {...dialogProps} timeZone={timeZone} onDone={handleScheduleDone} />
      )}
      {dialogIsOpen && dialog.type === "skip" && (
        <SkipInstallmentDialog {...dialogProps} onDone={handleScheduleDone} />
      )}
    </>,
  );
}
