import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  LuArrowDown,
  LuCalendarRange,
  LuChevronDown,
  LuEye,
  LuListChecks,
  LuPiggyBank,
  LuTriangleAlert,
  LuCircleCheck,
  LuCircleSlash,
  LuHistory,
  LuInfo,
  LuLandmark,
  LuRefreshCw,
  LuTrophy,
} from "react-icons/lu";

import { ApiError } from "../../../api/apiClient";
import { savingsPlansApi } from "../../../api/savingsPlansApi";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import PrivateMoney from "../../../Experience/PrivateMoney";
import { translateEnum } from "../../../FinancialOperations/transactionHelpers";
import { formatDate, formatMoney } from "../../../utils/formatters";
import { getGoalCurrency } from "../../savingsGoalHelpers";
import {
  HISTORY_PAGE_SIZE,
  MAX_SEEK_PAGES,
  appendPlans,
  getCompletionPerformance,
  getEndingKey,
  getInstallmentShare,
  getPlanEndedAt,
  readFinancialSummary,
  readPlanHistory,
  toDateIn,
} from "../../planHistoryHelpers";
import { formatAllocation, getFrequencyLabel, getSmartPlanErrorMessage, isDateOnly } from "../../smartPlanHelpers";
import PlanInstallments from "../PlanInstallments/PlanInstallments";

import "./PlanHistory.css";

const STATUS_ICONS = {
  active: LuRefreshCw,
  completed: LuTrophy,
  discontinued: LuCircleSlash,
  superseded: LuCalendarRange,
};

/*
 * Every plan the goal has had, newest first (GET …/plans): the active one,
 * and the completed, discontinued and superseded history. Gated by the page
 * (VITE_SMART_SAVINGS_ENABLED). Renders nothing for a goal that never had a
 * plan. Read only: nothing here writes or moves money.
 *
 * Each plan's figures are what the plan agreed, how far it got and what
 * its own installment confirmations collected (`financial_summary`) —
 * never the goal's balance, which lives in the goal's progress and also
 * counts direct contributions, withdrawals and other plans. Totals are shown
 * only while `attribution.complete` is true.
 *
 * "Show installments" opens any plan's installments (PlanInstallments),
 * where an owner (`can_manage`) can reverse split payments through the
 * existing reversal dialog, closed plans included; `onInstallmentReversed`
 * hands that response to the page.
 *
 * A reminder for a plan that isn't active (`?plan=&installment=`) is opened
 * here: older pages are read until that plan is found, its card opens on
 * its installments, and PlanInstallments finds and highlights the row. An
 * active plan's reminder belongs to the plan panel.
 */
/*
 * One older page of plans, appended to the shown ones (`key` ties it to one
 * first-page result). State is set only when the response arrives.
 */
function fetchOlderPlans({ goalId, key, page, signal, setOlder }) {
  return savingsPlansApi
    .listHistory(goalId, { per_page: HISTORY_PAGE_SIZE, page }, { signal })
    .then((response) => {
      const next = readPlanHistory(response?.data, goalId);
      // A page other than the one asked for would never let paging advance.
      if (!next || next.page !== page) throw new ApiError("", { code: "MALFORMED_RESPONSE" });
      setOlder((current) => ({
        key,
        plans: appendPlans(current.key === key ? current.plans : [], next.plans),
        page: next.page,
        lastPage: next.lastPage,
        loading: false,
        error: null,
      }));
    })
    .catch((error) => {
      if (error.name === "AbortError" || signal.aborted) return;
      setOlder((current) => ({ ...current, key, loading: false, error }));
    });
}

export default function PlanHistory({ goal, refreshKey, timeZone, onInstallmentReversed }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const currency = getGoalCurrency(goal);
  const goalId = goal.id;
  const prefix = "dashboard.savingsGoals.planHistory";

  const [reloadCount, setReloadCount] = useState(0);
  const lookupKey = `${goalId}|${refreshKey}|${reloadCount}`;
  const [first, setFirst] = useState({ key: null, data: null, error: null });
  // Older pages, appended on request; belong to one first-page result.
  const [older, setOlder] = useState({ key: null, plans: [], page: 1, loading: false, error: null });
  const olderControllerRef = useRef(null);
  const [searchParams] = useSearchParams();
  const asId = (value) => (/^[1-9]\d{0,17}$/.test(value ?? "") ? value : null);
  const focusPlanId = asId(searchParams.get("plan"));
  const focusInstallmentId = asId(searchParams.get("installment"));

  useEffect(() => {
    const controller = new AbortController();

    savingsPlansApi
      .listHistory(goalId, { per_page: HISTORY_PAGE_SIZE }, { signal: controller.signal })
      .then((response) => {
        const data = readPlanHistory(response?.data, goalId);
        setFirst(
          data
            ? { key: lookupKey, data, error: null }
            : { key: lookupKey, data: null, error: new ApiError("", { code: "MALFORMED_RESPONSE" }) },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setFirst({ key: lookupKey, data: null, error });
      });

    return () => {
      controller.abort();
      olderControllerRef.current?.abort();
    };
  }, [goalId, lookupKey]);

  const isLoading = first.key !== lookupKey;
  const data = first.data;
  const olderCurrent = older.key === first.key ? older : { plans: [], page: data?.page ?? 1, loading: false, error: null };
  const plans = data ? appendPlans(data.plans, olderCurrent.plans) : [];
  const lastPage = Math.max(data?.lastPage ?? 1, olderCurrent.lastPage ?? 0);
  const hasMore = olderCurrent.page < lastPage;
  const focusPlan = focusPlanId ? plans.find((plan) => String(plan.id) === focusPlanId) : null;
  // Still looking for the reminder's plan on older pages.
  // Stops when found, on the last page, on an error or after MAX_SEEK_PAGES.
  const seekingPlan = Boolean(
    focusPlanId &&
      focusInstallmentId &&
      data &&
      !isLoading &&
      !focusPlan &&
      hasMore &&
      !olderCurrent.error &&
      olderCurrent.page < MAX_SEEK_PAGES,
  );

  const seekPage = olderCurrent.page + 1;
  const firstKey = first.key;
  useEffect(() => {
    if (!seekingPlan) return undefined;

    const controller = new AbortController();
    fetchOlderPlans({ goalId, key: firstKey, page: seekPage, signal: controller.signal, setOlder });
    return () => controller.abort();
  }, [goalId, seekingPlan, seekPage, firstKey]);

  if (isLoading && !data) {
    return (
      <section className="plan-history plan-history--loading" aria-labelledby="plan-history-title">
        <h2 id="plan-history-title" className="plan-history__sr-only">
          {t(`${prefix}.title`)}
        </h2>
        <div className="plan-history__skeleton" role="status">
          <span className="plan-history__sr-only">{t(`${prefix}.loading`)}</span>
          <span />
          <span />
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="plan-history" aria-labelledby="plan-history-title">
        <h2 id="plan-history-title">{t(`${prefix}.title`)}</h2>
        <div className="plan-history__error" role="alert">
          <p>{getSmartPlanErrorMessage(first.error, t, i18n, "load")}</p>
          <button type="button" onClick={() => setReloadCount((count) => count + 1)}>
            {t("common.retry")}
          </button>
        </div>
      </section>
    );
  }

  // A goal that never had a plan has no history to show.
  if (data.total === 0 && data.plans.length === 0) return null;

  const loadOlder = () => {
    if (olderCurrent.loading) return;

    const controller = new AbortController();
    olderControllerRef.current = controller;
    setOlder({ ...olderCurrent, key: first.key, loading: true, error: null });
    fetchOlderPlans({ goalId, key: first.key, page: olderCurrent.page + 1, signal: controller.signal, setOlder });
  };

  // A reminder whose plan isn't in this goal's history (or wasn't found within the seek limit).
  const focusMissing = Boolean(
    focusPlanId && focusInstallmentId && data && !focusPlan && !isLoading && !olderCurrent.error && !seekingPlan && !olderCurrent.loading,
  );

  const money = (value) =>
    value == null || value === "" ? (
      "—"
    ) : (
      <bdi dir="ltr">
        <PrivateMoney>{formatMoney(value, currency, locale)}</PrivateMoney>
      </bdi>
    );
  const day = (value) => {
    const date = toDateIn(value, timeZone);
    return isDateOnly(date) ? <bdi>{formatDate(date, locale)}</bdi> : "—";
  };
  const count = (value) => <bdi>{new Intl.NumberFormat(locale).format(Number(value) || 0)}</bdi>;

  return (
    <section className="plan-history" aria-labelledby="plan-history-title">
      <header className="plan-history__head">
        <p className="plan-history__eyebrow">
          <LuHistory aria-hidden="true" />
          <span>{t(`${prefix}.eyebrow`)}</span>
        </p>
        <h2 id="plan-history-title">{t(`${prefix}.title`)}</h2>
        <p className="plan-history__lead">{t(`${prefix}.lead`, { count: data.total })}</p>
        {isLoading && (
          <span className="plan-history__refreshing" role="status">
            <LuRefreshCw aria-hidden="true" />
            {t("dashboard.savingsGoals.smartPlan.refreshing")}
          </span>
        )}
      </header>

      {seekingPlan && (
        <p className="plan-history__seek" role="status">
          <LuRefreshCw aria-hidden="true" />
          {t(`${prefix}.focus.seeking`)}
        </p>
      )}
      {focusMissing && (
        <p className="plan-history__seek plan-history__seek--missing" role="status">
          <LuInfo aria-hidden="true" />
          {t(`${prefix}.focus.missing`)}
        </p>
      )}

      <ol className="plan-history__list">
        {plans.map((plan) => (
          <PlanHistoryCard
            key={plan.id}
            goal={goal}
            refreshKey={lookupKey}
            onInstallmentReversed={onInstallmentReversed}
            // The plan panel answers for the active plan's reminders.
            focusInstallmentId={String(plan.id) === focusPlanId && plan.status !== "active" ? focusInstallmentId : null}
            plan={plan}
            timeZone={timeZone}
            money={money}
            day={day}
            count={count}
            locale={locale}
            t={t}
            i18n={i18n}
          />
        ))}
      </ol>

      {olderCurrent.error && (
        <div className="plan-history__error" role="alert">
          <p>{getSmartPlanErrorMessage(olderCurrent.error, t, i18n, "load")}</p>
          <button type="button" onClick={loadOlder}>
            {t("common.retry")}
          </button>
        </div>
      )}

      {hasMore && !olderCurrent.error && (
        <button type="button" className="plan-history__more" onClick={loadOlder} disabled={olderCurrent.loading} aria-busy={olderCurrent.loading || undefined}>
          <LuArrowDown aria-hidden="true" />
          <span>{t(olderCurrent.loading ? `${prefix}.loadingMore` : `${prefix}.more`)}</span>
        </button>
      )}
    </section>
  );
}

// The active plan's installments, payments and reversals are in its panel.
function showActivePlan() {
  const target = document.getElementById("smart-plan-title");
  if (!target) return;

  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
}

function PlanHistoryCard({ goal, refreshKey, onInstallmentReversed, focusInstallmentId, plan, timeZone, money, day, count, locale, t, i18n }) {
  const prefix = "dashboard.savingsGoals.planHistory";
  const titleId = `plan-history-${plan.id}-title`;
  const panelId = `plan-history-${plan.id}-installments`;
  // Opened on its installments when a reminder points into this plan.
  const [expanded, setExpanded] = useState(() => focusInstallmentId != null);
  const financial = readFinancialSummary(plan.financial_summary);
  const viewOnly = plan.can_manage === false;
  const status = plan.status;
  const StatusIcon = STATUS_ICONS[status] ?? LuHistory;
  const intensity = translateEnum(t, i18n, "dashboard.savingsGoals.overview.intensity", plan.intensity);
  const frequency = getFrequencyLabel(plan);
  const summary = plan.installments_summary ?? {};
  const share = getInstallmentShare(summary);
  const endingKey = getEndingKey(plan);
  const performance = getCompletionPerformance(plan, timeZone);
  const revisions = Array.isArray(plan.funding_revisions) ? plan.funding_revisions : [];
  const sources = [...(plan.funding_sources ?? [])].sort((left, right) => Number(left.priority) - Number(right.priority));

  return (
    <li className={`plan-history__item plan-history__item--${status}`}>
      <article className="plan-history__card" aria-labelledby={titleId}>
        <header className="plan-history__card-head">
          <span className={`plan-history__status plan-history__status--${status}`}>
            <StatusIcon aria-hidden="true" />
            {t(`${prefix}.status.${status}`)}
          </span>
          <h3 id={titleId}>
            {t(`${prefix}.cardTitle`, { intensity })}
            {viewOnly && (
              <span className="plan-history__view-only">
                <LuEye aria-hidden="true" />
                {t(`${prefix}.viewOnly`)}
              </span>
            )}
          </h3>
          <p className="plan-history__dates">
            {status === "active" ? (
              <>
                {t(`${prefix}.activeSince`)} {day(plan.accepted_at)}
              </>
            ) : (
              <>
                {day(plan.accepted_at)} <span className="plan-history__arrow" aria-hidden="true">→</span>
                <span className="plan-history__sr-only">{t(`${prefix}.until`)}</span> {day(getPlanEndedAt(plan))}
              </>
            )}
          </p>
        </header>

        {performance && (
          <div className="plan-history__completion" role="group" aria-label={t(`${prefix}.completion.label`)}>
            <span className="plan-history__completion-icon" aria-hidden="true">
              <LuTrophy />
            </span>
            <div className="plan-history__completion-copy">
              <strong>
                {t(`${prefix}.completion.title`)} {day(performance.completedOn)}
              </strong>
              {performance.verdict && (
                <span className={`plan-history__pace plan-history__pace--${performance.verdict}`}>
                  {t(`${prefix}.completion.${performance.verdict}`, { count: performance.days })}
                </span>
              )}
              {financial?.effective != null && (
                <p className="plan-history__completion-saved">
                  {t(`${prefix}.completion.saved`)} <strong>{money(financial.effective)}</strong>
                </p>
              )}
              <p>{t(`${prefix}.completion.ledgerNote`)}</p>
            </div>
          </div>
        )}

        {financial && (
          <section className="plan-history__money" aria-label={t(`${prefix}.money.label`)}>
            <header>
              <LuPiggyBank aria-hidden="true" />
              <span>{t(`${prefix}.money.title`)}</span>
            </header>
            {financial.complete ? (
              <dl>
                <div className="plan-history__money-main">
                  <dt>{t(`${prefix}.money.effective`)}</dt>
                  <dd>{money(financial.effective)}</dd>
                </div>
                <div>
                  <dt>{t(`${prefix}.money.confirmed`)}</dt>
                  <dd>{money(financial.confirmed)}</dd>
                </div>
                <div>
                  <dt>{t(`${prefix}.money.reversed`)}</dt>
                  <dd>
                    {money(financial.reversed)}
                    {financial.reversedLegs > 0 && (
                      <small>{t(`${prefix}.money.reversedLegs`, { count: financial.reversedLegs })}</small>
                    )}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="plan-history__money-unknown" role="note">
                <LuTriangleAlert aria-hidden="true" />
                <span>{t(`${prefix}.money.incomplete`)}</span>
              </p>
            )}
            <p className="plan-history__money-note">{t(`${prefix}.money.note`)}</p>
          </section>
        )}

        <dl className="plan-history__facts">
          <div>
            <dt>{t(`${prefix}.facts.perInstallment`)}</dt>
            <dd>
              {money(plan.installment_amount)}
              {frequency && <small>{t(frequency.key, { count: frequency.count })}</small>}
            </dd>
          </div>
          <div>
            <dt>{t(`${prefix}.facts.setOut`)}</dt>
            <dd>{money(plan.baseline_remaining)}</dd>
          </div>
          <div>
            <dt>{t(`${prefix}.facts.schedule`)}</dt>
            <dd>
              {day(plan.start_date)} <span className="plan-history__arrow" aria-hidden="true">→</span>
              <span className="plan-history__sr-only">{t(`${prefix}.until`)}</span> {day(plan.expected_completion_date)}
            </dd>
          </div>
          <div>
            <dt>{t(`${prefix}.facts.funding`)}</dt>
            <dd className="plan-history__funding">
              <LuLandmark aria-hidden="true" />
              <span>
                {t(`dashboard.savingsGoals.smartPlan.funding.modes.${plan.funding_mode}`, { defaultValue: plan.funding_mode })}
                {sources.length > 0 && (
                  <small>
                    {/* One account per line, name and share isolated: in one string an Arabic and an English name reordered their shares. */}
                    {sources.map((source) => {
                      const allocation = plan.funding_mode === "allocated" ? formatAllocation(source.allocation_bps, locale) : null;
                      return (
                        <span key={source.account_id}>
                          <bdi>{source.account_name ?? `#${source.account_id}`}</bdi>
                          {allocation && <> <bdi>{allocation}</bdi></>}
                        </span>
                      );
                    })}
                  </small>
                )}
              </span>
            </dd>
          </div>
        </dl>

        <div className="plan-history__progress">
          <div className="plan-history__progress-head">
            <span>
              {t(`${prefix}.installments.confirmed`, { count: Number(summary.fulfilled) || 0 })}{" "}
              <span className="plan-history__muted">
                {t(`${prefix}.installments.of`)} {count(summary.total)}
              </span>
            </span>
            <span className="plan-history__muted">
              {Number(summary.open) > 0 && t(`${prefix}.installments.open`, { count: Number(summary.open) })}
              {Number(summary.open) > 0 && Number(summary.cancelled) > 0 && " · "}
              {Number(summary.cancelled) > 0 && t(`${prefix}.installments.cancelled`, { count: Number(summary.cancelled) })}
            </span>
          </div>
          <div
            className="plan-history__bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={share}
            aria-label={t(`${prefix}.installments.barLabel`)}
          >
            <span style={{ inlineSize: `${share}%` }} />
          </div>
        </div>

        {endingKey && (
          <p className="plan-history__ending">
            <LuCircleCheck aria-hidden="true" />
            <span>{t(`${prefix}.endings.${endingKey}`, { defaultValue: t(`${prefix}.status.${status}`) })}</span>
          </p>
        )}

        {revisions.length > 0 && (
          <details className="plan-history__revisions">
            <summary>{t(`${prefix}.revisions.summary`, { count: revisions.length })}</summary>
            <ul>
              {revisions.map((revision, index) => (
                <li key={`${revision.revised_at}-${index}`}>
                  {day(revision.revised_at)}{" "}
                  {t(`${prefix}.revisions.was`, {
                    mode: t(`dashboard.savingsGoals.smartPlan.funding.modes.${revision.previous_funding_mode}`, {
                      defaultValue: revision.previous_funding_mode ?? "—",
                    }),
                  })}
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="plan-history__access">
          <button
            type="button"
            className={`plan-history__toggle${expanded ? " plan-history__toggle--open" : ""}`}
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls={panelId}
          >
            <LuListChecks aria-hidden="true" />
            <span>{t(expanded ? `${prefix}.access.hide` : `${prefix}.access.show`, { count: Number(summary.total) || 0 })}</span>
            <LuChevronDown className="plan-history__toggle-chevron" aria-hidden="true" />
          </button>
          {status === "active" && (
            <span className="plan-history__access-note">
              <LuInfo aria-hidden="true" />
              <span>
                {t(`${prefix}.access.active`)}{" "}
                <button type="button" className="plan-history__link" onClick={showActivePlan}>
                  {t(`${prefix}.access.activeLink`)}
                </button>
              </span>
            </span>
          )}
        </div>

        {expanded && (
          <div id={panelId}>
            <PlanInstallments
              goal={goal}
              plan={plan}
              refreshKey={refreshKey}
              money={money}
              day={day}
              focusId={focusInstallmentId}
              onReversed={(data) => onInstallmentReversed?.(data)}
            />
          </div>
        )}
      </article>
    </li>
  );
}
