import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { LuChevronLeft, LuChevronRight, LuX } from "react-icons/lu";

import Loading from "../../../../components/Loading/Loading";
import { getRecurringDetailsPath, getTransactionDetailsPath } from "../../../../routes/Path";
import { ApiError } from "../api/apiClient";
import { recurringTransactionsApi } from "../api/recurringTransactionsApi";
import RecurringActionDialog from "./components/RecurringActionDialog/RecurringActionDialog";
import RecurringFilters from "./components/RecurringFilters/RecurringFilters";
import RecurringForm from "./components/RecurringForm/RecurringForm";
import RecurringHeader from "./components/RecurringHeader/RecurringHeader";
import RecurringOperationRow from "./components/RecurringOperationRow/RecurringOperationRow";
import RecurringSection from "./components/RecurringSection/RecurringSection";
import {
  getRecurringErrorMessage,
  getRuleActions,
  hasActiveRecurringFilters,
  isRuleEntity,
  parsePage,
  readRecurringFilters,
  recurringFiltersToQuery,
  recurringFiltersToSearchParams,
} from "./recurringHelpers";

import "./Recurring.css";

// Request of each dialog action. Only "confirm" moves money.
const ACTION_REQUESTS = {
  pause: (rule) => recurringTransactionsApi.pause(rule.id),
  resume: (rule) => recurringTransactionsApi.resume(rule.id),
  archive: (rule) => recurringTransactionsApi.archive(rule.id),
  confirm: (rule) => recurringTransactionsApi.confirmNext(rule.id),
  skip: (rule, reason) => recurringTransactionsApi.skipNext(rule.id, reason),
};

// Which action each row button opens, checked against the rule's status.
const ACTION_PERMISSIONS = {
  pause: "canPause",
  resume: "canResume",
  archive: "canArchive",
  confirm: "canConfirm",
  skip: "canSkip",
};

/*
 * Recurring rules (GET /recurring-transactions, paginated, filtered in the
 * URL). Creating, editing and every action happen in modals; after any write
 * the list is refetched, because the backend decides the rule's new status,
 * next due date and place in the list. Nothing here touches a balance.
 */
export default function Recurring() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readRecurringFilters(searchParams);
  const filterKey = recurringFiltersToSearchParams(filters).toString();

  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${filterKey}:${reloadKey}`;
  const [result, setResult] = useState({ key: null, page: null, error: null });

  // { rule: null, presetType } to create, { rule } to edit.
  const [formState, setFormState] = useState(null);
  // { action, rule }
  const [actionState, setActionState] = useState(null);
  // One-time message: { key, name, ruleId, transactionId }.
  const [notice, setNotice] = useState(null);
  const saveRequestRef = useRef(null);
  // Set when an action failed in a way that may leave the list out of date.
  const staleRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const query = recurringFiltersToQuery(readRecurringFilters(new URLSearchParams(filterKey)));

    recurringTransactionsApi
      .list(query, { signal: controller.signal })
      .then((response) => {
        const parsed = parsePage(response, "recurring_transactions");

        setResult(
          parsed
            ? { key: requestKey, page: parsed, error: null }
            : { key: requestKey, page: null, error: new ApiError("", { code: "MALFORMED_RESPONSE" }) },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setResult({ key: requestKey, page: null, error });
      });

    return () => controller.abort();
  }, [filterKey, requestKey]);

  const isLoading = result.key !== requestKey;
  const { page: listPage, error } = isLoading ? { page: null, error: null } : result;
  const items = listPage?.items ?? [];
  const isFiltered = hasActiveRecurringFilters(filters);

  const reload = () => setReloadKey((key) => key + 1);

  const updateFilters = (changes) =>
    setSearchParams(recurringFiltersToSearchParams({ ...filters, ...changes, page: 1 }));

  const clearFilters = () => setSearchParams(new URLSearchParams());

  const goToPage = (page) => setSearchParams(recurringFiltersToSearchParams({ ...filters, page }));

  /* ---------- Create / edit ---------- */

  const handleSave = async (payload) => {
    if (saveRequestRef.current) return saveRequestRef.current;

    const ruleBeingEdited = formState?.rule;
    const saveRequest = (async () => {
      let response;

      try {
        response = ruleBeingEdited
          ? await recurringTransactionsApi.update(ruleBeingEdited.id, payload)
          : await recurringTransactionsApi.create(payload);
      } catch (requestError) {
        // Gone, or archived meanwhile: the list is out of date.
        if (["NOT_FOUND", "CONFLICT"].includes(requestError?.code)) reload();
        throw requestError;
      }

      const savedRule = response?.data?.recurring_transaction;

      setFormState(null);
      setNotice({
        key: ruleBeingEdited ? "updateSuccess" : "createSuccess",
        name: savedRule?.name ?? payload.name ?? ruleBeingEdited?.name,
        ruleId: isRuleEntity(savedRule) ? savedRule.id : (ruleBeingEdited?.id ?? null),
      });
      reload();
    })();

    saveRequestRef.current = saveRequest;

    try {
      return await saveRequest;
    } finally {
      if (saveRequestRef.current === saveRequest) saveRequestRef.current = null;
    }
  };

  /* ---------- Actions ---------- */

  // Called by RecurringActionDialog; errors are shown inside the dialog.
  const handleAction = async (reason) => {
    const { action, rule } = actionState;
    const response = await ACTION_REQUESTS[action](rule, reason);

    staleRef.current = false;
    setActionState(null);
    setNotice({
      key: `${action}Success`,
      name: response?.data?.recurring_transaction?.name ?? rule.name,
      ruleId: rule.id,
      transactionId: action === "confirm" ? (response?.data?.occurrence?.transaction_id ?? null) : null,
    });
    reload();
  };

  const closeActionDialog = () => {
    setActionState(null);

    if (staleRef.current) {
      staleRef.current = false;
      reload();
    }
  };

  const openAction = (action, rule) => {
    if (getRuleActions(rule)[ACTION_PERMISSIONS[action]]) setActionState({ action, rule });
  };

  const openEditForm = (rule) => {
    if (getRuleActions(rule).canEdit) setFormState({ rule });
  };

  const openCreateForm = (presetType) => setFormState({ rule: null, presetType });

  /* ---------- Render ---------- */

  return (
    <div className="recurring-page">
      <RecurringHeader onAdd={openCreateForm} />

      {notice && (
        <div className="recurring-page__notice" role="status">
          <p dir="auto">
            {t(`dashboard.recurring.notices.${notice.key}`, { name: notice.name })}
            {notice.transactionId != null && (
              <>
                {" "}
                <Link to={getTransactionDetailsPath(notice.transactionId)}>
                  {t("dashboard.recurring.notices.viewTransaction")}
                </Link>
              </>
            )}
            {notice.ruleId != null && (
              <>
                {" "}
                <Link to={getRecurringDetailsPath(notice.ruleId)}>
                  {t("dashboard.recurring.notices.viewRule")}
                </Link>
              </>
            )}
          </p>
          <button type="button" onClick={() => setNotice(null)} aria-label={t("common.close")}>
            <LuX aria-hidden="true" />
          </button>
        </div>
      )}

      <RecurringFilters filters={filters} onChange={updateFilters} onClear={clearFilters} disabled={isLoading} />

      {isLoading && <Loading message={t("dashboard.recurring.states.loading")} />}

      {!isLoading && error && (
        <div className="recurring-page__state recurring-page__state--error" role="alert">
          <p>{getRecurringErrorMessage(error, t)}</p>
          <button type="button" onClick={reload}>
            {t("common.retry")}
          </button>
        </div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <div className="recurring-page__state">
          {listPage && listPage.total > 0 && listPage.page > 1 ? (
            <>
              <p>{t("dashboard.recurring.states.emptyPage")}</p>
              <button type="button" onClick={() => goToPage(1)}>
                {t("dashboard.transactions.pagination.first")}
              </button>
            </>
          ) : isFiltered ? (
            <>
              <p>{t("dashboard.recurring.states.emptyFiltered")}</p>
              <button type="button" onClick={clearFilters}>
                {t("dashboard.recurring.filters.clear")}
              </button>
            </>
          ) : (
            <>
              <p>{t("dashboard.recurring.states.empty")}</p>
              <button type="button" onClick={() => openCreateForm("expense")}>
                {t("dashboard.recurring.actions.addExpense")}
              </button>
            </>
          )}
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <RecurringSection
          title={t("dashboard.recurring.sections.rules", { count: listPage.total })}
          subtitle={t("dashboard.recurring.sections.rulesSubtitle")}
        >
          {items.map((rule) => (
            <RecurringOperationRow
              key={rule.id}
              rule={rule}
              onConfirm={() => openAction("confirm", rule)}
              onEdit={() => openEditForm(rule)}
              onPause={() => openAction("pause", rule)}
              onResume={() => openAction("resume", rule)}
              onArchive={() => openAction("archive", rule)}
            />
          ))}
        </RecurringSection>
      )}

      {!isLoading && !error && listPage && listPage.lastPage > 1 && (
        <footer className="recurring-page__pagination">
          <span>
            {t("dashboard.transactions.pagination.summary", {
              from: listPage.from,
              to: listPage.to,
              total: listPage.total,
            })}
          </span>

          <div className="recurring-page__pages">
            <button
              type="button"
              onClick={() => goToPage(listPage.page - 1)}
              disabled={listPage.page <= 1}
              aria-label={t("dashboard.transactions.pagination.previous")}
            >
              <LuChevronLeft aria-hidden="true" />
            </button>
            <span aria-live="polite">
              {t("dashboard.transactions.pagination.page", {
                page: listPage.page,
                lastPage: listPage.lastPage,
              })}
            </span>
            <button
              type="button"
              onClick={() => goToPage(listPage.page + 1)}
              disabled={listPage.page >= listPage.lastPage}
              aria-label={t("dashboard.transactions.pagination.next")}
            >
              <LuChevronRight aria-hidden="true" />
            </button>
          </div>
        </footer>
      )}

      {formState && (
        <RecurringForm
          rule={formState.rule}
          presetType={formState.presetType}
          onSave={handleSave}
          onClose={() => setFormState(null)}
        />
      )}

      {actionState && (
        <RecurringActionDialog
          action={actionState.action}
          rule={actionState.rule}
          onConfirm={handleAction}
          onClose={closeActionDialog}
          onOutdated={() => {
            staleRef.current = true;
          }}
        />
      )}
    </div>
  );
}
