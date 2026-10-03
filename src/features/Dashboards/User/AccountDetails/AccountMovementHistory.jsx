import PrivateMoney from "../Experience/PrivateMoney";
import SavedViews from "../Experience/SavedViews";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  LuActivity,
  LuArrowDownLeft,
  LuArrowUpRight,
  LuArrowRightLeft,
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuFilter,
  LuHandCoins,
  LuList,
  LuRefreshCw,
  LuTriangleAlert,
  LuUndo2,
} from "react-icons/lu";
import appI18n from "../../../../i18n";
import {
  getAccountDetailsPath,
  getDebtDetailsPath,
  getTransactionDetailsPath,
  getTransferDetailsPath,
} from "../../../../routes/Path";
import { accountsApi } from "../api/accountsApi";
import { transactionsApi } from "../api/transactionsApi";
import { ApiError, getApiErrorMessage } from "../api/apiClient";
import { formatDateTime } from "../utils/formatters";
import { ACCOUNT_MOVEMENT_MESSAGES } from "./accountMovementMessages";
import {
  DEFAULT_MOVEMENT_FILTERS,
  MOVEMENT_TYPES,
  buildAccountMovementQuery,
  formatMovementMoney,
  hasMovementFilters,
  movementRelatedIds,
  movementTypeLabel,
  parseAccountMovementPage,
} from "./accountMovementHelpers";
import "./AccountMovementHistory.css";

for (const [language, messages] of Object.entries(ACCOUNT_MOVEMENT_MESSAGES)) {
  appI18n.addResourceBundle(language, "accountMovements", messages, true, true);
}

function MovementIcon({ row }) {
  if (row.isReversal) return <LuUndo2 aria-hidden="true" />;
  if (row.transaction.type === "transfer")
    return <LuArrowRightLeft aria-hidden="true" />;
  if (row.transaction.type?.startsWith("debt_"))
    return <LuHandCoins aria-hidden="true" />;
  return row.direction === "in" ? (
    <LuArrowDownLeft aria-hidden="true" />
  ) : row.direction === "out" ? (
    <LuArrowUpRight aria-hidden="true" />
  ) : (
    <LuActivity aria-hidden="true" />
  );
}

function MovementRow({ row, account, locale, timeZone, t }) {
  const transaction = row.transaction;
  const related = movementRelatedIds(transaction);
  const typeLabel = t(`types.${movementTypeLabel(row)}`, {
    defaultValue: transaction.type,
  });
  const money = (value, signed = false) =>
    formatMovementMoney(value, account.currency_code, locale, signed);
  const date = (value) => formatDateTime(value, locale, timeZone);
  const fields = [
    [
      "occurred",
      transaction.occurred_at ? date(transaction.occurred_at) : null,
    ],
    ["posted", transaction.posted_at ? date(transaction.posted_at) : null],
    ["created", transaction.created_at ? date(transaction.created_at) : null],
    ["description", transaction.description],
    ["category", transaction.category?.name],
    ["reference", transaction.reference_number],
    ["creator", transaction.creator?.name],
    [
      "source",
      transaction.source
        ? t(`sources.${transaction.source}`, {
            defaultValue: transaction.source,
          })
        : null,
    ],
    ["reversalReason", transaction.reversal_reason],
  ].filter(([, value]) => value != null && value !== "");

  return (
    <article className={`account-movement account-movement--${row.direction}`}>
      <div className="account-movement__main">
        <span
          className={`account-movement__icon${row.isReversal ? " account-movement__icon--reversal" : ""}`}
        >
          <MovementIcon row={row} />
        </span>
        <div className="account-movement__identity">
          <div className="account-movement__meta">
            <span className="account-movement__type">{typeLabel}</span>
            <span
              className={`account-movement__status${transaction.status === "reversed" ? " account-movement__status--reversed" : ""}`}
            >
              {t(`statuses.${transaction.status}`, {
                defaultValue: transaction.status,
              })}
            </span>
          </div>
          <Link
            className="account-movement__title"
            to={getTransactionDetailsPath(transaction.id)}
          >
            {transaction.description || typeLabel}
          </Link>
          <div className="account-movement__byline">
            {transaction.occurred_at && (
              <time dateTime={transaction.occurred_at}>
                {date(transaction.occurred_at)}
              </time>
            )}
            <span>{t("transactionId", { id: transaction.id })}</span>
            {transaction.source && (
              <span>
                {t(`sources.${transaction.source}`, {
                  defaultValue: transaction.source,
                })}
              </span>
            )}
          </div>
        </div>
        <div className="account-movement__effect">
          <span>{t("impact")}</span>
          <strong>
            <bdi dir="ltr">
              <PrivateMoney>{money(row.amount, true)}</PrivateMoney>
            </bdi>
          </strong>
          <small>
            {t(
              row.direction === "in"
                ? "incomingDirection"
                : row.direction === "out"
                  ? "outgoingDirection"
                  : "neutralDirection",
            )}
          </small>
        </div>
      </div>
      <details className="account-movement__details">
        <summary>
          <span>{t("details")}</span>
          <span className="account-movement__details-meta">
            {t("ledgerCount", { count: row.entries.length })}
            <LuChevronDown aria-hidden="true" />
          </span>
        </summary>
        <div className="account-movement__expanded">
          {transaction.status === "reversed" && (
            <p className="account-movement__reversed-note">
              {t("reversedNote")}
            </p>
          )}
          <dl className="account-movement__fields">
            {fields.map(([key, value]) => (
              <div key={key}>
                <dt>{t(key)}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="account-movement__ledger">
            <h3>{t("ledger")}</h3>
            <ul>
              {row.entries.map((entry) => (
                <li key={entry.id}>
                  <span>
                    {t(`roles.${entry.entry_role}`, {
                      defaultValue: entry.entry_role,
                    })}
                  </span>
                  <bdi dir="ltr">
                    <PrivateMoney>
                      {money(entry.signed_amount, true)}
                    </PrivateMoney>
                  </bdi>
                </li>
              ))}
            </ul>
          </div>
          {row.counterparts.length > 0 && (
            <div className="account-movement__related">
              <span>{t("otherAccounts")}</span>
              {row.counterparts.map((other) => (
                <Link key={other.id} to={getAccountDetailsPath(other.id)}>
                  {other.name || t("accountFallback", { id: other.id })}
                </Link>
              ))}
            </div>
          )}
          <div className="account-movement__links">
            <Link to={getTransactionDetailsPath(transaction.id)}>
              {t("detailsLink")}
            </Link>
            {related.transfer && (
              <Link to={getTransferDetailsPath(related.transfer)}>
                {t("transferLink")}
              </Link>
            )}
            {related.original && (
              <Link to={getTransactionDetailsPath(related.original)}>
                {t("original")}
              </Link>
            )}
            {related.debt && (
              <Link to={getDebtDetailsPath(related.debt)}>{t("debtLink")}</Link>
            )}
          </div>
        </div>
      </details>
    </article>
  );
}

export default function AccountMovementHistory({
  account,
  locale,
  timeZone,
  onAccountRefreshed,
}) {
  const { t, i18n } = useTranslation("accountMovements");
  const [draft, setDraft] = useState({ ...DEFAULT_MOVEMENT_FILTERS });
  const [filterError, setFilterError] = useState(null);
  const [queryState, setQueryState] = useState({
    filters: { ...DEFAULT_MOVEMENT_FILTERS },
    page: 1,
    refresh: 0,
    syncAccount: false,
  });
  const [result, setResult] = useState({
    key: null,
    page: null,
    error: null,
    updatedAt: null,
  });
  const scope = useMemo(
    () => ({
      id: account.id,
      workspace_id: account.workspace_id,
      currency_code: account.currency_code,
    }),
    [account.id, account.workspace_id, account.currency_code],
  );
  const requestKey = JSON.stringify([scope, queryState]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const load = async () => {
      try {
        const query = buildAccountMovementQuery(
          scope.id,
          queryState.filters,
          queryState.page,
        );
        const [response, accountResponse] = await Promise.all([
          transactionsApi.list(query, { signal: controller.signal }),
          queryState.syncAccount
            ? accountsApi.get(scope.id, { signal: controller.signal })
            : Promise.resolve(null),
        ]);
        const page = parseAccountMovementPage(response, scope, query);
        const freshAccount = accountResponse?.data?.account;
        if (
          queryState.syncAccount &&
          (!freshAccount ||
            String(freshAccount.id) !== String(scope.id) ||
            String(freshAccount.workspace_id) !== String(scope.workspace_id) ||
            freshAccount.currency_code !== scope.currency_code)
        )
          throw new ApiError("", { code: "MALFORMED_RESPONSE" });
        if (!active || controller.signal.aborted) return;
        if (freshAccount) onAccountRefreshed?.(freshAccount);
        setResult({
          key: requestKey,
          page,
          error: null,
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        if (!active || controller.signal.aborted || error.name === "AbortError")
          return;
        setResult({ key: requestKey, page: null, error, updatedAt: null });
      }
    };
    load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [scope, queryState, requestKey, onAccountRefreshed]);

  const isLoading = result.key !== requestKey;
  const page = isLoading ? null : result.page;
  const error = isLoading ? null : result.error;
  const filtered = hasMovementFilters(queryState.filters);
  const direction = i18n.dir();
  const number = (value) => new Intl.NumberFormat(locale).format(value);
  const money = (value) =>
    value == null
      ? "—"
      : formatMovementMoney(value, scope.currency_code, locale);
  const changeDraft = (name, value) => {
    setDraft((current) => ({ ...current, [name]: value }));
    setFilterError(null);
  };
  const refresh = () =>
    setQueryState((current) => ({
      ...current,
      refresh: current.refresh + 1,
      syncAccount: true,
    }));
  const clear = () => {
    setDraft({ ...DEFAULT_MOVEMENT_FILTERS });
    setFilterError(null);
    setQueryState((current) => ({
      filters: { ...DEFAULT_MOVEMENT_FILTERS },
      page: 1,
      refresh: current.refresh + 1,
      syncAccount: false,
    }));
  };
  const apply = (event) => {
    event.preventDefault();
    try {
      buildAccountMovementQuery(scope.id, draft);
      setFilterError(null);
      setQueryState((current) => ({
        filters: { ...draft },
        page: 1,
        refresh: current.refresh + 1,
        syncAccount: false,
      }));
    } catch (failure) {
      setFilterError(
        failure.code === "ACCOUNT_HISTORY_DATE_INVALID"
          ? "invalidDates"
          : "invalidFilters",
      );
    }
  };
  const goTo = (next) =>
    setQueryState((current) => ({
      ...current,
      page: next,
      syncAccount: false,
    }));
  const summary = [
    {
      key: filtered ? "filteredCount" : "count",
      value: page ? number(page.total) : "—",
      tone: "total",
      icon: LuList,
    },
    {
      key: "incoming",
      value: money(page?.incoming),
      tone: "in",
      icon: LuArrowDownLeft,
    },
    {
      key: "outgoing",
      value: money(page?.outgoing),
      tone: "out",
      icon: LuArrowUpRight,
    },
    { key: "net", value: money(page?.net), tone: "net", icon: LuActivity },
  ];
  const titleId = `account-movements-${scope.id}`;

  return (
    <section className="account-movements" aria-labelledby={titleId}>
      <SavedViews
        scope={`account:${account.id}`}
        filters={{
          ...queryState.filters,
          per_page: String(queryState.filters.per_page),
        }}
        onApply={(values) => {
          const filters = {
            ...DEFAULT_MOVEMENT_FILTERS,
            ...values,
            per_page: Number(values.per_page || 20),
          };
          try {
            buildAccountMovementQuery(scope.id, filters);
          } catch {
            setFilterError("invalidFilters");
            return;
          }
          setDraft(filters);
          setFilterError(null);
          setQueryState((current) => ({
            ...current,
            filters,
            page: 1,
            syncAccount: false,
          }));
        }}
      />
      <header className="account-movements__header">
        <div>
          <span className="account-movements__kicker">
            <LuActivity aria-hidden="true" />
            {t("kicker")}
          </span>
          <h2 id={titleId}>{t("title")}</h2>
          <p>{t("subtitle")}</p>
        </div>
        <div className="account-movements__refresh">
          <button
            className="account-movements__button"
            type="button"
            onClick={refresh}
            disabled={isLoading}
          >
            <LuRefreshCw aria-hidden="true" />
            {t("refresh")}
          </button>
          {!isLoading && result.updatedAt && (
            <small>
              {t("updated", {
                time: new Intl.DateTimeFormat(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                  ...(timeZone ? { timeZone } : {}),
                }).format(new Date(result.updatedAt)),
              })}
            </small>
          )}
        </div>
      </header>

      <dl className="account-movements__summary" aria-busy={isLoading}>
        {summary.map(({ key, value, tone, icon: Icon }) => (
          <div
            className={`account-movements__stat account-movements__stat--${tone}`}
            key={key}
          >
            <dt>
              <span>{t(key)}</span>
              <Icon aria-hidden="true" />
            </dt>
            <dd>
              <bdi dir="ltr">
                {tone === "total" ? (
                  value
                ) : (
                  <PrivateMoney>{value}</PrivateMoney>
                )}
              </bdi>
            </dd>
            {tone === "total" && <small>{t("countHint")}</small>}
          </div>
        ))}
      </dl>
      <p className="account-movements__page-note">{t("pageNote")}</p>

      <form
        className="account-movements__filters"
        onSubmit={apply}
        aria-label={t("filters")}
      >
        <label>
          <span>{t("type")}</span>
          <select
            value={draft.type}
            onChange={(event) => changeDraft("type", event.target.value)}
          >
            <option value="">{t("allTypes")}</option>
            {MOVEMENT_TYPES.map((type) => (
              <option value={type} key={type}>
                {t(`types.${type}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t("status")}</span>
          <select
            value={draft.status}
            onChange={(event) => changeDraft("status", event.target.value)}
          >
            <option value="">{t("allStatuses")}</option>
            {["posted", "reversed"].map((status) => (
              <option value={status} key={status}>
                {t(`statuses.${status}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t("from")}</span>
          <input
            type="date"
            value={draft.date_from}
            onChange={(event) => changeDraft("date_from", event.target.value)}
          />
        </label>
        <label>
          <span>{t("to")}</span>
          <input
            type="date"
            value={draft.date_to}
            min={draft.date_from || undefined}
            onChange={(event) => changeDraft("date_to", event.target.value)}
          />
        </label>
        <label>
          <span>{t("sort")}</span>
          <select
            value={draft.sort}
            onChange={(event) => changeDraft("sort", event.target.value)}
          >
            <option value="occurred_at:desc">{t("newest")}</option>
            <option value="occurred_at:asc">{t("oldest")}</option>
            <option value="created_at:desc">{t("recentlyAdded")}</option>
          </select>
        </label>
        <label>
          <span>{t("perPage")}</span>
          <select
            value={draft.per_page}
            onChange={(event) =>
              changeDraft("per_page", Number(event.target.value))
            }
          >
            {[20, 50, 100].map((size) => (
              <option value={size} key={size}>
                {number(size)}
              </option>
            ))}
          </select>
        </label>
        <div className="account-movements__filter-actions">
          <button
            className="account-movements__button account-movements__button--primary"
            type="submit"
            disabled={isLoading}
          >
            <LuFilter aria-hidden="true" />
            {t("apply")}
          </button>
          <button
            className="account-movements__button"
            type="button"
            onClick={clear}
            disabled={isLoading}
          >
            {t("clear")}
          </button>
        </div>
        <small className="account-movements__date-help">{t("dateHelp")}</small>
        {filterError && (
          <p className="account-movements__filter-error" role="alert">
            {t(filterError)}
          </p>
        )}
      </form>

      <div className="account-movements__list" aria-busy={isLoading}>
        {isLoading && (
          <div className="account-movements__loading" role="status">
            <p>{t("loading")}</p>
            {[1, 2, 3].map((id) => (
              <div
                className="account-movements__skeleton"
                aria-hidden="true"
                key={id}
              >
                <span />
                <div>
                  <i />
                  <i />
                </div>
                <span />
              </div>
            ))}
          </div>
        )}
        {error && (
          <div className="account-movements__state" role="alert">
            <LuTriangleAlert aria-hidden="true" />
            <h3>{t("errorTitle")}</h3>
            <p>
              {getApiErrorMessage(error, (key, options) =>
                appI18n.t(key, { ...options, ns: "translation" }),
              )}
            </p>
            <button
              type="button"
              className="account-movements__button"
              onClick={refresh}
            >
              {t("retry")}
            </button>
          </div>
        )}
        {page?.rows.map((row) => (
          <MovementRow
            key={row.transaction.id}
            row={row}
            account={scope}
            locale={locale}
            timeZone={timeZone}
            t={t}
          />
        ))}
        {page && page.rows.length === 0 && (
          <div className="account-movements__state">
            <LuList aria-hidden="true" />
            <h3>{t(filtered ? "filteredEmptyTitle" : "emptyTitle")}</h3>
            <p>
              {t(
                page.page > page.lastPage
                  ? "pastLastPage"
                  : filtered
                    ? "filteredEmptyText"
                    : "emptyText",
              )}
            </p>
            {page.page > 1 ? (
              <button
                className="account-movements__button"
                type="button"
                onClick={() => goTo(1)}
              >
                {t("firstPage")}
              </button>
            ) : (
              filtered && (
                <button
                  className="account-movements__button"
                  type="button"
                  onClick={clear}
                >
                  {t("clear")}
                </button>
              )
            )}
          </div>
        )}
      </div>

      {page && (
        <footer className="account-movements__footer">
          <span>
            {page.from != null
              ? t("range", {
                  from: number(page.from),
                  to: number(page.to),
                  total: number(page.total),
                })
              : t("noRange")}
          </span>
          <nav
            className="account-movements__pagination"
            aria-label={t("pagination")}
          >
            <button
              type="button"
              onClick={() => goTo(page.page - 1)}
              disabled={page.page <= 1}
              aria-label={t("previous")}
            >
              {direction === "rtl" ? (
                <LuChevronRight aria-hidden="true" />
              ) : (
                <LuChevronLeft aria-hidden="true" />
              )}
            </button>
            <span aria-live="polite">
              {t("page", {
                page: number(page.page),
                lastPage: number(page.lastPage),
              })}
            </span>
            <button
              type="button"
              onClick={() => goTo(page.page + 1)}
              disabled={page.page >= page.lastPage}
              aria-label={t("next")}
            >
              {direction === "rtl" ? (
                <LuChevronLeft aria-hidden="true" />
              ) : (
                <LuChevronRight aria-hidden="true" />
              )}
            </button>
          </nav>
        </footer>
      )}
    </section>
  );
}
