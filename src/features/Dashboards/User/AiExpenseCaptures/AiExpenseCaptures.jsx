import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useSearchParams } from "react-router-dom";
import { LuChevronLeft, LuChevronRight, LuRefreshCw } from "react-icons/lu";

import Loading from "../../../../components/Loading/Loading";
import { ApiError, getApiErrorMessage } from "../api/apiClient";
import { aiExpenseCapturesApi } from "../api/aiExpenseCapturesApi";
import CaptureRow from "./components/CaptureRow/CaptureRow";
import {
  AI_CAPTURE_STATUSES,
  CAPTURES_PER_PAGE_OPTIONS,
  CAPTURE_SORT_DIRECTIONS,
} from "./captureConstants";
import {
  captureFiltersToQuery,
  captureFiltersToSearchParams,
  hasActiveCaptureFilters,
  parseCapturesPage,
  readCaptureFilters,
} from "./captureHelpers";

import "./AiExpenseCaptures.css";

/*
 * AI expense captures (GET /ai/expense-captures): receipts the backend's AI
 * has read, waiting for the user to review and confirm them. Nothing on this
 * page moves money — confirming a capture does, and that lives on the review
 * page.
 *
 * `data.captures` is a Laravel paginator, so paging is a real backend page,
 * never a client-side slice. Status, sort direction, page size and page all
 * live in the URL, so a reload keeps them and a filtered list can be shared.
 *
 * Rows show only what the list contract returns. Opening a capture arrives
 * with the review page in the next task; until then no action is rendered
 * rather than one that leads nowhere.
 */
export default function AiExpenseCaptures() {
  const { t } = useTranslation();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readCaptureFilters(searchParams);
  const filterKey = captureFiltersToSearchParams(filters).toString();
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${filterKey}:${reloadKey}`;
  const [result, setResult] = useState({ key: null, page: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    // Read back from the key, so the request matches the filters it is keyed
    // by even if the URL changed again in the same tick.
    const current = readCaptureFilters(new URLSearchParams(filterKey));

    aiExpenseCapturesApi
      .list(captureFiltersToQuery(current), { signal: controller.signal })
      .then((response) => {
        const page = parseCapturesPage(response);

        setResult(
          page
            ? { key: requestKey, page, error: null }
            : { key: requestKey, page: null, error: new ApiError("", { code: "MALFORMED_RESPONSE" }) },
        );
      })
      .catch((error) => {
        // A superseded request was aborted by the cleanup below; its answer
        // must never replace a newer one.
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setResult({ key: requestKey, page: null, error });
      });

    return () => controller.abort();
  }, [filterKey, requestKey]);

  // Derived, not stored: while a request is in flight the previous rows are
  // never shown as if they belonged to the new filters.
  const isLoading = result.key !== requestKey;
  const { page, error } = isLoading ? { page: null, error: null } : result;
  const rows = page?.items ?? [];
  const isFiltered = hasActiveCaptureFilters(filters);

  const reload = () => setReloadKey((key) => key + 1);
  // Any filter change restarts at page 1: page 4 of one filter is meaningless
  // under another.
  const update = (changes) =>
    setSearchParams(captureFiltersToSearchParams({ ...filters, ...changes, page: 1 }));
  const goToPage = (next) =>
    setSearchParams(captureFiltersToSearchParams({ ...filters, page: next }));
  const clearFilters = () => setSearchParams(new URLSearchParams());

  return (
    <div className="ai-captures-page">
      <header className="ai-captures-page__header">
        <div>
          <h1>{t("dashboard.aiCaptures.title")}</h1>
          <p>{t("dashboard.aiCaptures.subtitle")}</p>
        </div>

        <button
          type="button"
          className="ai-captures-page__refresh"
          onClick={reload}
          disabled={isLoading}
        >
          <LuRefreshCw aria-hidden="true" />
          {t("dashboard.aiCaptures.refresh")}
        </button>
      </header>

      <div
        className="ai-captures-page__filters"
        role="group"
        aria-label={t("dashboard.aiCaptures.filters.label")}
      >
        <label>
          <span>{t("dashboard.aiCaptures.filters.status")}</span>
          <select
            value={filters.status}
            onChange={(event) => update({ status: event.target.value })}
            disabled={isLoading}
          >
            {/* "All" sends no status parameter at all. */}
            <option value="">{t("dashboard.aiCaptures.filters.allStatuses")}</option>
            {AI_CAPTURE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`dashboard.aiCaptures.statuses.${status}`)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>{t("dashboard.aiCaptures.filters.sort")}</span>
          <select
            value={filters.sort_dir}
            onChange={(event) => update({ sort_dir: event.target.value })}
            disabled={isLoading}
          >
            {CAPTURE_SORT_DIRECTIONS.map((direction) => (
              <option key={direction} value={direction}>
                {t(`dashboard.aiCaptures.sort.${direction}`)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>{t("dashboard.aiCaptures.filters.perPage")}</span>
          <select
            value={String(filters.per_page)}
            onChange={(event) => update({ per_page: Number(event.target.value) })}
            disabled={isLoading}
          >
            {CAPTURES_PER_PAGE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        {isFiltered && (
          <button type="button" className="ai-captures-page__clear" onClick={clearFilters}>
            {t("dashboard.aiCaptures.filters.clear")}
          </button>
        )}
      </div>

      <section className="ai-captures-page__panel" aria-busy={isLoading}>
        {isLoading && <Loading message={t("dashboard.aiCaptures.loading")} />}

        {!isLoading && error && (
          <div className="ai-captures-page__state ai-captures-page__state--error" role="alert">
            <p dir="auto">{getApiErrorMessage(error, t)}</p>
            <button type="button" onClick={reload}>{t("common.retry")}</button>
          </div>
        )}

        {!isLoading && !error && rows.length === 0 && (
          <div className="ai-captures-page__state">
            {page && page.total > 0 && page.page > 1 ? (
              <>
                <p>{t("dashboard.aiCaptures.empty.page")}</p>
                <button type="button" onClick={() => goToPage(1)}>
                  {t("dashboard.transactions.pagination.first")}
                </button>
              </>
            ) : isFiltered ? (
              <>
                <p>{t("dashboard.aiCaptures.empty.filtered")}</p>
                <button type="button" onClick={clearFilters}>
                  {t("dashboard.aiCaptures.filters.clear")}
                </button>
              </>
            ) : (
              /* No "upload a receipt" call to action: Sprint 7 documents no
                 endpoint that creates a capture. */
              <p>{t("dashboard.aiCaptures.empty.none")}</p>
            )}
          </div>
        )}

        {!isLoading && !error && rows.length > 0 && (
          <div className="ai-captures-page__rows">
            {rows.map((capture) => (
              /* The live query string, so Back from the details page
                 returns to these filters and this page. */
              <CaptureRow
                key={capture.id}
                capture={capture}
                listSearch={location.search}
              />
            ))}
          </div>
        )}

        {!isLoading && !error && page && page.lastPage > 1 && (
          <footer className="ai-captures-page__pagination">
            <span>
              {t("dashboard.transactions.pagination.summary", {
                from: page.from,
                to: page.to,
                total: page.total,
              })}
            </span>

            <div className="ai-captures-page__pages">
              <button
                type="button"
                onClick={() => goToPage(page.page - 1)}
                disabled={page.page <= 1}
                aria-label={t("dashboard.transactions.pagination.previous")}
              >
                <LuChevronLeft aria-hidden="true" />
              </button>

              <span aria-live="polite">
                {t("dashboard.transactions.pagination.page", {
                  page: page.page,
                  lastPage: page.lastPage,
                })}
              </span>

              <button
                type="button"
                onClick={() => goToPage(page.page + 1)}
                disabled={page.page >= page.lastPage}
                aria-label={t("dashboard.transactions.pagination.next")}
              >
                <LuChevronRight aria-hidden="true" />
              </button>
            </div>
          </footer>
        )}
      </section>
    </div>
  );
}
