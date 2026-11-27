import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

import { keys, occurrencesLoader } from "../data/loaders.js";
import { useResource } from "../data/useResource.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatDay } from "../money/format.js";
import Money from "../money/Money.jsx";
import { OCCURRENCE_TABS } from "../models/occurrenceTabs.js";
import { buildOccurrencesPage } from "../models/recurring.js";
import { activityDetailPath } from "../navigation.js";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import PageLinks from "../ui/PageLinks.jsx";
import { readPageParam, withParam } from "../ui/pageParam.js";
import Skeleton from "../ui/Skeleton.jsx";
import StaleNotice from "../ui/StaleNotice.jsx";
import StateChip from "../ui/StateChip.jsx";
import { OCCURRENCE_TONES } from "./occurrenceTones.js";

const MALFORMED = Object.freeze({ code: "MALFORMED_RESPONSE" });

/*
 * A rule's occurrences, read-only (GET /recurring-transactions/{id}/occurrences): every due date the rule has made,
 * newest first as the backend orders it, from the ones still waiting to the posted, skipped, failed and cancelled ones.
 * The status and the page live in the address (`?occ=` and `?op=`), so Back and a shared link show the same slice. Tabs
 * and paging are links: nothing here confirms, skips or retries anything, and nothing is filtered, sorted or counted in
 * the browser. Whether an occurrence is overdue is the backend's own flag.
 */
export default function RuleOccurrences({ rule, locale, timeZone }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const tab = OCCURRENCE_TABS.includes(params.get("occ")) ? params.get("occ") : "all";
  const status = tab === "all" ? "" : tab;
  const page = readPageParam(params, "op");
  // Without a currency the amounts cannot be told from another currency's, so nothing is asked for.
  const enabled = Boolean(rule.currency);

  const loader = useMemo(() => occurrencesLoader(rule.id, status, page), [rule.id, status, page]);
  const resource = useResource(keys.occurrences(rule.id, status, page), loader, { enabled });
  const parsed = useMemo(() => {
    if (resource.data === undefined) return { value: null, error: null };
    try {
      return { value: buildOccurrencesPage(resource.data, { id: rule.id, currency: rule.currency }, { status, page }), error: null };
    } catch (error) {
      return { value: null, error };
    }
  }, [resource.data, rule.id, rule.currency, status, page]);

  const here = `${location.pathname}${location.search}`;
  const hrefForTab = (next) => withParam(location, "occ", next === "all" ? null : next, { drop: ["op"] });

  let body;
  if (!enabled) body = <p className="sm-text sm-muted" data-sm-section="unavailable">{t("ruleView.history.unavailable")}</p>;
  else if (resource.loading) body = <Skeleton lines={3} label={t("ruleView.history.loading")} />;
  else if (resource.status === "error" || parsed.error || !parsed.value) body = <ErrorPanel error={resource.error ?? parsed.error ?? MALFORMED} onRetry={resource.reload} retrying={resource.refreshing} compact />;
  else {
    const { rows, page: current, lastPage, total } = parsed.value;

    body = (
      <>
        {resource.stale && <StaleNotice error={resource.error} updatedAt={resource.updatedAt} onRetry={resource.reload} retrying={resource.refreshing} />}
        {rows.length === 0 && total > 0 ? (
          // An address that asks for a page past the end: the occurrences exist, so lead back to the newest.
          <Link className="sm-card-link" to={withParam(location, "op", null)} replace state={location.state} data-sm-occurrences="past-end">{t("ruleView.history.newer")}</Link>
        ) : rows.length === 0 ? (
          <p className="sm-text sm-muted" data-sm-empty={tab}>{t(tab === "all" ? "ruleView.history.empty.all" : "ruleView.history.empty.filtered")}</p>
        ) : (
          <ul className="sm-list" data-sm-page={current}>
            {rows.map((row) => {
              const due = formatDay(row.dueDate, locale);
              const processed = formatDay(row.processedAt, locale, timeZone);
              const showAttempts = row.attempts !== null && (row.status === "failed" || row.attempts > 1);

              return (
                <li key={row.id} className="sm-row sm-occurrence" data-sm-occurrence={row.id} data-sm-status={row.status ?? "none"} data-sm-overdue={row.overdue ? "true" : undefined}>
                  <span className="sm-row-main">
                    <span className="sm-row-title">{due ? <bdi>{due}</bdi> : "—"}</span>
                    <span className="sm-chips-inline">
                      {!(row.overdue && row.status === "due") && <StateChip state={row.status} known={row.statusKnown} labels="ruleView.occurrenceStatus" tones={OCCURRENCE_TONES} />}
                      {row.overdue && <span className="sm-chip sm-plan-chip" data-sm-tone="bad" data-sm-overdue-chip="true">{t("ruleView.overdue")}</span>}
                    </span>
                    {processed && <span className="sm-row-meta">{t("ruleView.history.processed", { date: processed })}</span>}
                    {showAttempts && <span className="sm-row-meta">{t("ruleView.history.attempts", { n: row.attempts })}</span>}
                    {row.failureReason && <span className="sm-text sm-fine sm-user-text sm-occurrence-reason">{t(row.status === "failed" ? "ruleView.next.reason" : "ruleView.history.reason")}: {row.failureReason}</span>}
                    {row.transactionId && <Link className="sm-note-link" to={activityDetailPath(row.transactionId)} state={{ from: here }} data-sm-link="occurrence-movement">{t("ruleView.history.movement")}</Link>}
                  </span>
                  <span className="sm-row-end">
                    <span className="sm-row-amount"><Money plain value={row.amount} currency={row.currency} /></span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <PageLinks
          label={t("ruleView.history.title")}
          name="occurrences"
          current={current}
          lastPage={lastPage}
          hrefFor={(next) => withParam(location, "op", next > 1 ? next : null)}
          state={location.state}
          newer={t("ruleView.history.newer")}
          older={t("ruleView.history.older")}
          pageText={t("ruleView.history.page", { page: current, pages: lastPage })}
        />
      </>
    );
  }

  return (
    <section className="sm-card" aria-labelledby="sm-rule-occurrences" data-sm-section="rule-occurrences" data-sm-tab={tab}>
      <h2 id="sm-rule-occurrences" className="sm-card-title">{t("ruleView.history.title")}</h2>
      <p className="sm-text sm-muted sm-fine">{t("ruleView.history.hint")}</p>
      <nav className="sm-tabs sm-tabs-wrap" aria-label={t("ruleView.history.tabsLabel")}>
        {OCCURRENCE_TABS.map((value) => (
          <Link key={value} className="sm-tab" to={hrefForTab(value)} replace state={location.state} aria-current={value === tab ? "true" : undefined} data-sm-occurrences-tab={value}>
            {t(`ruleView.history.tabs.${value}`)}
          </Link>
        ))}
      </nav>
      {body}
    </section>
  );
}
