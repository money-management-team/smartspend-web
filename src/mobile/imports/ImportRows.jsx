import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

import { importRowsLoader, keys } from "../data/loaders.js";
import { useResource } from "../data/useResource.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatDay } from "../money/format.js";
import Money from "../money/Money.jsx";
import { IMPORT_ROW_TABS, IMPORT_ROWS_STATUSES } from "../models/importRowTabs.js";
import { buildImportRowsPage } from "../models/exportsImports.js";
import { activityDetailPath } from "../navigation.js";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import PageLinks from "../ui/PageLinks.jsx";
import { readPageParam, withParam } from "../ui/pageParam.js";
import Skeleton from "../ui/Skeleton.jsx";
import StaleNotice from "../ui/StaleNotice.jsx";
import StateChip from "../ui/StateChip.jsx";

const MALFORMED = Object.freeze({ code: "MALFORMED_RESPONSE" });
const ROW_TONES = { pending: "neutral", valid: "neutral", invalid: "bad", duplicate: "warn", ignored: "neutral", imported: "good", failed: "bad", reversed: "neutral" };

/*
 * The rows of an import, read-only (GET /imports/{id}/preview): each row of the statement as SmartSpend read it, in file
 * order, with its own status, its own amount and currency, and the backend's validation messages. The status tab and the
 * page live in the address (`?rows=` and `?rp=`), so Back and a shared link show the same slice. Tabs and paging are links:
 * nothing here fixes, ignores or imports a row, and nothing is filtered, sorted or added up in the browser. The
 * statement's own cells (`raw`) are not shown. Rows exist only once the statement has been checked, so before then the
 * card says so and asks for nothing.
 */
export default function ImportRows({ item, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const tab = IMPORT_ROW_TABS.includes(params.get("rows")) ? params.get("rows") : "all";
  const status = tab === "all" ? "" : tab;
  const page = readPageParam(params, "rp");
  const enabled = IMPORT_ROWS_STATUSES.includes(item.status);

  const loader = useMemo(() => importRowsLoader(item.id, status, page), [item.id, status, page]);
  const resource = useResource(keys.importRows(item.id, status, page), loader, { enabled });
  const parsed = useMemo(() => {
    if (resource.data === undefined) return { value: null, error: null };
    try {
      return { value: buildImportRowsPage(resource.data, { id: item.id }, { status, page }), error: null };
    } catch (error) {
      return { value: null, error };
    }
  }, [resource.data, item.id, status, page]);

  const here = `${location.pathname}${location.search}`;
  const hrefForTab = (next) => withParam(location, "rows", next === "all" ? null : next, { drop: ["rp"] });

  let body;
  if (!enabled) body = <p className="sm-text sm-muted" data-sm-rows="not-yet">{t("importView.rows.notYet")}</p>;
  else if (resource.loading) body = <Skeleton lines={3} label={t("importView.rows.loading")} />;
  else if (resource.status === "error" || parsed.error || !parsed.value) body = <ErrorPanel error={resource.error ?? parsed.error ?? MALFORMED} onRetry={resource.reload} retrying={resource.refreshing} compact />;
  else {
    const { rows, page: current, lastPage, total } = parsed.value;

    body = (
      <>
        {resource.stale && <StaleNotice error={resource.error} updatedAt={resource.updatedAt} onRetry={resource.reload} retrying={resource.refreshing} />}
        {rows.length === 0 && total > 0 ? (
          // An address that asks for a page past the end: the rows exist, so lead back to the first.
          <Link className="sm-card-link" to={withParam(location, "rp", null)} replace state={location.state} data-sm-rows="past-end">{t("importView.rows.newer")}</Link>
        ) : rows.length === 0 ? (
          <p className="sm-text sm-muted" data-sm-empty={tab}>{t(tab === "all" ? "importView.rows.empty.all" : "importView.rows.empty.filtered")}</p>
        ) : (
          <ul className="sm-list" data-sm-page={current}>
            {rows.map((row) => {
              const date = formatDay(row.date, locale);
              const type = row.type ? (row.typeKnown ? t(`importView.rows.type.${row.type}`) : row.type.replace(/_/g, " ")) : null;

              return (
                <li key={row.id} className="sm-row sm-import-row" data-sm-import-row={row.id} data-sm-row-status={row.status ?? "none"}>
                  <span className="sm-row-main">
                    <span className="sm-row-title">{t("importView.rows.number", { n: row.rowNumber })}{date && <> · <bdi>{date}</bdi></>}</span>
                    <span className="sm-row-meta sm-user-text"><bdi>{row.description ?? t("importView.rows.noDescription")}</bdi></span>
                    {(type || row.categoryName) && <span className="sm-row-meta">{[type, row.categoryName].filter(Boolean).map((part, index) => <span key={part}>{index > 0 && " · "}<bdi className={index > 0 ? "sm-user-text" : undefined}>{part}</bdi></span>)}</span>}
                    <span className="sm-chips-inline"><StateChip state={row.status} known={row.statusKnown} labels="importView.rows.status" tones={ROW_TONES} /></span>
                    {row.errors.length > 0 && (
                      <ul className="sm-import-errors" data-sm-row-errors={row.errors.length}>
                        {row.errors.map((message, index) => <li key={`${index}:${message}`} className="sm-text sm-fine sm-user-text">{message}</li>)}
                      </ul>
                    )}
                    {row.transactionId && <Link className="sm-note-link" to={activityDetailPath(row.transactionId)} state={{ from: here }} data-sm-link="row-movement">{t("importView.rows.movement")}</Link>}
                    {row.duplicateOfTransactionId && <Link className="sm-note-link" to={activityDetailPath(row.duplicateOfTransactionId)} state={{ from: here }} data-sm-link="row-duplicate">{t("importView.rows.duplicateOf")}</Link>}
                  </span>
                  <span className="sm-row-end">
                    <span className="sm-row-amount"><Money plain plus={row.type === "income"} value={row.amount} currency={row.currency} /></span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <PageLinks
          label={t("importView.rows.title")}
          name="rows"
          current={current}
          lastPage={lastPage}
          hrefFor={(next) => withParam(location, "rp", next > 1 ? next : null)}
          state={location.state}
          newer={t("importView.rows.newer")}
          older={t("importView.rows.older")}
          pageText={t("importView.rows.page", { page: current, pages: lastPage })}
        />
      </>
    );
  }

  return (
    <section className="sm-card" aria-labelledby="sm-import-rows" data-sm-section="import-rows" data-sm-tab={tab}>
      <h2 id="sm-import-rows" className="sm-card-title">{t("importView.rows.title")}</h2>
      <p className="sm-text sm-muted sm-fine">{t("importView.rows.hint")}</p>
      {enabled && (
        <nav className="sm-tabs sm-tabs-wrap" aria-label={t("importView.rows.tabsLabel")}>
          {IMPORT_ROW_TABS.map((value) => (
            <Link key={value} className="sm-tab" to={hrefForTab(value)} replace state={location.state} aria-current={value === tab ? "true" : undefined} data-sm-rows-tab={value}>
              {t(`importView.rows.tabs.${value}`)}
            </Link>
          ))}
        </nav>
      )}
      {body}
    </section>
  );
}
