import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuArrowDown, LuBellRing, LuEye, LuInfo, LuRefreshCw, LuX } from "react-icons/lu";

import { ApiError } from "../../../api/apiClient";
import { savingsPlansApi } from "../../../api/savingsPlansApi";
import { translateEnum } from "../../../FinancialOperations/transactionHelpers";
import { MAX_SEEK_PAGES, PLAN_INSTALLMENTS_PAGE_SIZE, appendById, readPlanInstallments } from "../../planHistoryHelpers";
import { canReverseLegs, getInstallmentState, getSmartPlanErrorMessage } from "../../smartPlanHelpers";
import InstallmentTimeline from "../InstallmentTimeline/InstallmentTimeline";
import ReverseLegsDialog from "../ReverseLegsDialog/ReverseLegsDialog";

import "./PlanInstallments.css";

// Looking for a reminder's installment: the largest page the backend allows.
const SEEK_PAGE_SIZE = 50;

/*
 * One more page of a plan's installments, appended to the shown ones
 * (`key` ties it to one first-page result). State is set only when the
 * response arrives.
 */
function fetchMoreInstallments({ goalId, planId, key, page, perPage, signal, setMore }) {
  return savingsPlansApi
    .listPlanInstallments(goalId, planId, { per_page: perPage, page }, { signal })
    .then((response) => {
      const next = readPlanInstallments(response?.data, planId);
      // A page other than the one asked for would never let paging advance.
      if (!next || next.page !== page) throw new ApiError("", { code: "MALFORMED_RESPONSE" });
      setMore((current) => ({
        key,
        items: appendById(current.key === key ? current.items : [], next.items),
        page: next.page,
        lastPage: next.lastPage,
        loading: false,
        error: null,
      }));
    })
    .catch((error) => {
      if (error.name === "AbortError" || signal.aborted) return;
      setMore((current) => ({ ...current, key, loading: false, error }));
    });
}

/*
 * One plan's installments in plan history (GET …/plans/{plan}/installments),
 * for any plan — active, completed, discontinued or superseded — paginated,
 * in the same timeline as the plan panel. Read only, except reversing
 * payments split across several accounts, which opens the existing
 * ReverseLegsDialog (fresh GET …/funding-legs, explicit approval,
 * Idempotency-Key, POST …/reverse-legs). Reversing doesn't reopen a closed
 * plan: its status is the backend's and stays as it is.
 *
 * Reversal is offered only when the backend says this user manages the
 * plan (`savings_plan.can_manage`) and the installment still holds a
 * split payment (`canReverseLegs`); whether it is reversible now is the
 * funding-legs response's `reversal.eligible`, and the backend decides.
 *
 * `focusId` is a reminder's installment: pages are read until it is found,
 * then it is highlighted, scrolled to, and its current state is said — a
 * closed plan's installment is never offered for confirmation.
 *
 * `onReversed(data)` hands the reversal's response to the page (goal,
 * activity, history refresh). Refetched whenever `refreshKey` changes.
 */
export default function PlanInstallments({ goal, plan, refreshKey, money, day, focusId = null, onReversed }) {
  const { t, i18n } = useTranslation();
  const prefix = "dashboard.savingsGoals.planHistory.timeline";
  const goalId = goal.id;
  const planId = plan.id;
  const perPage = focusId ? SEEK_PAGE_SIZE : PLAN_INSTALLMENTS_PAGE_SIZE;
  const rootRef = useRef(null);

  const [reloadCount, setReloadCount] = useState(0);
  const lookupKey = `${goalId}|${planId}|${refreshKey}|${reloadCount}`;
  const [first, setFirst] = useState({ key: null, data: null, error: null });
  const [more, setMore] = useState({ key: null, items: [], page: 1, lastPage: 1, loading: false, error: null });
  const moreControllerRef = useRef(null);
  const [dialogId, setDialogId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [focusDismissed, setFocusDismissed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    savingsPlansApi
      .listPlanInstallments(goalId, planId, { per_page: perPage }, { signal: controller.signal })
      .then((response) => {
        const data = readPlanInstallments(response?.data, planId);
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
      moreControllerRef.current?.abort();
    };
  }, [goalId, planId, lookupKey, perPage]);

  const isLoading = first.key !== lookupKey;
  const data = first.data;
  const extra =
    more.key === first.key ? more : { items: [], page: data?.page ?? 1, lastPage: data?.lastPage ?? 1, loading: false, error: null };
  const items = data ? appendById(data.items, extra.items) : [];
  const hasMore = extra.page < Math.max(data?.lastPage ?? 1, extra.lastPage);
  const focused = focusId ? items.find((item) => String(item.id) === String(focusId)) : null;
  // Still reading pages to find the reminder's installment.
  // Stops when found, on the last page, on an error or after MAX_SEEK_PAGES.
  const seeking = Boolean(focusId && data && !isLoading && !focused && hasMore && !extra.error && extra.page < MAX_SEEK_PAGES);

  const seekPage = extra.page + 1;
  const firstKey = first.key;
  useEffect(() => {
    if (!seeking) return undefined;

    const controller = new AbortController();
    fetchMoreInstallments({ goalId, planId, key: firstKey, page: seekPage, perPage, signal: controller.signal, setMore });
    return () => controller.abort();
  }, [goalId, planId, seeking, seekPage, firstKey, perPage]);

  // Bring the reminder's installment into view once it is on the list.
  const focusedId = focused?.id ?? null;
  useEffect(() => {
    if (focusedId == null) return;

    const row = rootRef.current?.querySelector(`[data-installment-id="${focusedId}"]`);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    row?.scrollIntoView?.({ behavior: reduced ? "auto" : "smooth", block: "center" });
  }, [focusedId]);

  const reload = () => setReloadCount((count) => count + 1);

  if (isLoading && !data) {
    return (
      <div className="plan-installments plan-installments--loading" role="status">
        <span className="plan-installments__sr-only">{t(`${prefix}.loading`)}</span>
        <span />
        <span />
        <span />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="plan-installments__error" role="alert">
        <p>{getSmartPlanErrorMessage(first.error, t, i18n, "load")}</p>
        <button type="button" onClick={reload}>
          {t("common.retry")}
        </button>
      </div>
    );
  }

  // Permission only; each payment's eligibility comes from funding-legs.
  const canManage = data.plan.can_manage === true;
  const status = data.plan.status;
  const statusLabel = t(`dashboard.savingsGoals.planHistory.status.${status}`, { defaultValue: status });
  const dialogInstallment = dialogId != null ? items.find((item) => String(item.id) === String(dialogId)) : null;
  const showFocus = focusId != null && !focusDismissed;

  const loadMore = () => {
    if (extra.loading) return;

    const controller = new AbortController();
    moreControllerRef.current = controller;
    setMore({ ...extra, key: first.key, loading: true, error: null });
    fetchMoreInstallments({ goalId, planId, key: first.key, page: extra.page + 1, perPage, signal: controller.signal, setMore });
  };

  const handleReversed = (response) => {
    setDialogId(null);
    setNotice({ status: response?.savings_plan?.status ?? status });
    onReversed(response);
  };

  return (
    <div className="plan-installments" ref={rootRef}>
      {/* After a failed page the error says what happened; "not in this plan" would be a guess. */}
      {showFocus && (focused || seeking || !extra.error) && (
        <div className="plan-installments__focus" role="status">
          {seeking ? <LuRefreshCw className="plan-installments__spin" aria-hidden="true" /> : <LuBellRing aria-hidden="true" />}
          <p>
            {seeking
              ? t(`${prefix}.focus.seeking`)
              : focused
                ? t(`${prefix}.focus.found`, {
                    number: focused.sequence,
                    state: translateEnum(t, i18n, "dashboard.savingsGoals.smartPlan.timeline.states", getInstallmentState(focused)),
                    status: statusLabel,
                  })
                : t(`${prefix}.focus.missing`)}
          </p>
          <button type="button" onClick={() => setFocusDismissed(true)} aria-label={t("common.close")}>
            <LuX aria-hidden="true" />
          </button>
        </div>
      )}

      {notice && (
        <div className="plan-installments__notice" role="status">
          <p>
            {t(`${prefix}.reversedNotice`, {
              status: t(`dashboard.savingsGoals.planHistory.status.${notice.status}`, { defaultValue: notice.status }),
            })}
          </p>
          <button type="button" onClick={() => setNotice(null)} aria-label={t("common.close")}>
            <LuX aria-hidden="true" />
          </button>
        </div>
      )}

      {!canManage && (
        <p className="plan-installments__readonly">
          <LuEye aria-hidden="true" />
          <span>{t(`${prefix}.readOnly`)}</span>
        </p>
      )}

      <InstallmentTimeline
        plan={{ installments: items }}
        health={{}}
        canAct={false}
        canReverse={canManage && !isLoading}
        onAction={(type, installment) => {
          if (type !== "reverse" || !canReverseLegs(installment)) return;
          setNotice(null);
          setDialogId(installment.id);
        }}
        money={money}
        day={day}
        highlightId={showFocus ? focusedId : null}
      />

      {extra.error && (
        <div className="plan-installments__error" role="alert">
          <p>{getSmartPlanErrorMessage(extra.error, t, i18n, "load")}</p>
          <button type="button" onClick={loadMore}>
            {t("common.retry")}
          </button>
        </div>
      )}

      <div className="plan-installments__foot">
        <span className="plan-installments__count">
          {t(`${prefix}.shown`, { shown: items.length, total: data.total })}
        </span>
        {hasMore && !extra.error && !seeking && (
          <button type="button" className="plan-installments__more" onClick={loadMore} disabled={extra.loading} aria-busy={extra.loading || undefined}>
            <LuArrowDown aria-hidden="true" />
            <span>{t(extra.loading ? `${prefix}.loadingMore` : `${prefix}.more`)}</span>
          </button>
        )}
      </div>

      <p className="plan-installments__hint">
        <LuInfo aria-hidden="true" />
        <span>{t(`${prefix}.singleAccountHint`)}</span>
      </p>

      {dialogInstallment && canReverseLegs(dialogInstallment) && (
        <ReverseLegsDialog
          goal={goal}
          installment={dialogInstallment}
          disabled={isLoading}
          money={money}
          day={day}
          onReversed={handleReversed}
          onOutdated={reload}
          onClose={() => setDialogId(null)}
        />
      )}
    </div>
  );
}
