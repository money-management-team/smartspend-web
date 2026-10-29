import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LuListFilter, LuRefreshCw } from "react-icons/lu";
import {
  getAccountDetailsPath,
  getTransactionDetailsPath,
} from "../../../../routes/Path";
import Loading from "../../../../components/Loading/Loading";
import StateMessage from "../../../../components/StateMessage/StateMessage";
import { transactionsApi } from "../api/transactionsApi";
import { accountsApi } from "../api/accountsApi";
import { getApiErrorMessage } from "../api/apiClient";
import {
  getTransactionAccounts,
  translateEnum,
} from "../FinancialOperations/transactionHelpers";
import { formatDateTime } from "../utils/formatters";
import { formatMovementMoney } from "../AccountDetails/accountMovementHelpers";
import SavedViews from "../Experience/SavedViews";
import PrivateMoney from "../Experience/PrivateMoney";
import { categoryQuery, parseCategoryPage } from "../Experience/experienceData";

const DEFAULTS = {
  account_id: "",
  status: "",
  date_from: "",
  date_to: "",
  sort_dir: "desc",
  per_page: "20",
};
export default function CategoryHistory({ category, locale, timeZone }) {
  const { t: tx } = useTranslation("experience"),
    { t, i18n } = useTranslation();
  const [state, setState] = useState({
      filters: DEFAULTS,
      page: 1,
      refresh: 0,
    }),
    [draft, setDraft] = useState(DEFAULTS);
  const [accounts, setAccounts] = useState([]),
    [validation, setValidation] = useState(false);
  const [result, setResult] = useState({ key: null });
  const [reloadCount, setReloadCount] = useState(0);
  const key = `${category.id}:${JSON.stringify(state)}:${reloadCount}`;
  useEffect(() => {
    const controller = new AbortController();
    accountsApi
      .list(
        { workspace_id: category.workspace_id ?? undefined },
        { signal: controller.signal },
      )
      .then((response) => {
        if (
          !controller.signal.aborted &&
          Array.isArray(response.data?.accounts)
        )
          setAccounts(response.data.accounts);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [category.workspace_id]);
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve()
      .then(async () => {
        const query = categoryQuery(category, state.filters, state.page);
        const response = await transactionsApi.list(query, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted)
          setResult({
            key,
            page: parseCategoryPage(response, category, query),
          });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ key, error });
      });
    return () => controller.abort();
  }, [key, category, state]);
  const apply = (filters) => {
    const value = { ...DEFAULTS, ...filters };
    try {
      categoryQuery(category, value);
    } catch {
      setValidation(true);
      return;
    }
    setDraft(value);
    setValidation(false);
    setState((current) => ({ ...current, filters: value, page: 1 }));
  };
  const busy = result.key !== key,
    page = !busy ? result.page : null;
  const field = (name, value) =>
    setDraft((current) => ({ ...current, [name]: value }));
  return (
    <section
      className="exp-card"
      aria-labelledby="category-history-title"
      aria-busy={busy}
    >
      <header className="exp-toolbar">
        <LuListFilter aria-hidden="true" />
        <h2 id="category-history-title">{tx("categoryHistory")}</h2>
        <button
          className="exp-button exp-button--subtle"
          type="button"
          disabled={busy}
          onClick={() =>
            setState((current) => ({
              ...current,
              refresh: current.refresh + 1,
            }))
          }
        >
          <LuRefreshCw aria-hidden="true" />
          {tx("refresh")}
        </button>
      </header>
      <p className="exp-muted">
        {tx("categoryHistoryHint")}
        {category.workspace_id == null && <> {tx("categoryScope")}</>}
      </p>
      <SavedViews
        scope={`category:${category.id}`}
        filters={state.filters}
        onApply={apply}
      />
      <form
        className="exp-form"
        style={{ marginTop: 20 }}
        onSubmit={(event) => {
          event.preventDefault();
          apply(draft);
        }}
      >
        <label className="exp-field">
          {tx("account")}
          <select
            value={draft.account_id}
            onChange={(event) => field("account_id", event.target.value)}
          >
            <option value="">{tx("all")}</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} · {account.currency_code}
              </option>
            ))}
          </select>
        </label>
        <label className="exp-field">
          {tx("status")}
          <select
            value={draft.status}
            onChange={(event) => field("status", event.target.value)}
          >
            {[
              "",
              "posted",
              "reversed",
              "draft",
              "pending_review",
              "failed",
            ].map((status) => (
              <option key={status} value={status}>
                {status
                  ? translateEnum(
                      t,
                      i18n,
                      "dashboard.transactions.statuses",
                      status,
                    )
                  : tx("all")}
              </option>
            ))}
          </select>
        </label>
        {["date_from", "date_to"].map((name) => (
          <label className="exp-field" key={name}>
            {tx(name === "date_from" ? "from" : "to")}
            <input
              type="date"
              value={draft[name]}
              onChange={(event) => field(name, event.target.value)}
            />
          </label>
        ))}
        <label className="exp-field">
          {tx("sort")}
          <select
            value={draft.sort_dir}
            onChange={(event) => field("sort_dir", event.target.value)}
          >
            <option value="desc">{tx("newest")}</option>
            <option value="asc">{tx("oldest")}</option>
          </select>
        </label>
        <div className="exp-toolbar">
          <button className="exp-button" type="submit">
            {tx("filters")}
          </button>
          <button
            className="exp-button exp-button--subtle"
            type="button"
            onClick={() => apply(DEFAULTS)}
          >
            {tx("reset")}
          </button>
        </div>
      </form>
      <p className="exp-muted">{tx("dateUTC")}</p>
      {validation && (
        <p className="exp-error" role="alert">
          {tx("exportDates")}
        </p>
      )}
      {busy ? (
        <Loading message={tx("loading")} />
      ) : result.error ? (
        <StateMessage
          tone="error"
          message={getApiErrorMessage(result.error, t)}
          onRetry={() => setReloadCount((count) => count + 1)}
        />
      ) : (
        page && (
          <>
            <p className="exp-muted">{tx("total", { count: page.total })}</p>
            {!page.items.length ? (
              <StateMessage message={tx("empty")} />
            ) : (
              <div className="exp-table-wrap">
                <table className="exp-table">
                  <thead>
                    <tr>
                      {["date", "description", "status", "account", "net"].map(
                        (name) => (
                          <th key={name} scope="col">
                            {name === "net"
                              ? t("dashboard.transactions.fields.amount")
                              : name === "account"
                                ? tx("account")
                                : tx(`statementColumns.${name}`)}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {page.items.map((row) => (
                      <tr key={row.id}>
                        <td>
                          {formatDateTime(row.occurred_at, locale, timeZone)}
                        </td>
                        <td className="exp-description">
                          <Link to={getTransactionDetailsPath(row.id)}>
                            {row.description ||
                              translateEnum(
                                t,
                                i18n,
                                "dashboard.transactions.types",
                                row.type,
                              )}
                          </Link>
                          <small
                            className="exp-muted"
                            style={{ display: "block" }}
                          >
                            #{row.id} ·{" "}
                            {translateEnum(
                              t,
                              i18n,
                              "dashboard.transactions.types",
                              row.type,
                            )}
                          </small>
                        </td>
                        <td>
                          <span className="exp-badge">
                            {translateEnum(
                              t,
                              i18n,
                              "dashboard.transactions.statuses",
                              row.status,
                            )}
                          </span>
                        </td>
                        <td>
                          {getTransactionAccounts(row).map((account) => (
                            <div key={account.id}>
                              <Link to={getAccountDetailsPath(account.id)}>
                                {account.name}
                              </Link>
                            </div>
                          ))}
                        </td>
                        <td>
                          <bdi dir="ltr">
                            <PrivateMoney>
                              {formatMovementMoney(
                                row.amount,
                                row.currency_code,
                                locale,
                              )}
                            </PrivateMoney>
                          </bdi>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <nav className="exp-pagination" aria-label={tx("categoryHistory")}>
              <button
                className="exp-button exp-button--subtle"
                type="button"
                disabled={state.page <= 1}
                onClick={() =>
                  setState((current) => ({
                    ...current,
                    page: current.page - 1,
                  }))
                }
              >
                {tx("previous")}
              </button>
              <span>
                {tx("page", { page: page.page, total: page.lastPage })}
              </span>
              <button
                className="exp-button exp-button--subtle"
                type="button"
                disabled={state.page >= page.lastPage}
                onClick={() =>
                  setState((current) => ({
                    ...current,
                    page: current.page + 1,
                  }))
                }
              >
                {tx("next")}
              </button>
            </nav>
          </>
        )
      )}
    </section>
  );
}
