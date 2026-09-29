import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuSearch, LuX } from "react-icons/lu";

import { COUNTERPARTY_MAX, DEBT_DIRECTIONS, DEBT_STATUSES, hasActiveDebtFilters } from "../../debtHelpers";

import "./DebtFilters.css";

const SEARCH_DELAY_MS = 400;

/*
 * Backend filters for GET /debts: direction, status, currency, counterparty
 * and due-date range. The page keeps them in the URL and resets to page 1 on
 * change. The counterparty search is applied after a short pause in typing,
 * and stays enabled while the list loads so typing is never interrupted.
 */
export default function DebtFilters({ filters, currencies, onChange, onClear, disabled = false }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState(filters.counterparty);
  const [appliedSearch, setAppliedSearch] = useState(filters.counterparty);
  const timerRef = useRef(null);
  // The delayed search must merge into the filters as they are when it fires
  // (a select may have changed meanwhile), not as they were on the keystroke.
  const latestRef = useRef({ filters, onChange });

  useEffect(() => {
    latestRef.current = { filters, onChange };
  });

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // The URL changed from outside (clear, back button): the box follows it.
  if (filters.counterparty !== appliedSearch) {
    setAppliedSearch(filters.counterparty);
    if (search.trim() !== filters.counterparty) setSearch(filters.counterparty);
  }

  const handle = (event) => onChange({ [event.target.name]: event.target.value });

  const handleSearch = (event) => {
    const { value } = event.target;
    setSearch(value);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const latest = latestRef.current;
      if (value.trim() !== latest.filters.counterparty) latest.onChange({ counterparty: value.trim() });
    }, SEARCH_DELAY_MS);
  };

  // A range end before its start is not applied.
  const handleDueTo = (event) => {
    const { value } = event.target;
    if (!value || !filters.due_from || value >= filters.due_from) onChange({ due_to: value });
  };

  const clear = () => {
    clearTimeout(timerRef.current);
    setSearch("");
    onClear();
  };

  return (
    <div className="debt-filters" role="group" aria-label={t("dashboard.debts.filters.label")}>
      <label className="debt-filters__field debt-filters__field--search">
        <span>{t("dashboard.debts.fields.counterparty")}</span>
        <span className="debt-filters__search">
          <LuSearch aria-hidden="true" />
          <input
            type="search"
            name="counterparty"
            value={search}
            onChange={handleSearch}
            maxLength={COUNTERPARTY_MAX}
            placeholder={t("dashboard.debts.filters.counterpartyPlaceholder")}
            autoComplete="off"
            dir="auto"
          />
        </span>
      </label>

      <label className="debt-filters__field">
        <span>{t("dashboard.debts.fields.direction")}</span>
        <select name="direction" value={filters.direction} onChange={handle} disabled={disabled}>
          <option value="">{t("dashboard.debts.filters.allDirections")}</option>
          {DEBT_DIRECTIONS.map((direction) => (
            <option value={direction} key={direction}>
              {t(`dashboard.debts.direction.${direction}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="debt-filters__field">
        <span>{t("dashboard.debts.fields.status")}</span>
        <select name="status" value={filters.status} onChange={handle} disabled={disabled}>
          <option value="">{t("dashboard.debts.filters.allStatuses")}</option>
          {DEBT_STATUSES.map((status) => (
            <option value={status} key={status}>
              {t(`dashboard.debts.status.${status}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="debt-filters__field">
        <span>{t("dashboard.debts.fields.currency")}</span>
        <select name="currency_code" value={filters.currency_code} onChange={handle} disabled={disabled} dir="ltr">
          <option value="">{t("dashboard.debts.filters.allCurrencies")}</option>
          {currencies.map((currency) => (
            <option value={currency} key={currency}>
              {currency}
            </option>
          ))}
        </select>
      </label>

      <label className="debt-filters__field">
        <span>{t("dashboard.debts.filters.dueFrom")}</span>
        <input
          type="date"
          name="due_from"
          value={filters.due_from}
          max={filters.due_to || undefined}
          onChange={handle}
          disabled={disabled}
        />
      </label>

      <label className="debt-filters__field">
        <span>{t("dashboard.debts.filters.dueTo")}</span>
        <input
          type="date"
          name="due_to"
          value={filters.due_to}
          min={filters.due_from || undefined}
          onChange={handleDueTo}
          disabled={disabled}
        />
      </label>

      {(hasActiveDebtFilters(filters) || search.trim()) && (
        <button type="button" className="debt-filters__clear" onClick={clear}>
          <LuX aria-hidden="true" />
          <span>{t("dashboard.debts.filters.clear")}</span>
        </button>
      )}
    </div>
  );
}
