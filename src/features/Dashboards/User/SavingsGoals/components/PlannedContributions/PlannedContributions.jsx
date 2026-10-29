import PrivateMoney from "../../../Experience/PrivateMoney";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCalendarDays } from "react-icons/lu";
import Loading from "../../../../../../components/Loading/Loading";
import { useAuthContext } from "../../../../../../contexts/auth/useAuthContext";
import { accountsApi } from "../../../api/accountsApi";
import {
  ApiError,
  getApiErrorMessage,
  toMoneyString,
} from "../../../api/apiClient";
import { plannedSavingsApi } from "../../../api/plannedSavingsApi";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import {
  getAmountError,
  toAmountInput,
} from "../../../FinancialOperations/transactionHelpers";
import { formatDate, formatMoney } from "../../../utils/formatters";
import { getEligibleAccounts, getGoalCurrency } from "../../savingsGoalHelpers";
import GoalMovementForm from "../GoalMovementForm/GoalMovementForm";
import "../../../Accounts/components/AccountForm/AccountForm.css";
import "./PlannedContributions.css";

const LIMIT = 15;
const STATUSES = ["", "planned", "fulfilled", "cancelled"];

function todayInZone(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const field = (key) => parts.find((part) => part.type === key)?.value;
    return `${field("year")}-${field("month")}-${field("day")}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function PlanForm({ goal, plan, onClose, onSaved }) {
  const { t, i18n } = useTranslation();
  const { user, workspace } = useAuthContext();
  const copy = "dashboard.savingsGoals.plans";
  const currency = getGoalCurrency(goal);
  const locale = getDisplayLocale(i18n.language);
  const today = todayInZone(workspace?.timezone || user?.timezone);
  const [accounts, setAccounts] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState(() => ({
    from_account_id: String(plan?.from_account?.id ?? ""),
    amount: plan ? toAmountInput(plan.amount) : "",
    planned_date: plan?.planned_date ?? today,
    notes: plan?.notes ?? "",
  }));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    accountsApi
      .list({ workspace_id: goal.workspace_id }, { signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        const rows = response.data?.accounts;
        if (!Array.isArray(rows))
          throw new ApiError("", { code: "MALFORMED_RESPONSE" });
        setAccounts(
          getEligibleAccounts(rows, {
            currency,
            goalAccountId: goal.account?.id,
          }),
        );
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setLoadError(getApiErrorMessage(error, t));
      });
    return () => controller.abort();
  }, [goal.workspace_id, goal.account?.id, currency, t]);

  const close = () => {
    if (!pending.current) onClose();
  };
  const submit = async (event) => {
    event.preventDefault();
    if (pending.current) return;
    const next = {};
    if (!form.from_account_id)
      next.from_account_id = [t(`${copy}.sourceRequired`)];
    const amountError = getAmountError(form.amount);
    if (amountError)
      next.amount = [t(`dashboard.transactions.validation.${amountError}`)];
    if (!form.planned_date || form.planned_date < today)
      next.planned_date = [t(`${copy}.dateRequired`)];
    if (form.notes.length > 1000) next.notes = [t(`${copy}.notesLength`)];
    setErrors(next);
    if (Object.keys(next).length) return;

    const values = {
      from_account_id: Number(form.from_account_id),
      amount: toMoneyString(form.amount),
      planned_date: form.planned_date,
      notes: form.notes.trim() || null,
    };
    pending.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (plan) await plannedSavingsApi.update(goal.id, plan.id, values);
      else await plannedSavingsApi.create(goal.id, values);
      onSaved();
    } catch (error) {
      if (error.code === "VALIDATION_ERROR") setErrors(error.errors ?? {});
      setMessage(getApiErrorMessage(error, t));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <div
      className="account-form-modal"
      role="presentation"
      onMouseDown={close}
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
    >
      <section
        className="account-form-modal__dialog planned-contributions__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="plan-form-title">{t(`${copy}.${plan ? "edit" : "add"}`)}</h2>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </header>
        <p className="planned-contributions__hint">
          {t(`${copy}.noMoneyMoved`)}
        </p>
        {accounts === null && !loadError && <Loading size="small" />}
        {loadError && (
          <p role="alert">
            {loadError}{" "}
            <button type="button" onClick={onClose}>
              {t("common.close")}
            </button>
          </p>
        )}
        {accounts && (
          <form onSubmit={submit} noValidate>
            <label>
              <span>{t(`${copy}.source`)}</span>
              <select
                value={form.from_account_id}
                disabled={busy || !accounts.length}
                onChange={(event) =>
                  setForm({ ...form, from_account_id: event.target.value })
                }
                required
              >
                <option value="">{t(`${copy}.selectAccount`)}</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ·{" "}
                    {formatMoney(account.current_balance, currency, locale)}
                  </option>
                ))}
              </select>
              {errors.from_account_id?.map((error) => (
                <small key={error}>{error}</small>
              ))}
              {!accounts.length && <small>{t(`${copy}.noAccounts`)}</small>}
            </label>
            <label>
              <span>
                {t(`${copy}.amount`)} ({currency})
              </span>
              <input
                value={form.amount}
                inputMode="decimal"
                dir="ltr"
                disabled={busy}
                onChange={(event) =>
                  setForm({ ...form, amount: event.target.value })
                }
                required
              />
              {errors.amount?.map((error) => (
                <small key={error}>{error}</small>
              ))}
            </label>
            <label>
              <span>{t(`${copy}.date`)}</span>
              <input
                type="date"
                min={today}
                value={form.planned_date}
                disabled={busy}
                onChange={(event) =>
                  setForm({ ...form, planned_date: event.target.value })
                }
                required
              />
              {errors.planned_date?.map((error) => (
                <small key={error}>{error}</small>
              ))}
            </label>
            <label>
              <span>{t(`${copy}.notes`)}</span>
              <textarea
                value={form.notes}
                maxLength={1000}
                disabled={busy}
                onChange={(event) =>
                  setForm({ ...form, notes: event.target.value })
                }
              />
              {errors.notes?.map((error) => (
                <small key={error}>{error}</small>
              ))}
            </label>
            {message && <p role="alert">{message}</p>}
            <footer>
              <button type="button" disabled={busy} onClick={close}>
                {t("common.cancel")}
              </button>
              <button type="submit" disabled={busy || !accounts.length}>
                {t("common.save")}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}

export default function PlannedContributions({
  goal,
  canContribute,
  onMovementCompleted,
}) {
  const { t, i18n } = useTranslation();
  const copy = "dashboard.savingsGoals.plans";
  const locale = getDisplayLocale(i18n.language);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({
    key: null,
    items: [],
    pagination: null,
    error: "",
  });
  const [editing, setEditing] = useState(undefined);
  const [fulfilling, setFulfilling] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState("");
  const key = `${goal.id}:${filter}:${page}:${revision}`;
  const refresh = () => setRevision((value) => value + 1);

  useEffect(() => {
    const controller = new AbortController();
    plannedSavingsApi
      .list(
        goal.id,
        { status: filter || undefined, page, per_page: LIMIT },
        { signal: controller.signal },
      )
      .then((response) => {
        if (controller.signal.aborted) return;
        const items = response.data?.planned_contributions;
        const pagination = response.data?.pagination;
        if (!Array.isArray(items) || !pagination)
          throw new ApiError("", { code: "MALFORMED_RESPONSE" });
        setResult({ key, items, pagination, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            items: [],
            pagination: null,
            error: getApiErrorMessage(error, t),
          });
      });
    return () => controller.abort();
  }, [goal.id, filter, page, revision, key, t]);

  const cancelPlan = async (plan) => {
    if (!window.confirm(t(`${copy}.confirmCancel`))) return;
    setBusyId(plan.id);
    setNotice("");
    try {
      await plannedSavingsApi.cancel(goal.id, plan.id);
      setNotice(t(`${copy}.cancelledNotice`));
      setPage(1);
      refresh();
    } catch (error) {
      setNotice(getApiErrorMessage(error, t));
      refresh();
    } finally {
      setBusyId(null);
    }
  };

  const loading = result.key !== key;
  return (
    <section
      className="planned-contributions"
      aria-labelledby="planned-contributions-title"
    >
      <header className="planned-contributions__head">
        <div>
          <h2 id="planned-contributions-title">
            <LuCalendarDays aria-hidden="true" /> {t(`${copy}.title`)}
          </h2>
          <p>{t(`${copy}.subtitle`)}</p>
        </div>
        {canContribute && (
          <button type="button" onClick={() => setEditing(null)}>
            {t(`${copy}.add`)}
          </button>
        )}
      </header>
      <div className="planned-contributions__body">
        <label className="planned-contributions__filter">
          {t(`${copy}.filter`)}
          <select
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setPage(1);
            }}
          >
            {STATUSES.map((status) => (
              <option value={status} key={status}>
                {t(`${copy}.statuses.${status || "all"}`)}
              </option>
            ))}
          </select>
        </label>
        {notice && <p role="status">{notice}</p>}
        {loading && <Loading size="small" />}
        {!loading && result.error && (
          <div role="alert">
            <p>{result.error}</p>
            <button type="button" onClick={refresh}>
              {t("common.retry")}
            </button>
          </div>
        )}
        {!loading && !result.error && !result.items.length && (
          <p>{t(`${copy}.empty`)}</p>
        )}
        {!loading && !result.error && (
          <ul className="planned-contributions__list">
            {result.items.map((plan) => (
              <li key={plan.id}>
                <div className="planned-contributions__info">
                  <strong dir="ltr">
                    <PrivateMoney>
                      {formatMoney(plan.amount, plan.currency_code, locale)}
                    </PrivateMoney>
                  </strong>
                  <span>
                    {t(`${copy}.statuses.${plan.status}`)} ·{" "}
                    {formatDate(`${plan.planned_date}T12:00:00`, locale)}
                  </span>
                  <span dir="auto">{plan.from_account?.name ?? "—"}</span>
                  {plan.notes && <small dir="auto">{plan.notes}</small>}
                </div>
                {plan.status === "planned" && (
                  <div className="planned-contributions__actions">
                    {canContribute && (
                      <button
                        type="button"
                        disabled={busyId === plan.id}
                        onClick={() => setFulfilling(plan)}
                      >
                        {t(`${copy}.fulfill`)}
                      </button>
                    )}
                    {canContribute && (
                      <button
                        type="button"
                        disabled={busyId === plan.id}
                        onClick={() => setEditing(plan)}
                      >
                        {t(`${copy}.edit`)}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyId === plan.id}
                      onClick={() => cancelPlan(plan)}
                    >
                      {t(`${copy}.cancel`)}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {!loading &&
          result.pagination &&
          Number(result.pagination.last_page) > 1 && (
            <nav
              className="planned-contributions__pages"
              aria-label={t(`${copy}.title`)}
            >
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                {t(`${copy}.previous`)}
              </button>
              <span>
                {page} / {result.pagination.last_page}
              </span>
              <button
                type="button"
                disabled={page >= Number(result.pagination.last_page)}
                onClick={() => setPage(page + 1)}
              >
                {t(`${copy}.next`)}
              </button>
            </nav>
          )}
      </div>
      {editing !== undefined && (
        <PlanForm
          goal={goal}
          plan={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            setPage(1);
            refresh();
            setNotice(t(`${copy}.savedNotice`));
          }}
        />
      )}
      {fulfilling && (
        <GoalMovementForm
          type="contribution"
          goal={goal}
          plan={fulfilling}
          onOutdated={refresh}
          onClose={() => {
            setFulfilling(null);
            refresh();
          }}
          onCompleted={(data) => {
            setFulfilling(null);
            refresh();
            onMovementCompleted(data);
          }}
        />
      )}
    </section>
  );
}
