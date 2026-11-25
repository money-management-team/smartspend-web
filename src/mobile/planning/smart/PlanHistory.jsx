import { useCallback, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { keys } from "../../data/loaders.js";
import { sessionWorkspace } from "../../data/readApi.js";
import { PLAN_HISTORY_PER_PAGE, PLAN_INSTALLMENTS_PER_PAGE, readFundingLegs, readPlanHistory, readPlanInstallments } from "../../data/readPlanApi.js";
import { useResource } from "../../data/useResource.js";
import { MOBILE_NAMESPACE } from "../../i18n/messages.js";
import { formatDay } from "../../money/format.js";
import Money from "../../money/Money.jsx";
import ErrorPanel from "../../ui/ErrorPanel.jsx";
import Skeleton from "../../ui/Skeleton.jsx";
import { usePagedList } from "../usePagedList.js";
import { buildFundingLegs, buildPlanHistoryPage, buildPlanInstallmentsPage } from "./planModel.js";

const MALFORMED = Object.freeze({ code: "MALFORMED_RESPONSE" });
const P = "planning.goals.plan";
const H = `${P}.history`;
const I = `${H}.installments`;
const F = `${I}.payments`;

function readLegs(data, installmentId) {
  try {
    return { legs: buildFundingLegs(data, installmentId), error: null };
  } catch (error) {
    return { legs: null, error };
  }
}

function PaymentLegs({ legs, goal, locale, timeZone, t }) {
  return (
    <ul className="sm-list" data-sm-list="funding-legs">
      {legs.map((leg) => (
        <li key={leg.key} className="sm-row" data-sm-leg={leg.key} data-sm-leg-state={leg.effective ? "effective" : "reversed"}>
          <span className="sm-row-main">
            <span className="sm-row-title"><bdi>{leg.account ?? t(`${F}.account`)}</bdi></span>
            <span className="sm-row-meta">
              <Money plain value={leg.amount ?? undefined} currency={leg.currency ?? goal.currency} />
              {" · "}
              {leg.effective ? t(`${F}.inGoal`) : leg.reversedAt ? <>{t(`${F}.reversedOn`)} <bdi>{formatDay(leg.reversedAt, locale, timeZone)}</bdi></> : t(`${F}.reversed`)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/*
 * The payments behind one split installment (GET …/funding-legs), read once its "Show payments" is opened: the
 * current confirmation's accounts and amounts, then earlier confirmations. Read only: Mobile shows no way to
 * reverse a payment, and nothing here uses the response's reversal fields or adds amounts up.
 */
function InstallmentPayments({ goal, installment, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const loader = useMemo(() => async (signal) => (await readFundingLegs(goal.id, installment.id, signal)).data, [goal.id, installment.id]);
  const resource = useResource(keys.installmentFundingLegs(goal.id, installment.id), loader);
  const read = useMemo(() => (resource.data === undefined ? null : readLegs(resource.data, installment.id)), [resource.data, installment.id]);
  const timeZone = sessionWorkspace()?.timezone;
  const when = (value) => (value ? <bdi>{formatDay(value, locale, timeZone)}</bdi> : "—");

  if (resource.loading) return <Skeleton lines={2} label={t(`${F}.loading`)} />;
  if (resource.status === "error" || !read?.legs) return <ErrorPanel error={resource.error ?? read?.error ?? MALFORMED} onRetry={resource.reload} retrying={resource.refreshing} compact />;
  const { current, history } = read.legs;
  if ((!current || current.legs.length === 0) && history.every((cycle) => cycle.legs.length === 0)) {
    return <p className="sm-text sm-muted" data-sm-payments="empty">{t(`${F}.none`)}</p>;
  }

  return (
    <div className="sm-plan-earlier-panel" data-sm-payments="ready">
      {current && current.legs.length > 0 && (
        <div data-sm-payments-cycle="current">
          <p className="sm-row-meta">{t(`${F}.paidOn`)} {when(current.confirmedAt)}</p>
          <PaymentLegs legs={current.legs} goal={goal} locale={locale} timeZone={timeZone} t={t} />
        </div>
      )}
      {history.filter((cycle) => cycle.legs.length > 0).map((cycle) => (
        <div key={cycle.key} data-sm-payments-cycle="earlier">
          <p className="sm-row-meta">{t(`${F}.earlier`)} {when(cycle.confirmedAt)}</p>
          <PaymentLegs legs={cycle.legs} goal={goal} locale={locale} timeZone={timeZone} t={t} />
        </div>
      ))}
      <p className="sm-text sm-muted sm-fine">{t(`${F}.note`)}</p>
    </div>
  );
}

function InstallmentPaymentsToggle({ goal, installment, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <>
      <button type="button" className="sm-button sm-button-quiet sm-button-small" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)} data-sm-action="installment-payments">
        {t(open ? `${F}.hide` : `${F}.show`)}
      </button>
      <div id={panelId} hidden={!open}>{open && <InstallmentPayments goal={goal} installment={installment} locale={locale} />}</div>
    </>
  );
}

// One read per page, keyed by goal, plan and page (usePagedList); `signature` is "goalId:planId".
const installmentsKey = (signature, page) => {
  const [goalId, planId] = signature.split(":");
  return keys.goalPlanInstallments(goalId, planId, page);
};

/*
 * One earlier plan's installments (GET …/plans/{plan}/installments), mounted only once its row is opened: the
 * first page then, the next only on "Show more". Read only: no installment here can be confirmed, postponed,
 * skipped or reversed, and its payments (funding legs) are not read.
 */
function PlanInstallments({ goal, plan, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const [pages, setPages] = useState(1);
  const loaderFor = useCallback((page) => async (signal) => (await readPlanInstallments(goal.id, plan.id, page, signal)).data, [goal.id, plan.id]);
  const build = useCallback((data) => buildPlanInstallmentsPage(data, plan.id), [plan.id]);
  const list = usePagedList({ keyOf: installmentsKey, signature: `${goal.id}:${plan.id}`, pages, perPage: PLAN_INSTALLMENTS_PER_PAGE, loaderFor, build });
  const day = (value) => (value ? <bdi>{formatDay(value, locale, "UTC")}</bdi> : "—");

  if (list.loading) return <Skeleton lines={2} label={t(`${I}.loading`)} />;
  if (list.failed) return <ErrorPanel error={list.error?.code ? list.error : MALFORMED} onRetry={list.reload} retrying={list.refreshing} compact />;
  if (list.items.length === 0) return <p className="sm-text sm-muted" data-sm-installments="empty">{t(`${I}.none`)}</p>;

  return (
    <div className="sm-plan-earlier-panel" data-sm-installments="ready">
      <ul className="sm-list" data-sm-list="plan-installments">
        {list.items.map((item) => (
          <li key={item.id} className="sm-row" data-sm-installment={item.id} data-sm-status={item.state ?? "unknown"}>
            <span className="sm-row-main">
              <span className="sm-row-title">{t(`${P}.number`, { sequence: item.sequence ?? "?" })} · {day(item.date)}</span>
              <span className="sm-row-meta">
                {t(`${P}.status.${item.state}`, { defaultValue: item.state ?? "—" })}
                {item.scheduled && <> · {t(`${I}.scheduled`)} <Money plain value={item.scheduled} currency={goal.currency} /></>}
              </span>
              {item.confirmed && item.status === "fulfilled" && <span className="sm-row-meta">{t(`${I}.confirmed`)} <Money plain value={item.confirmed} currency={goal.currency} /></span>}
              {item.reversed && <span className="sm-row-meta">{t(`${I}.reversed`)} <Money plain value={item.reversed} currency={goal.currency} /></span>}
              {item.postponedCount ? <span className="sm-row-meta">{t(`${P}.postponedTimes`, { count: item.postponedCount })}{item.originalDate && <> · {t(`${I}.originally`)} {day(item.originalDate)}</>}</span> : null}
              {item.reason && <span className="sm-row-meta">{t(`${H}.ending.${item.reason}`)}</span>}
              {item.payments && <InstallmentPaymentsToggle goal={goal} installment={item} locale={locale} />}
            </span>
          </li>
        ))}
      </ul>
      {list.total !== null && <p className="sm-text sm-muted sm-fine" data-sm-installments-shown={list.items.length}>{t(`${I}.shown`, { shown: list.items.length, total: list.total })}</p>}
      {list.moreError ? (
        <ErrorPanel error={list.moreError?.code ? list.moreError : MALFORMED} onRetry={() => list.retryPage(list.moreErrorPage)} compact />
      ) : list.canLoadMore || list.loadingMore ? (
        <button type="button" className="sm-button sm-button-quiet sm-button-small" disabled={list.loadingMore} aria-busy={list.loadingMore || undefined} onClick={() => setPages(pages + 1)} data-sm-action="plan-installments-more">
          {t(list.loadingMore ? `${I}.loadingMore` : `${I}.more`)}
        </button>
      ) : null}
    </div>
  );
}

function PlanInstallmentsToggle({ goal, plan, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <>
      <button type="button" className="sm-button sm-button-quiet sm-button-small" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)} data-sm-action="plan-installments">
        {t(open ? `${I}.hide` : `${I}.show`, { count: plan.total ?? 0 })}
      </button>
      <div id={panelId} hidden={!open}>{open && <PlanInstallments goal={goal} plan={plan} locale={locale} />}</div>
    </>
  );
}

const historyKey = (goalId, page) => keys.goalPlanHistory(goalId, page);

/*
 * The pages of a goal's plan history (GET …/plans, newest first), one read per page (usePagedList): the first
 * once the history is first opened, each next one only on "Show more", until the paginator's last page. A plan
 * on two pages is shown once. A failed next page keeps the plans already shown and retries that page only.
 */
function PlanHistoryList({ goal, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const [pages, setPages] = useState(1);
  const loaderFor = useCallback((page) => async (signal) => (await readPlanHistory(goal.id, page, signal)).data, [goal.id]);
  const build = useCallback((data) => buildPlanHistoryPage(data, goal.id), [goal.id]);
  const list = usePagedList({ keyOf: historyKey, signature: String(goal.id), pages, perPage: PLAN_HISTORY_PER_PAGE, loaderFor, build });
  const timeZone = sessionWorkspace()?.timezone;
  const day = (value, zone) => {
    const text = value ? formatDay(value, locale, zone) : null;
    return text ? <bdi>{text}</bdi> : "—";
  };

  if (list.loading) return <Skeleton lines={2} label={t(`${H}.loading`)} />;
  if (list.failed) return <ErrorPanel error={list.error?.code ? list.error : MALFORMED} onRetry={list.reload} retrying={list.refreshing} compact />;

  // The active plan is the section above.
  const earlier = list.items.filter((plan) => plan.status !== "active");
  const more = list.moreError ? (
    <ErrorPanel error={list.moreError?.code ? list.moreError : MALFORMED} onRetry={() => list.retryPage(list.moreErrorPage)} compact />
  ) : list.canLoadMore || list.loadingMore ? (
    <button type="button" className="sm-button sm-button-quiet sm-button-small" disabled={list.loadingMore} aria-busy={list.loadingMore || undefined} onClick={() => setPages(pages + 1)} data-sm-action="plan-history-more">
      {t(list.loadingMore ? `${H}.loadingMore` : `${H}.loadMore`)}
    </button>
  ) : null;

  return (
    <>
      {earlier.length === 0 ? (
        !more && <p className="sm-text sm-muted" data-sm-history="empty">{t(`${H}.none`)}</p>
      ) : (
          <ul className="sm-list" data-sm-list="plan-history">
            {earlier.map((plan) => (
              <li key={plan.id} className="sm-row" data-sm-history-plan={plan.id} data-sm-status={plan.status}>
                <span className="sm-row-main">
                  <span className="sm-row-title">
                    {t(`${H}.version`, { version: plan.planVersion ?? "?" })}
                    {" · "}
                    <span className="sm-chip" data-sm-tone={plan.status === "completed" ? "calm" : "neutral"}>{t(`${H}.status.${plan.status}`)}</span>
                  </span>
                  <span className="sm-row-meta">{day(plan.acceptedAt, timeZone)} → {day(plan.endedAt, timeZone)}</span>
                  {(plan.installmentAmount || plan.frequency) && (
                    <span className="sm-row-meta">
                      {plan.installmentAmount && <><Money plain value={plan.installmentAmount} currency={goal.currency} />{" "}</>}
                      {plan.frequency && t(`${P}.every`, { count: plan.interval ?? 1, unit: t(`${P}.unit.${plan.frequency}`, { defaultValue: plan.frequency }) })}
                      {plan.intensity && <> · {t(`${P}.intensity.${plan.intensity}`, { defaultValue: plan.intensity })}</>}
                    </span>
                  )}
                  {plan.total !== null && <span className="sm-row-meta">{t(`${H}.confirmed`, { fulfilled: plan.fulfilled ?? 0, total: plan.total })}</span>}
                  {plan.ending && <span className="sm-row-meta">{t(`${H}.ending.${plan.ending}`)}</span>}
                  <PlanInstallmentsToggle goal={goal} plan={plan} locale={locale} />
                </span>
              </li>
            ))}
          </ul>
      )}
      {more}
    </>
  );
}

/*
 * A goal's earlier plans: completed, discontinued and replaced plans, each with its own figures. Read only, and
 * read only once the person opens it, so the goal's page makes no extra request by itself. Once opened the list
 * stays mounted while hidden, so its pages and any opened installments are kept. Each plan's installments open
 * from its row (PlanInstallments, read only). Funding and reversals are in the full version.
 */
export default function PlanHistory({ goal, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  const panelId = useId();
  const toggle = () => {
    setOpened(true);
    setOpen(!open);
  };

  return (
    <div className="sm-plan-earlier" data-sm-section="plan-history">
      <button type="button" className="sm-button sm-button-quiet sm-button-small" aria-expanded={open} aria-controls={panelId} onClick={toggle} data-sm-action="plan-history">
        {t(open ? `${H}.hide` : `${H}.show`)}
      </button>
      <div id={panelId} className="sm-plan-earlier-panel" hidden={!open}>
        {opened && <PlanHistoryList goal={goal} locale={locale} />}
        {open && <p className="sm-text sm-muted sm-fine">{t(`${H}.note`)}</p>}
      </div>
    </div>
  );
}
