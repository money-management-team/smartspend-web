import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuthContext } from "../../contexts/auth/useAuthContext";
import { PATH } from "../../routes/Path.js";
import { ACTIVITY_PER_PAGE } from "../data/readApi.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatDayHeading } from "../money/format.js";
import { DEFAULT_SORT, filtersToSearchParams, filterSignature, hasActiveFilters, readActivityFilters } from "../models/activity.js";
import Chevron from "../ui/Chevron.jsx";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import StaleNotice from "../ui/StaleNotice.jsx";
import ActivityFilters from "./ActivityFilters.jsx";
import { recallScroll, rememberScroll } from "./scrollMemory.js";
import TransactionRow from "./TransactionRow.jsx";
import { useActivityList } from "./useActivityList.js";

const MALFORMED = Object.freeze({ code: "MALFORMED_RESPONSE" });

/*
 * Mobile Activity: the user's transactions from GET /transactions, newest (or
 * oldest) first, grouped by day, with the filters the endpoint supports and
 * "Load more" for the server's next page.
 *
 * Filters live in the address (the same names as the Desktop list), so Back from
 * a transaction returns to the same view. How many pages are loaded lives in the
 * router state of that history entry, not in storage. Nothing is cached beyond
 * the identity scope's memory.
 */
export default function MobileActivity() {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const { user, workspace } = useAuthContext();
  const location = useLocation();
  const navigate = useNavigate();
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";
  const timeZone = user?.timezone ?? workspace?.timezone;
  const filters = readActivityFilters(location.search);
  const signature = filterSignature(filters);
  const filtered = hasActiveFilters(filters);
  const pages = Number.isInteger(location.state?.pages) && location.state.pages > 1 && location.state.pages <= 50 ? location.state.pages : 1;
  const list = useActivityList(filters, pages, timeZone);
  const [sheetOpen, setSheetOpen] = useState(false);
  const openerRef = useRef(null);
  const restored = useRef(null);

  // The address is the one place the filters live. Filters change in place (replace), and a new set starts at page 1.
  const setFilters = useCallback(
    (next) => {
      const search = filtersToSearchParams(next).toString();
      navigate({ pathname: location.pathname, search: search ? `?${search}` : "" }, { replace: true, state: null });
    },
    [navigate, location.pathname],
  );
  const loadMore = () => navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: { ...location.state, pages: pages + 1 } });
  const remove = (key) => setFilters({ ...filters, [key]: "" });
  const apply = (draft) => {
    setSheetOpen(false);
    setFilters(draft);
  };
  const refresh = () => {
    if (pages > 1) navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
    list.reload();
  };

  // Where the list was when a transaction was opened: remembered on the way out, restored once the rows are back.
  const ready = !list.loading && !list.failed;
  useEffect(() => {
    if (!ready || restored.current === signature) return;
    restored.current = signature;
    const top = recallScroll(signature);
    const main = document.getElementById("sm-main");
    if (top && main) main.scrollTop = top;
  }, [ready, signature]);
  useEffect(
    () => () => {
      rememberScroll(signature, document.getElementById("sm-main")?.scrollTop ?? 0);
    },
    [signature],
  );

  const fullVersion = (
    <Link className="sm-link-row" to={PATH.USER.FINANCIAL_OPERATIONS}>
      <span>{t("activity.openFull")}</span>
      <Chevron />
    </Link>
  );

  const toolbar = (
    <ActivityFilters open={sheetOpen} onOpen={() => setSheetOpen(true)} onClose={() => setSheetOpen(false)} openerRef={openerRef} filters={filters} onApply={apply} onRemove={remove} onResetAll={() => setFilters({ ...filters, type: "", status: "", account_id: "", category_id: "", date_from: "", date_to: "" })} />
  );

  if (list.loading) {
    return (
      <section className="sm-page" data-sm-screen="activity" data-sm-state="loading" aria-busy="true">
        {toolbar}
        <Skeleton lines={6} label={t("activity.loading")} />
      </section>
    );
  }

  if (list.failed) {
    return (
      <section className="sm-page" data-sm-screen="activity" data-sm-state="error">
        {toolbar}
        <ErrorPanel error={list.error ?? MALFORMED} onRetry={list.reload} retrying={list.refreshing} />
      </section>
    );
  }

  if (list.items.length === 0) {
    return (
      <section className="sm-page" data-sm-screen="activity" data-sm-state={filtered ? "empty-filtered" : "empty"}>
        {toolbar}
        {list.stale && <StaleNotice error={list.error} updatedAt={list.updatedAt} onRetry={list.reload} retrying={list.refreshing} />}
        <div className="sm-card">
          <h2 className="sm-card-title">{t(filtered ? "activity.emptyFiltered.title" : "activity.empty.title")}</h2>
          <p className="sm-text">{t(filtered ? "activity.emptyFiltered.body" : "activity.empty.body")}</p>
          {filtered ? (
            <button type="button" className="sm-button sm-button-quiet" onClick={() => setFilters({ ...filters, type: "", status: "", account_id: "", category_id: "", date_from: "", date_to: "" })}>{t("activity.resetAll")}</button>
          ) : (
            fullVersion
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="sm-page" data-sm-screen="activity" data-sm-state={list.stale ? "stale" : "ready"} data-sm-stale={list.stale ? "true" : undefined} data-sm-sort={filters.sort === DEFAULT_SORT ? "newest" : "oldest"}>
      {toolbar}

      <div className="sm-greeting">
        <p className="sm-text" data-sm-count={list.items.length}>
          {list.total != null ? t("activity.count", { shown: list.items.length, total: list.total }) : null}
        </p>
        <button type="button" className="sm-button sm-button-quiet sm-button-small" onClick={refresh} disabled={list.refreshing} aria-busy={list.refreshing}>
          {t(list.refreshing ? "home.refreshing" : "home.refresh")}
        </button>
      </div>

      {list.stale && <StaleNotice error={list.error} updatedAt={list.updatedAt} onRetry={list.reload} retrying={list.refreshing} />}

      <div className="sm-card sm-ledger">
        {list.groups.map((group, index) => {
          const id = `sm-day-${index}`;
          const heading = formatDayHeading(group.day, locale);

          return (
            <section key={`${group.day ?? "none"}-${index}`} aria-labelledby={id} data-sm-day={group.day ?? "none"}>
              <h2 id={id} className="sm-day-title">{heading ?? t("activity.dayUnknown")}</h2>
              <ul className="sm-list">
                {group.items.map((transaction) => (
                  <li key={transaction.id}>
                    <TransactionRow transaction={transaction} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {list.loadingMore && <Skeleton lines={2} label={t("activity.loadingMore")} />}
      {list.moreError && (
        <div className="sm-error sm-error-compact" role="alert" data-sm-error="more">
          <p className="sm-text">{t("activity.moreFailed")}</p>
          <button type="button" className="sm-button sm-button-quiet" onClick={() => list.retryPage(list.moreErrorPage)}>{t("errors.retry")}</button>
        </div>
      )}
      {list.canLoadMore && !list.loadingMore && (
        <button type="button" className="sm-button sm-button-quiet" onClick={loadMore} data-sm-more={pages + 1}>{t("activity.loadMore")}</button>
      )}
      {!list.canLoadMore && !list.loadingMore && !list.moreError && list.total > ACTIVITY_PER_PAGE && <p className="sm-text sm-muted sm-fine">{t("activity.end")}</p>}
    </section>
  );
}
