import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { FaWhatsapp } from "react-icons/fa";
import { LuChevronLeft, LuChevronRight, LuRefreshCw, LuSettings2 } from "react-icons/lu";

import { useAuthContext } from "../../../../contexts/auth/useAuthContext.js";
import { getSettingsTabPath } from "../../../../routes/Path.js";
import { accountsApi } from "../api/accountsApi.js";
import { whatsappApi } from "../api/whatsappApi.js";
import { parseDraftsPageResponse } from "../FinancialOperations/whatsappContract.js";
import { getDisplayLocale } from "../Accounts/accountHelpers.js";
import DraftRow from "./components/DraftRow/DraftRow.jsx";
import {
  DEFAULT_DRAFT_STATUS, DRAFT_PER_PAGE_OPTIONS, DRAFT_STATUS_ORDER,
  draftFiltersToQuery, draftFiltersToSearchParams, getDraftsErrorMessage,
  hasActiveDraftFilters, readDraftFilters,
} from "./draftHelpers.js";
import { useWhatsAppPending } from "../../../../contexts/whatsappPending/useWhatsAppPending.js";
import { useWhatsAppAvailability } from "../Settings/components/WhatsAppIntegration/useWhatsAppAvailability.js";

import "./WhatsAppDrafts.css";

const x = "dashboard.whatsappDrafts";

/*
 * WhatsApp expense draft inbox (read-only). Drafts are what the WhatsApp
 * conversation collected; none of them is a posted transaction until it is
 * confirmed, and confirming lives in a later task. This page never writes.
 *
 * Reads only: GET .../expense-drafts (a real backend page), .../summary (the
 * user's global pending count) and, for the account filter, the accounts list.
 * It does not look at whether WhatsApp is enabled to decide what to load:
 * historical drafts stay reviewable while the feature is off, and the backend
 * decides what the user may see. Availability is read only to explain it.
 *
 * Filters and page live in the URL (back/forward, refresh and sharing work),
 * anything invalid in it falls back to a default, and results are keyed by
 * session + filters + reload so an older answer can never replace a newer one
 * or another session's rows.
 *
 * Nothing private is stored: no localStorage, no cache across users.
 */
export default function WhatsAppDrafts({ api = whatsappApi, accounts: accountsClient = accountsApi }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const location = useLocation();
  const { user } = useAuthContext();
  const scope = String(user?.id ?? "anonymous");
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readDraftFilters(searchParams);
  const filterKey = draftFiltersToSearchParams(filters).toString();

  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${scope}|${filterKey}|${reloadKey}`;
  const [result, setResult] = useState({ key: null, page: null, error: null });

  // The global count is owned by the dashboard (one request for sidebar, Attention
  // Center, this page and Settings); here it is only read, re-read when old, and
  // re-read on a manual refresh.
  const summary = useWhatsAppPending();
  const { ensureFresh, refresh: refreshPending } = summary;
  useEffect(() => { ensureFresh(); }, [ensureFresh]);
  const availability = useWhatsAppAvailability(api);

  useEffect(() => {
    const controller = new AbortController();
    // Rebuilt from the key, so the request always matches the key it answers.
    const current = readDraftFilters(new URLSearchParams(filterKey));

    api
      .listDrafts(draftFiltersToQuery(current), { signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        setResult({ key: requestKey, page: parseDraftsPageResponse(response), error: null });
      })
      .catch((error) => {
        // A superseded request is aborted by the cleanup; it must stay silent.
        if (error?.name === "AbortError" || controller.signal.aborted) return;
        setResult({ key: requestKey, page: null, error });
      });

    return () => controller.abort();
  }, [api, filterKey, requestKey]);

  /* Accounts for the filter: the user's own active accounts, nothing else. */
  const [accountResult, setAccountResult] = useState({ key: null, items: [], failed: false });
  useEffect(() => {
    const controller = new AbortController();

    accountsClient
      .list({}, { signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        const list = Array.isArray(response?.data?.accounts) ? response.data.accounts : [];
        setAccountResult({
          key: scope,
          items: list.filter((account) => account.status === "active" && !account.savings_goal),
          failed: false,
        });
      })
      .catch((error) => {
        if (error?.name === "AbortError" || controller.signal.aborted) return;
        setAccountResult({ key: scope, items: [], failed: true });
      });

    return () => controller.abort();
  }, [accountsClient, scope]);

  const isLoading = result.key !== requestKey;
  const { page, error } = isLoading ? { page: null, error: null } : result;
  const rows = page?.items ?? [];
  const pagination = page?.pagination;
  const isFiltered = hasActiveDraftFilters(filters);
  const accountItems = accountResult.key === scope ? accountResult.items : [];
  const accountMissing = filters.account && !accountItems.some((account) => account.id === filters.account);

  const reload = () => { setReloadKey((key) => key + 1); refreshPending(); };
  // Any filter change returns to page 1: page 4 of one filter means nothing in another.
  const update = (changes) =>
    setSearchParams(draftFiltersToSearchParams({ ...filters, ...changes, page: 1 }));
  const clearFilters = () => setSearchParams(new URLSearchParams());

  // After a page change, focus moves to the list so keyboard and screen-reader
  // users land on the new rows instead of the pagination buttons.
  const panelRef = useRef(null);
  const focusAfterLoad = useRef(false);
  const goToPage = (next) => {
    focusAfterLoad.current = true;
    setSearchParams(draftFiltersToSearchParams({ ...filters, page: next }));
  };
  useEffect(() => {
    if (!isLoading && focusAfterLoad.current) {
      focusAfterLoad.current = false;
      panelRef.current?.focus({ preventScroll: true });
      panelRef.current?.scrollIntoView?.({ block: "start" });
    }
  }, [isLoading]);

  const disabledByServer = availability.data && availability.data.enabled === false;

  return (
    <div className="wad-page">
      <header className="wad-header">
        <div className="wad-header__title">
          <span className="wad-header__icon" aria-hidden="true"><FaWhatsapp /></span>
          <div>
            <h1>{t(`${x}.title`)}</h1>
            <p>{t(`${x}.subtitle`)}</p>
          </div>
        </div>

        <div className="wad-header__side">
          <p className="wad-pending" aria-live="polite">
            <span className="wad-pending__count">
              {summary.loading || summary.count === null
                ? "–"
                : <bdi dir="ltr">{new Intl.NumberFormat(locale).format(summary.count)}</bdi>}
            </span>
            <span className="wad-pending__label">
              {summary.error ? t(`${x}.summaryUnavailable`) : t(`${x}.pendingLabel`)}
            </span>
          </p>

          <div className="wad-header__actions">
            <button type="button" className="wad-button" onClick={reload} disabled={isLoading}>
              <LuRefreshCw aria-hidden="true" />
              {t(`${x}.refresh`)}
            </button>
            <Link className="wad-button wad-button--ghost" to={getSettingsTabPath("integrations")}>
              <LuSettings2 aria-hidden="true" />
              {t(`${x}.manage`)}
            </Link>
          </div>
        </div>
      </header>

      {disabledByServer && (
        <p className="wad-banner" role="note">{t(`${x}.disabledNote`)}</p>
      )}

      <form
        className="wad-filters"
        role="search"
        aria-label={t(`${x}.filters.label`)}
        onSubmit={(event) => event.preventDefault()}
      >
        <label>
          <span>{t(`${x}.filters.status`)}</span>
          <select value={filters.status} onChange={(event) => update({ status: event.target.value })}>
            {DRAFT_STATUS_ORDER.map((status) => (
              <option key={status} value={status}>{t(`${x}.statuses.${status}`)}</option>
            ))}
          </select>
        </label>

        <label>
          <span>{t(`${x}.filters.date`)}</span>
          <input
            type="date"
            value={filters.date}
            onChange={(event) => update({ date: event.target.value })}
          />
        </label>

        <label>
          <span>{t(`${x}.filters.account`)}</span>
          <select
            value={filters.account === "" ? "" : String(filters.account)}
            onChange={(event) => update({ account: event.target.value === "" ? "" : Number(event.target.value) })}
          >
            <option value="">{t(`${x}.filters.allAccounts`)}</option>
            {accountMissing && (
              <option value={String(filters.account)}>
                {t(`${x}.filters.otherAccount`, { id: filters.account })}
              </option>
            )}
            {accountItems.map((account) => (
              <option key={account.id} value={String(account.id)}>
                {account.name} · {account.currency_code}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>{t(`${x}.filters.perPage`)}</span>
          <select value={String(filters.per_page)} onChange={(event) => update({ per_page: Number(event.target.value) })}>
            {DRAFT_PER_PAGE_OPTIONS.map((size) => (
              <option key={size} value={String(size)}>{size}</option>
            ))}
          </select>
        </label>

        {isFiltered && (
          <button type="button" className="wad-button wad-button--ghost" onClick={clearFilters}>
            {t(`${x}.filters.reset`)}
          </button>
        )}
      </form>

      {accountResult.key === scope && accountResult.failed && (
        <p className="wad-hint">{t(`${x}.filters.accountsFailed`)}</p>
      )}

      <section
        className="wad-panel"
        ref={panelRef}
        tabIndex={-1}
        aria-busy={isLoading}
        aria-label={t(`${x}.listLabel`)}
      >
        {isLoading && (
          <div className="wad-skeletons" role="status">
            <span className="wad-sr-only">{t(`${x}.loading`)}</span>
            {[0, 1, 2].map((index) => <div className="wad-skeleton" key={index} aria-hidden="true" />)}
          </div>
        )}

        {!isLoading && error && (
          <div className="wad-state wad-state--error" role="alert">
            <p dir="auto">{getDraftsErrorMessage(error, t)}</p>
            <button type="button" className="wad-button" onClick={reload}>{t("common.retry")}</button>
          </div>
        )}

        {!isLoading && !error && rows.length === 0 && (
          <div className="wad-state">
            {pagination && pagination.total > 0 && pagination.currentPage > 1 ? (
              <>
                <p>{t(`${x}.empty.page`)}</p>
                <button type="button" className="wad-button" onClick={() => goToPage(1)}>
                  {t("dashboard.transactions.pagination.first")}
                </button>
              </>
            ) : isFiltered ? (
              <>
                <p>{t(`${x}.empty.filtered`)}</p>
                <button type="button" className="wad-button" onClick={clearFilters}>{t(`${x}.filters.reset`)}</button>
              </>
            ) : (
              <>
                <h2>{t(`${x}.empty.${filters.status === DEFAULT_DRAFT_STATUS ? "pendingTitle" : "noneTitle"}`)}</h2>
                <p>{t(`${x}.empty.${filters.status === DEFAULT_DRAFT_STATUS ? "pendingBody" : "noneBody"}`)}</p>
              </>
            )}
          </div>
        )}

        {!isLoading && !error && rows.length > 0 && (
          <div className="wad-rows" role="list">
            {rows.map((draft) => (
              <div role="listitem" key={draft.id}>
                {/* The live query string, so Back from details returns to these filters and page. */}
                <DraftRow draft={draft} locale={locale} listSearch={location.search} />
              </div>
            ))}
          </div>
        )}

        {!isLoading && !error && pagination && pagination.lastPage > 1 && (
          <footer className="wad-pagination">
            <span>
              {t("dashboard.transactions.pagination.summary", {
                from: pagination.from ?? 0, to: pagination.to ?? 0, total: pagination.total,
              })}
            </span>

            <div className="wad-pages">
              <button
                type="button"
                className="wad-button wad-button--icon"
                onClick={() => goToPage(pagination.currentPage - 1)}
                disabled={pagination.currentPage <= 1}
                aria-label={t("dashboard.transactions.pagination.previous")}
              >
                <LuChevronLeft aria-hidden="true" />
              </button>
              <span aria-live="polite">
                {t("dashboard.transactions.pagination.page", {
                  page: pagination.currentPage, lastPage: pagination.lastPage,
                })}
              </span>
              <button
                type="button"
                className="wad-button wad-button--icon"
                onClick={() => goToPage(pagination.currentPage + 1)}
                disabled={pagination.currentPage >= pagination.lastPage}
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
