import { useMemo } from "react";
import { LuArrowDownToLine, LuArrowUpFromLine } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

import StatusChip from "../activity/StatusChip.jsx";
import { goalMovementsLoader, keys } from "../data/loaders.js";
import { useResource } from "../data/useResource.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { ACTIVITY_STATUSES } from "../models/activity.js";
import { GOAL_MOVEMENT_TABS } from "../models/goalMovementTabs.js";
import { buildGoalMovements } from "../models/goalMovements.js";
import { formatDay } from "../money/format.js";
import Money from "../money/Money.jsx";
import { transferDetailPath } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import StaleNotice from "../ui/StaleNotice.jsx";
import { isAccountId } from "../data/readApi.js";

const MALFORMED = Object.freeze({ code: "MALFORMED_RESPONSE" });
const ICONS = { contribution: LuArrowDownToLine, withdrawal: LuArrowUpFromLine };

/*
 * A goal's money movements, read-only (GET /savings-goals/{id}/activity and /contributions): the same history the full
 * version shows, newest first as the backend orders it. The tab and the page live in the address (`?movements=` and
 * `?mp=`), so Back and a shared link show the same slice. Tabs and paging are links: nothing here is a control that
 * changes anything, and nothing is filtered, sorted or counted in the browser. Each row opens its transfer.
 */
export default function GoalMovements({ goal, locale, timeZone }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const tab = GOAL_MOVEMENT_TABS.includes(params.get("movements")) ? params.get("movements") : "all";
  const requested = Number.parseInt(params.get("mp") ?? "1", 10);
  const page = Number.isSafeInteger(requested) && requested > 1 && requested <= 500 ? requested : 1;
  // Without a currency the rows cannot be told from another currency's, so nothing is asked for.
  const enabled = Boolean(goal.currency);

  const loader = useMemo(() => goalMovementsLoader(goal.id, tab, page), [goal.id, tab, page]);
  const resource = useResource(keys.goalMovements(goal.id, tab, page), loader, { enabled });
  const parsed = useMemo(() => {
    if (resource.data === undefined) return { value: null, error: null };
    try {
      return { value: buildGoalMovements(resource.data, { id: goal.id, currency: goal.currency }, { tab, page }), error: null };
    } catch (error) {
      return { value: null, error };
    }
  }, [resource.data, goal.id, goal.currency, tab, page]);

  const here = `${location.pathname}${location.search}`;
  const hrefFor = (next) => {
    const copy = new URLSearchParams(location.search);
    if (next.tab !== undefined) {
      if (next.tab === "all") copy.delete("movements");
      else copy.set("movements", next.tab);
      copy.delete("mp");
    }
    if (next.page !== undefined) {
      if (next.page > 1) copy.set("mp", String(next.page));
      else copy.delete("mp");
    }
    const search = copy.toString();
    return `${location.pathname}${search ? `?${search}` : ""}`;
  };

  let body;
  if (!enabled) body = <p className="sm-text sm-muted" data-sm-section="unavailable">{t("goalView.movements.unavailable")}</p>;
  else if (resource.loading) body = <Skeleton lines={3} label={t("goalView.movements.loading")} />;
  else if (resource.status === "error" || parsed.error || !parsed.value) body = <ErrorPanel error={resource.error ?? parsed.error ?? MALFORMED} onRetry={resource.reload} retrying={resource.refreshing} compact />;
  else {
    const { rows, page: current, lastPage } = parsed.value;
    body = (
      <>
        {resource.stale && <StaleNotice error={resource.error} updatedAt={resource.updatedAt} onRetry={resource.reload} retrying={resource.refreshing} />}
        {rows.length === 0 ? (
          <p className="sm-text sm-muted" data-sm-empty={tab}>{t(`goalView.movements.empty.${tab}`)}</p>
        ) : (
          <ul className="sm-list sm-tx-list" data-sm-page={current}>
            {rows.map((row) => {
              const Icon = ICONS[row.type] ?? LuArrowDownToLine;
              const date = formatDay(row.occurredAt, locale, timeZone);
              const title = row.known ? t(`goalView.movements.type.${row.type}`) : t("goalView.movements.unknownType", { type: String(row.type ?? "?").replace(/_/g, " ") });
              const content = (
                <>
                  <span className="sm-tx-icon" data-sm-direction={row.type === "contribution" ? "income" : row.type === "withdrawal" ? "expense" : "neutral"} aria-hidden="true"><Icon /></span>
                  <span className="sm-row-main">
                    <span className="sm-row-title">{title}</span>
                    {row.from || row.to ? (
                      <span className="sm-row-meta sm-movement-route">
                        <bdi dir="auto">{row.from ?? "—"}</bdi>
                        {locale === "ar" ? " ← " : " → "}
                        <bdi dir="auto">{row.to ?? "—"}</bdi>
                      </span>
                    ) : null}
                    {date ? <span className="sm-row-meta sm-movement-date"><bdi>{date}</bdi></span> : null}
                    {row.reversed ? <StatusChip status="reversed" known /> : row.transferStatus && row.transferStatus !== "posted" ? <StatusChip status={row.transferStatus} known={ACTIVITY_STATUSES.includes(row.transferStatus)} /> : null}
                  </span>
                  <span className="sm-row-end">
                    <span className={`sm-row-amount${row.reversed ? " sm-struck" : ""}`}>
                      <Money plain plus={row.type === "contribution"} value={row.signed} currency={row.currency} />
                      {row.reversed && <span className="sm-sr"> {t("status.reversed")}</span>}
                    </span>
                    {isAccountId(row.transferId) && <Chevron />}
                  </span>
                </>
              );

              return (
                <li key={row.id} data-sm-movement={row.id} data-sm-type={row.type ?? "unknown"} data-sm-reversed={row.reversed ? "true" : undefined}>
                  {isAccountId(row.transferId) ? (
                    <Link className="sm-row sm-tx" to={transferDetailPath(row.transferId)} state={{ from: here }}>{content}</Link>
                  ) : (
                    <div className="sm-row sm-tx sm-row-static">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {lastPage > 1 && (
          <nav className="sm-paged-nav" aria-label={t("goalView.movements.title")}>
            {current > 1 ? <Link className="sm-card-link" to={hrefFor({ page: current - 1 })} replace state={location.state} data-sm-movements-page={current - 1}>{t("goalView.movements.newer")}</Link> : <span />}
            <span className="sm-text sm-muted sm-fine">{t("goalView.movements.page", { page: current, pages: lastPage })}</span>
            {current < lastPage ? <Link className="sm-card-link" to={hrefFor({ page: current + 1 })} replace state={location.state} data-sm-movements-page={current + 1}>{t("goalView.movements.older")}</Link> : <span />}
          </nav>
        )}
      </>
    );
  }

  return (
    <section className="sm-card" aria-labelledby="sm-goal-movements" data-sm-section="goal-movements" data-sm-tab={tab}>
      <h2 id="sm-goal-movements" className="sm-card-title">{t("goalView.movements.title")}</h2>
      <p className="sm-text sm-muted sm-fine">{t("goalView.movements.hint")}</p>
      <nav className="sm-tabs" aria-label={t("goalView.movements.tabsLabel")}>
        {GOAL_MOVEMENT_TABS.map((value) => (
          <Link key={value} className="sm-tab" to={hrefFor({ tab: value })} replace state={location.state} aria-current={value === tab ? "true" : undefined} data-sm-movements-tab={value}>
            {t(`goalView.movements.tabs.${value}`)}
          </Link>
        ))}
      </nav>
      {body}
    </section>
  );
}
