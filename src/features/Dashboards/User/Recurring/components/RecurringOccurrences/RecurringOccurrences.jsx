import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";

import { getTransactionDetailsPath } from "../../../../../../routes/Path";
import { ApiError } from "../../../api/apiClient";
import { recurringTransactionsApi } from "../../../api/recurringTransactionsApi";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatDate, formatDateTime, formatMoney } from "../../../utils/formatters";
import RecurringBadge from "../RecurringBadge/RecurringBadge";
import {
  OCCURRENCE_STATUSES,
  getRecurringErrorMessage,
  isOverdueOccurrence,
  occurrenceFiltersToQuery,
  occurrenceFiltersToSearchParams,
  parsePage,
  readOccurrenceFilters,
} from "../../recurringHelpers";

import "./RecurringOccurrences.css";

/*
 * GET /recurring-transactions/{id}/occurrences: the rule's history, paginated
 * and filterable by status (kept in the URL next to the page's own params).
 * Every status stays listed — posted, skipped, failed and cancelled
 * occurrences are history, not noise. An occurrence with a `transaction_id`
 * produced a real transaction, linked here.
 *
 * `refreshKey` changes after an action on the rule, so the history is read
 * again from the backend.
 */
export default function RecurringOccurrences({ ruleId, currency, refreshKey, timeZone }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readOccurrenceFilters(searchParams);
  const filterKey = occurrenceFiltersToSearchParams(filters).toString();

  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${ruleId}:${filterKey}:${refreshKey}:${reloadKey}`;
  const [result, setResult] = useState({ key: null, page: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    const query = occurrenceFiltersToQuery(readOccurrenceFilters(new URLSearchParams(filterKey)));

    recurringTransactionsApi
      .listOccurrences(ruleId, query, { signal: controller.signal })
      .then((response) => {
        const parsed = parsePage(response, "occurrences");
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
  }, [ruleId, filterKey, requestKey]);

  const isLoading = result.key !== requestKey;
  const { page, error } = isLoading ? { page: null, error: null } : result;
  const items = page?.items ?? [];

  // Changes only the occurrence params; the rest of the URL is kept.
  const setFilters = (next) => {
    const params = new URLSearchParams(searchParams);
    params.delete("occurrence_status");
    params.delete("occurrences_page");
    occurrenceFiltersToSearchParams(next).forEach((value, key) => params.set(key, value));
    setSearchParams(params, { replace: true });
  };

  const money = (occurrence) =>
    occurrence.amount == null || occurrence.amount === ""
      ? "—"
      : formatMoney(occurrence.amount, occurrence.currency_code || currency || undefined, locale);

  return (
    <section className="recurring-occurrences" aria-labelledby="recurring-occurrences-title">
      <header className="recurring-occurrences__head">
        <div>
          <h2 id="recurring-occurrences-title">{t("dashboard.recurring.occurrences.title")}</h2>
          <p>{t("dashboard.recurring.occurrences.subtitle")}</p>
        </div>

        <label className="recurring-occurrences__filter">
          <span>{t("dashboard.recurring.fields.status")}</span>
          <select
            value={filters.occurrence_status}
            onChange={(event) => setFilters({ occurrence_status: event.target.value, page: 1 })}
            disabled={isLoading}
          >
            <option value="">{t("dashboard.recurring.filters.allStatuses")}</option>
            {OCCURRENCE_STATUSES.map((status) => (
              <option value={status} key={status}>
                {t(`dashboard.recurring.occurrenceStatuses.${status}`)}
              </option>
            ))}
          </select>
        </label>
      </header>

      {isLoading && (
        <p className="recurring-occurrences__state" role="status">
          {t("dashboard.recurring.occurrences.loading")}
        </p>
      )}

      {!isLoading && error && (
        <div className="recurring-occurrences__state recurring-occurrences__state--error" role="alert">
          <p>{getRecurringErrorMessage(error, t)}</p>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
            {t("common.retry")}
          </button>
        </div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <p className="recurring-occurrences__state">
          {t(
            filters.occurrence_status
              ? "dashboard.recurring.occurrences.emptyFiltered"
              : "dashboard.recurring.occurrences.empty",
          )}
        </p>
      )}

      {!isLoading && !error && items.length > 0 && (
        <div className="recurring-occurrences__scroll">
          <table className="recurring-occurrences__table">
            <thead>
              <tr>
                <th scope="col">{t("dashboard.recurring.fields.dueDate")}</th>
                <th scope="col">{t("dashboard.recurring.fields.status")}</th>
                <th scope="col">{t("dashboard.recurring.fields.amount")}</th>
                <th scope="col">{t("dashboard.recurring.fields.transaction")}</th>
                <th scope="col">{t("dashboard.recurring.fields.attempts")}</th>
                <th scope="col">{t("dashboard.recurring.fields.failureReason")}</th>
                <th scope="col">{t("dashboard.recurring.fields.processedAt")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((occurrence, index) => (
                <tr key={occurrence.id ?? `${occurrence.due_date}-${index}`}>
                  <td>
                    <span className="recurring-occurrences__due">
                      <bdi>{formatDate(occurrence.due_date, locale)}</bdi>
                      {isOverdueOccurrence(occurrence) && <RecurringBadge kind="overdue" />}
                    </span>
                  </td>
                  <td>
                    <RecurringBadge kind="occurrence" value={occurrence.status} />
                  </td>
                  <td>
                    <bdi>{money(occurrence)}</bdi>
                  </td>
                  <td>
                    {occurrence.transaction_id != null ? (
                      <Link to={getTransactionDetailsPath(occurrence.transaction_id)}>
                        {t("dashboard.recurring.occurrences.viewTransaction", { id: occurrence.transaction_id })}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <bdi>{occurrence.attempts ?? "—"}</bdi>
                  </td>
                  <td className="recurring-occurrences__reason" dir="auto">
                    {occurrence.failure_reason || "—"}
                  </td>
                  <td>
                    {occurrence.processed_at ? (
                      <bdi>{formatDateTime(occurrence.processed_at, locale, timeZone)}</bdi>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && !error && page && page.lastPage > 1 && (
        <footer className="recurring-occurrences__pagination">
          <span>
            {t("dashboard.transactions.pagination.summary", { from: page.from, to: page.to, total: page.total })}
          </span>
          <div className="recurring-occurrences__pages">
            <button
              type="button"
              onClick={() => setFilters({ ...filters, page: page.page - 1 })}
              disabled={page.page <= 1}
              aria-label={t("dashboard.transactions.pagination.previous")}
            >
              <LuChevronLeft aria-hidden="true" />
            </button>
            <span aria-live="polite">
              {t("dashboard.transactions.pagination.page", { page: page.page, lastPage: page.lastPage })}
            </span>
            <button
              type="button"
              onClick={() => setFilters({ ...filters, page: page.page + 1 })}
              disabled={page.page >= page.lastPage}
              aria-label={t("dashboard.transactions.pagination.next")}
            >
              <LuChevronRight aria-hidden="true" />
            </button>
          </div>
        </footer>
      )}
    </section>
  );
}
