import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuX } from "react-icons/lu";

import { getStoredWorkspace } from "../../../api/apiClient";
import { accountsApi } from "../../../api/accountsApi";
import {
  FREQUENCIES,
  PROCESSING_MODES,
  RECURRING_STATUSES,
  RECURRING_TYPES,
  hasActiveRecurringFilters,
} from "../../recurringHelpers";

import "./RecurringFilters.css";

const SELECTS = [
  { name: "type", values: RECURRING_TYPES, prefix: "dashboard.recurring.types", all: "allTypes" },
  { name: "status", values: RECURRING_STATUSES, prefix: "dashboard.recurring.statuses", all: "allStatuses" },
  { name: "frequency", values: FREQUENCIES, prefix: "dashboard.recurring.frequencies", all: "allFrequencies" },
  {
    name: "processing_mode",
    values: PROCESSING_MODES,
    prefix: "dashboard.recurring.processingModes",
    all: "allModes",
  },
];

const FIELD_LABELS = {
  type: "type",
  status: "status",
  frequency: "frequency",
  processing_mode: "processingMode",
};

/*
 * Backend filters for GET /recurring-transactions: type, status, frequency,
 * processing mode, account and next-due range. The page keeps them in the
 * URL and resets to page 1 on change. The account list comes from the
 * Accounts API; if it can't load, the account filter is simply hidden.
 */
export default function RecurringFilters({ filters, onChange, onClear, disabled = false }) {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    const controller = new AbortController();

    accountsApi
      .list({ id_workspace: getStoredWorkspace()?.id }, { signal: controller.signal })
      .then((response) => {
        const items = response?.data?.accounts;
        setAccounts(Array.isArray(items) ? items.filter((account) => account?.id != null) : []);
      })
      .catch(() => {
        // The other filters still work without the account list.
      });

    return () => controller.abort();
  }, []);

  const handle = (event) => onChange({ [event.target.name]: event.target.value });

  // A range end before its start is not applied.
  const handleDueTo = (event) => {
    const { value } = event.target;
    if (!value || !filters.due_from || value >= filters.due_from) onChange({ due_to: value });
  };

  const accountOptions =
    filters.account_id && !accounts.some((account) => String(account.id) === filters.account_id)
      ? [...accounts, { id: filters.account_id, name: `#${filters.account_id}` }]
      : accounts;

  return (
    <div className="recurring-filters" role="group" aria-label={t("dashboard.recurring.filters.label")}>
      {SELECTS.map(({ name, values, prefix, all }) => (
        <label className="recurring-filters__field" key={name}>
          <span>{t(`dashboard.recurring.fields.${FIELD_LABELS[name]}`)}</span>
          <select name={name} value={filters[name]} onChange={handle} disabled={disabled}>
            <option value="">{t(`dashboard.recurring.filters.${all}`)}</option>
            {values.map((value) => (
              <option value={value} key={value}>
                {t(`${prefix}.${value}`)}
              </option>
            ))}
          </select>
        </label>
      ))}

      {accountOptions.length > 0 && (
        <label className="recurring-filters__field">
          <span>{t("dashboard.recurring.fields.account")}</span>
          <select name="account_id" value={filters.account_id} onChange={handle} disabled={disabled}>
            <option value="">{t("dashboard.recurring.filters.allAccounts")}</option>
            {accountOptions.map((account) => (
              <option value={String(account.id)} key={account.id}>
                {account.name}
                {account.currency_code ? ` (${account.currency_code})` : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="recurring-filters__field">
        <span>{t("dashboard.recurring.filters.dueFrom")}</span>
        <input
          type="date"
          name="due_from"
          value={filters.due_from}
          max={filters.due_to || undefined}
          onChange={handle}
          disabled={disabled}
        />
      </label>

      <label className="recurring-filters__field">
        <span>{t("dashboard.recurring.filters.dueTo")}</span>
        <input
          type="date"
          name="due_to"
          value={filters.due_to}
          min={filters.due_from || undefined}
          onChange={handleDueTo}
          disabled={disabled}
        />
      </label>

      {hasActiveRecurringFilters(filters) && (
        <button type="button" className="recurring-filters__clear" onClick={onClear} disabled={disabled}>
          <LuX aria-hidden="true" />
          <span>{t("dashboard.recurring.filters.clear")}</span>
        </button>
      )}
    </div>
  );
}
