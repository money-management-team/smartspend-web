import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LuPlus, LuLayers, LuPencil, LuTrash2 } from "react-icons/lu";
import { getNewOperationPath } from "../../../../routes/Path";
import { accountsApi } from "../api/accountsApi";
import { categoriesApi } from "../api/categoriesApi";
import { useExperience } from "./useExperience";
import {
  newLocalId,
  normalizeTemplate,
  templateIsEligible,
} from "./experienceStore";
import PrivateMoney from "./PrivateMoney";
import { formatMovementMoney } from "../AccountDetails/accountMovementHelpers";

const empty = () => ({
  name: "",
  type: "expense",
  account_id: "",
  category_id: "",
  amount: "",
  description: "",
});
export default function QuickTemplates() {
  const { t, i18n } = useTranslation("experience"),
    { preferences, update, workspaceId } = useExperience();
  const [editing, setEditing] = useState(null),
    [form, setForm] = useState(empty),
    [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0),
    [options, setOptions] = useState({
      key: null,
      accounts: [],
      categories: [],
    });
  const key = `${workspaceId}:${refresh}`;
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      accountsApi.list(
        { workspace_id: workspaceId },
        { signal: controller.signal },
      ),
      categoriesApi.list(
        { workspace_id: workspaceId },
        { signal: controller.signal },
      ),
    ])
      .then(([accounts, categories]) => {
        if (controller.signal.aborted) return;
        if (
          !Array.isArray(accounts.data?.accounts) ||
          !Array.isArray(categories.data?.categories)
        )
          throw new Error("Invalid options");
        setOptions({
          key,
          accounts: accounts.data.accounts,
          categories: categories.data.categories,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setOptions({ key, accounts: [], categories: [], error: true });
      });
    return () => controller.abort();
  }, [workspaceId, key]);
  const busy = options.key !== key,
    account = options.accounts.find(
      (item) => String(item.id) === form.account_id,
    );
  const eligibleAccounts = options.accounts.filter(
    (item) =>
      item.status === "active" &&
      item.type !== "savings_goal" &&
      !item.savings_goal &&
      !item.archived_at &&
      String(item.workspace_id) === String(workspaceId),
  );
  const eligibleCategories = options.categories.filter(
    (item) =>
      item.type === form.type &&
      item.is_active !== false &&
      item.is_active !== 0 &&
      item.status !== "archived" &&
      (item.workspace_id == null ||
        String(item.workspace_id) === String(workspaceId)),
  );
  const field = (name, value) => {
    setError(false);
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "type" ? { category_id: "" } : {}),
    }));
  };
  const open = (value = empty()) => {
    setEditing(value.id ?? "new");
    setForm(value);
    setError(false);
  };
  const save = (event) => {
    event.preventDefault();
    const value = normalizeTemplate({
      ...form,
      id: editing === "new" ? newLocalId() : editing,
      workspace_id: workspaceId,
      currency_code: account?.currency_code,
    });
    if (
      !value ||
      !templateIsEligible(
        value,
        options.accounts,
        options.categories,
        workspaceId,
      ) ||
      (editing === "new" && preferences.templates.length >= 20)
    ) {
      setError(true);
      return;
    }
    update((state) => ({
      ...state,
      templates:
        editing === "new"
          ? [...state.templates, value]
          : state.templates.map((row) => (row.id === value.id ? value : row)),
    }));
    setEditing(null);
  };
  return (
    <div className="exp-page">
      <header className="exp-hero">
        <div>
          <span className="exp-kicker">SMARTSPEND · QUICK ENTRY</span>
          <h1>{t("templates")}</h1>
          <p>{t("templatesHint")}</p>
        </div>
        <span className="exp-hero-icon">
          <LuLayers aria-hidden="true" />
        </span>
      </header>
      <div className="exp-toolbar">
        <p className="exp-muted">
          {t("templateReview")}
          <br />
          {t("deviceOnly")}
        </p>
        <button
          className="exp-button"
          type="button"
          disabled={preferences.templates.length >= 20}
          onClick={() => open()}
        >
          <LuPlus aria-hidden="true" />
          {t("createTemplate")}
        </button>
        <button
          className="exp-button exp-button--subtle"
          type="button"
          disabled={busy}
          onClick={() => setRefresh((value) => value + 1)}
        >
          {t("refresh")}
        </button>
      </div>
      {!preferences.persisted && (
        <p className="exp-error" role="status">
          {t("storageUnavailable")}
        </p>
      )}
      {busy && (
        <p className="exp-state" role="status">
          {t("loading")}
        </p>
      )}
      {options.error && (
        <p className="exp-error" role="alert">
          {t("error")}
        </p>
      )}
      {editing && (
        <section className="exp-card">
          <h2>{t(editing === "new" ? "createTemplate" : "edit")}</h2>
          <form className="exp-form" style={{ marginTop: 20 }} onSubmit={save}>
            <label className="exp-field">
              {t("name")}
              <input
                value={form.name}
                maxLength={80}
                required
                onChange={(event) => field("name", event.target.value)}
                autoFocus
              />
            </label>
            <label className="exp-field">
              {t("statementColumns.type")}
              <select
                value={form.type}
                onChange={(event) => field("type", event.target.value)}
              >
                {["expense", "income"].map((value) => (
                  <option key={value} value={value}>
                    {t(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="exp-field">
              {t("account")}
              <select
                value={form.account_id}
                required
                disabled={busy || options.error}
                onChange={(event) => field("account_id", event.target.value)}
              >
                <option value="">—</option>
                {form.account_id &&
                  !eligibleAccounts.some(
                    (item) => String(item.id) === form.account_id,
                  ) && (
                    <option value={form.account_id}>
                      #{form.account_id} · {t("templateInvalid")}
                    </option>
                  )}
                {eligibleAccounts.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name} · {item.currency_code}
                  </option>
                ))}
              </select>
            </label>
            <label className="exp-field">
              {t("category")}
              <select
                value={form.category_id}
                disabled={busy || options.error}
                onChange={(event) => field("category_id", event.target.value)}
              >
                <option value="">—</option>
                {form.category_id &&
                  !eligibleCategories.some(
                    (item) => String(item.id) === form.category_id,
                  ) && (
                    <option value={form.category_id}>
                      #{form.category_id} · {t("templateInvalid")}
                    </option>
                  )}
                {eligibleCategories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="exp-field">
              {t("amount")} {account?.currency_code}
              <input
                value={form.amount}
                inputMode="decimal"
                dir="ltr"
                maxLength={24}
                onChange={(event) => field("amount", event.target.value)}
                placeholder="0.00"
              />
            </label>
            <label className="exp-field">
              {t("description")}
              <input
                value={form.description}
                maxLength={255}
                onChange={(event) => field("description", event.target.value)}
              />
            </label>
            {error && (
              <p className="exp-error exp-wide" role="alert">
                {t("templateRequired")}
              </p>
            )}
            <div className="exp-toolbar exp-wide">
              <button
                type="submit"
                className="exp-button"
                disabled={busy || options.error}
              >
                {t("save")}
              </button>
              <button
                type="button"
                className="exp-button exp-button--subtle"
                onClick={() => setEditing(null)}
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        </section>
      )}
      {!preferences.templates.length ? (
        <section className="exp-card exp-state">
          <LuLayers size={32} aria-hidden="true" />
          <p>{t("noTemplates")}</p>
        </section>
      ) : (
        <div className="exp-grid exp-grid--three">
          {preferences.templates.map((item) => {
            const eligible =
              !busy &&
              !options.error &&
              templateIsEligible(
                item,
                options.accounts,
                options.categories,
                workspaceId,
              );
            return (
              <article className="exp-card" key={item.id}>
                <span className="exp-badge">{t(item.type)}</span>
                <h2 style={{ marginTop: 14 }}>{item.name}</h2>
                <p>
                  <PrivateMoney>
                    {item.amount
                      ? formatMovementMoney(
                          item.amount,
                          item.currency_code,
                          i18n.language.startsWith("ar") ? "ar-PS" : "en-US",
                        )
                      : t("templateMissingAmount")}
                  </PrivateMoney>
                </p>
                <p className="exp-muted">
                  {options.accounts.find(
                    (row) => String(row.id) === item.account_id,
                  )?.name ?? `#${item.account_id}`}{" "}
                  · {item.currency_code}
                  <br />
                  {item.description}
                </p>
                {!busy && !eligible && (
                  <p className="exp-error">{t("templateInvalid")}</p>
                )}
                <div className="exp-toolbar">
                  {eligible && (
                    <Link
                      className="exp-button"
                      to={`${getNewOperationPath(item.type)}&template=${item.id}`}
                    >
                      {t("apply")}
                    </Link>
                  )}
                  <button
                    className="exp-button exp-button--subtle"
                    type="button"
                    onClick={() => open(item)}
                    aria-label={`${t("edit")} ${item.name}`}
                  >
                    <LuPencil aria-hidden="true" />
                  </button>
                  <button
                    className="exp-button exp-button--danger"
                    type="button"
                    aria-label={`${t("delete")} ${item.name}`}
                    onClick={() =>
                      update((state) => ({
                        ...state,
                        templates: state.templates.filter(
                          (row) => row.id !== item.id,
                        ),
                      }))
                    }
                  >
                    <LuTrash2 aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
