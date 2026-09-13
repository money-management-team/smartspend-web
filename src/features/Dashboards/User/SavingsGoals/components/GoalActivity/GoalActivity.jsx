import { createElement, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  LuArrowDownToLine,
  LuArrowUpFromLine,
  LuChevronLeft,
  LuChevronRight,
} from "react-icons/lu";

import Loading from "../../../../../../components/Loading/Loading";
import { useAuthContext } from "../../../../../../contexts/auth/useAuthContext";
import { getTransferDetailsPath } from "../../../../../../routes/Path";
import { ApiError } from "../../../api/apiClient";
import { savingsGoalsApi } from "../../../api/savingsGoalsApi";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import TransactionStatusBadge from "../../../FinancialOperations/components/TransactionStatusBadge/TransactionStatusBadge";
import { getAccountLabel } from "../../../Transfers/transferHelpers";
import { formatDate, formatMoney } from "../../../utils/formatters";
import {
  HISTORY_PER_PAGE,
  HISTORY_SOURCES,
  HISTORY_TABS,
  getGoalErrorMessage,
  getMovementType,
  isReversedMovement,
  parsePage,
} from "../../savingsGoalHelpers";

import "./GoalActivity.css";

const ICONS = {
  contribution: LuArrowDownToLine,
  withdrawal: LuArrowUpFromLine,
  unknown: LuArrowDownToLine,
};

// From the goal's point of view: a contribution adds, a withdrawal removes.
const SIGNS = { contribution: "+", withdrawal: "−" };

/*
 * The goal's money movements, newest first as the backend orders them:
 * - "All" → GET /savings-goals/{id}/activity (`data.activity`);
 * - "Contributions" → GET /savings-goals/{id}/contributions
 *   (`data.contributions`);
 * - "Withdrawals" → GET /savings-goals/{id}/activity?type=withdrawal.
 * Each row is a real transfer; it links to the transfer's page. Reversed
 * movements stay listed, marked as reversed. `refreshKey` changes after money
 * moves, which refetches from the first page.
 */
export default function GoalActivity({ goalId, currency, refreshKey = 0 }) {
  const { t, i18n } = useTranslation();
  const { user, workspace } = useAuthContext();
  const locale = getDisplayLocale(i18n.language);
  const timeZone = user?.timezone ?? workspace?.timezone;

  const [tab, setTab] = useState("all");
  // The page belongs to the refresh it was chosen in: a new refresh starts
  // again from page 1, where the newest movement is.
  const [pageState, setPageState] = useState({ refreshKey, tab, page: 1 });
  const page =
    pageState.refreshKey === refreshKey && pageState.tab === tab ? pageState.page : 1;
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${goalId}:${tab}:${page}:${refreshKey}:${reloadKey}`;
  const [result, setResult] = useState({ key: null, page: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    const source = HISTORY_SOURCES[tab];

    savingsGoalsApi[source.list](
      goalId,
      { ...source.query, per_page: HISTORY_PER_PAGE, page: page > 1 ? page : undefined },
      { signal: controller.signal },
    )
      .then((response) => {
        const parsed = parsePage(response, source.key);

        setResult(
          parsed
            ? { key: requestKey, page: parsed, error: null }
            : {
                key: requestKey,
                page: null,
                error: new ApiError("", { code: "MALFORMED_RESPONSE" }),
              },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setResult({ key: requestKey, page: null, error });
      });

    return () => controller.abort();
  }, [goalId, tab, page, requestKey]);

  const isLoading = result.key !== requestKey;
  const { page: listPage, error } = isLoading ? { page: null, error: null } : result;
  const items = listPage?.items ?? [];

  const goToPage = (next) => setPageState({ refreshKey, tab, page: next });

  return (
    <section className="goal-activity" aria-labelledby="goal-activity-title">
      <header className="goal-activity__head">
        <div>
          <h2 id="goal-activity-title">
            {t("dashboard.savingsGoals.activity.title")}
            {listPage && !isLoading && <span className="goal-activity__count">{listPage.total}</span>}
          </h2>
          <p>{t("dashboard.savingsGoals.activity.subtitle")}</p>
        </div>

        <div className="goal-activity__tabs" role="tablist" aria-label={t("dashboard.savingsGoals.activity.title")}>
          {HISTORY_TABS.map((key) => (
            <button
              type="button"
              role="tab"
              key={key}
              aria-selected={tab === key}
              className={`goal-activity__tab${tab === key ? " goal-activity__tab--active" : ""}`}
              onClick={() => setTab(key)}
            >
              {t(`dashboard.savingsGoals.activity.tabs.${key}`)}
            </button>
          ))}
        </div>
      </header>

      <div className="goal-activity__list" role="tabpanel">
        {isLoading && <Loading size="small" message={t("dashboard.savingsGoals.activity.loading")} />}

        {!isLoading && error && (
          <div className="goal-activity__state goal-activity__state--error" role="alert">
            <p>{getGoalErrorMessage(error, t)}</p>
            <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
              {t("common.retry")}
            </button>
          </div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <div className="goal-activity__state">
            <p>{t(`dashboard.savingsGoals.activity.empty.${tab}`)}</p>
          </div>
        )}

        {!isLoading &&
          !error &&
          items.map((movement, index) => {
            const type = getMovementType(movement);
            const isReversed = isReversedMovement(movement);
            const from = getAccountLabel(movement.from_account, movement.from_account_id);
            const to = getAccountLabel(movement.to_account, movement.to_account_id);
            const title =
              type === "unknown"
                ? movement.type ?? "—"
                : t(`dashboard.savingsGoals.activity.types.${type}`);

            return (
              <article
                className={`goal-activity-row goal-activity-row--${type}${isReversed ? " goal-activity-row--reversed" : ""}`}
                key={movement.id ?? `${movement.transfer_id}-${index}`}
              >
                <span className="goal-activity-row__icon" aria-hidden="true">
                  {createElement(ICONS[type])}
                </span>

                <div className="goal-activity-row__copy">
                  {movement.transfer_id != null ? (
                    // Stretched over the row: the row opens the transfer.
                    <Link className="goal-activity-row__link" to={getTransferDetailsPath(movement.transfer_id)}>
                      <strong>{title}</strong>
                    </Link>
                  ) : (
                    <strong>{title}</strong>
                  )}
                  <small>
                    <bdi>{from}</bdi>
                    {" → "}
                    <bdi>{to}</bdi>
                    {" · "}
                    <bdi>{formatDate(movement.occurred_at ?? movement.created_at, locale, timeZone)}</bdi>
                    {movement.description && (
                      <>
                        {" · "}
                        <bdi>{movement.description}</bdi>
                      </>
                    )}
                  </small>
                </div>

                <div className="goal-activity-row__side">
                  <strong className="goal-activity-row__amount" dir="ltr">
                    {SIGNS[type] ?? ""}
                    {formatMoney(movement.amount, movement.currency_code || currency, locale)}
                  </strong>
                  {isReversed ? (
                    <TransactionStatusBadge status="reversed" />
                  ) : (
                    <TransactionStatusBadge status={movement.transfer_status} />
                  )}
                </div>
              </article>
            );
          })}
      </div>

      {!isLoading && !error && listPage && listPage.lastPage > 1 && (
        <footer className="goal-activity__pagination">
          <span>
            {t("dashboard.transactions.pagination.summary", {
              from: listPage.from,
              to: listPage.to,
              total: listPage.total,
            })}
          </span>

          <div className="goal-activity__pages">
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
    </section>
  );
}
