import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import Chevron from "../ui/Chevron.jsx";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import StaleNotice from "../ui/StaleNotice.jsx";

const MALFORMED = Object.freeze({ code: "MALFORMED_RESPONSE" });

/*
 * The body of a Planning list (budgets, goals, recurring rules): the filters,
 * then loading, error, empty, or the rows with "Load more", all from the one
 * `list` state of usePagedList. Every state a list can be in is drawn here once,
 * so the three lists cannot disagree about how a failure or an empty list looks.
 *
 * `fullPath` is the full-version page of the same thing: the only way to add,
 * change or archive what the list shows, said in words and offered as a link.
 */
export default function PagedListView({ screen, list, toolbar, filtered, onResetFilters, strings, pages, perPage, onLoadMore, onRefresh, fullPath, renderRow }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);

  if (list.loading) {
    return (
      <section className="sm-page" data-sm-screen={screen} data-sm-state="loading" aria-busy="true">
        {toolbar}
        <Skeleton lines={5} label={t(`${strings}.loading`)} />
      </section>
    );
  }

  if (list.failed) {
    return (
      <section className="sm-page" data-sm-screen={screen} data-sm-state="error">
        {toolbar}
        <ErrorPanel error={list.error ?? MALFORMED} onRetry={list.reload} retrying={list.refreshing} />
      </section>
    );
  }

  const fullVersion = (
    <Link className="sm-link-row" to={fullPath}>
      <span>{t(`${strings}.openFull`)}</span>
      <Chevron />
    </Link>
  );

  if (list.items.length === 0) {
    return (
      <section className="sm-page" data-sm-screen={screen} data-sm-state={filtered ? "empty-filtered" : "empty"}>
        {toolbar}
        {list.stale && <StaleNotice error={list.error} updatedAt={list.updatedAt} onRetry={list.reload} retrying={list.refreshing} />}
        <div className="sm-card">
          <h2 className="sm-card-title">{t(filtered ? `${strings}.emptyFiltered.title` : `${strings}.empty.title`)}</h2>
          <p className="sm-text">{t(filtered ? `${strings}.emptyFiltered.body` : `${strings}.empty.body`)}</p>
          {filtered ? <button type="button" className="sm-button sm-button-quiet" onClick={onResetFilters}>{t("planning.list.resetFilters")}</button> : fullVersion}
        </div>
      </section>
    );
  }

  return (
    <section className="sm-page" data-sm-screen={screen} data-sm-state={list.stale ? "stale" : "ready"} data-sm-stale={list.stale ? "true" : undefined}>
      {toolbar}

      <div className="sm-greeting">
        <p className="sm-text" data-sm-count={list.items.length}>
          {list.total != null ? t("planning.list.count", { shown: list.items.length, total: list.total }) : null}
        </p>
        <button type="button" className="sm-button sm-button-quiet sm-button-small" onClick={onRefresh} disabled={list.refreshing} aria-busy={list.refreshing}>
          {t(list.refreshing ? "home.refreshing" : "home.refresh")}
        </button>
      </div>

      {list.stale && <StaleNotice error={list.error} updatedAt={list.updatedAt} onRetry={list.reload} retrying={list.refreshing} />}

      <ul className="sm-card sm-list sm-plan-list">
        {list.items.map((item) => (
          <li key={item.id}>{renderRow(item)}</li>
        ))}
      </ul>

      {list.loadingMore && <Skeleton lines={2} label={t("planning.list.loadingMore")} />}
      {list.moreError && (
        <div className="sm-error sm-error-compact" role="alert" data-sm-error="more">
          <p className="sm-text">{t("planning.list.moreFailed")}</p>
          <button type="button" className="sm-button sm-button-quiet" onClick={() => list.retryPage(list.moreErrorPage)}>{t("errors.retry")}</button>
        </div>
      )}
      {list.canLoadMore && !list.loadingMore && (
        <button type="button" className="sm-button sm-button-quiet" onClick={onLoadMore} data-sm-more={pages + 1}>{t("planning.list.loadMore")}</button>
      )}
      {!list.canLoadMore && !list.loadingMore && !list.moreError && list.total > perPage && <p className="sm-text sm-muted sm-fine">{t("planning.list.end")}</p>}

      <p className="sm-text sm-muted sm-fine">{t(`${strings}.readOnly`)}</p>
      {fullVersion}
    </section>
  );
}
