import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCalendarRange } from "react-icons/lu";

import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { getTodayInputValue } from "../../../FinancialOperations/transactionHelpers";
import { formatDate } from "../../../utils/formatters";
import { DASHBOARD_PERIODS, getCustomRangeError } from "../../dashboardHelpers";

import "./DashboardPeriodFilter.css";

/*
 * Period for GET /dashboard: a preset (today … all) applies at once; "Custom"
 * opens a date range that is validated (both dates, `date_to` ≥ `date_from`)
 * before it is applied. `period` is the range the backend actually used,
 * shown next to the controls.
 */
export default function DashboardPeriodFilter({ filters, period, onChange, disabled = false }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const [isCustomOpen, setIsCustomOpen] = useState(filters.period === "custom");
  const [draft, setDraft] = useState(() => ({
    date_from: filters.date_from || period?.date_from || getTodayInputValue(),
    date_to: filters.date_to || period?.date_to || getTodayInputValue(),
  }));
  const [error, setError] = useState("");

  const selectPreset = (value) => {
    setIsCustomOpen(false);
    setError("");
    if (value !== filters.period) onChange({ period: value, date_from: "", date_to: "" });
  };

  const handleDraft = (event) => {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
    setError("");
  };

  const applyCustom = (event) => {
    event.preventDefault();
    const rangeError = getCustomRangeError(draft.date_from, draft.date_to);

    if (rangeError) {
      setError(t(`dashboard.user.period.validation.${rangeError}`));
      return;
    }

    if (
      filters.period !== "custom" ||
      filters.date_from !== draft.date_from ||
      filters.date_to !== draft.date_to
    ) {
      onChange({ period: "custom", ...draft });
    }
  };

  const activeKey = isCustomOpen ? "custom" : filters.period;

  return (
    <section className="dashboard-period" aria-label={t("dashboard.user.period.label")}>
      <div className="dashboard-period__bar">
        <div className="dashboard-period__options" role="group" aria-label={t("dashboard.user.period.label")}>
          {DASHBOARD_PERIODS.map((value) => (
            <button
              type="button"
              key={value}
              className={`dashboard-period__option${activeKey === value ? " dashboard-period__option--active" : ""}`}
              aria-pressed={activeKey === value}
              onClick={() => (value === "custom" ? setIsCustomOpen(true) : selectPreset(value))}
              disabled={disabled}
            >
              {t(`dashboard.user.period.options.${value}`)}
            </button>
          ))}
        </div>

        {period?.date_from && period?.date_to && (
          <span className="dashboard-period__range">
            <LuCalendarRange aria-hidden="true" />
            <bdi>{formatDate(period.date_from, locale)}</bdi>
            {" – "}
            <bdi>{formatDate(period.date_to, locale)}</bdi>
          </span>
        )}
      </div>

      {isCustomOpen && (
        <form className="dashboard-period__custom" onSubmit={applyCustom} noValidate>
          <label>
            <span>{t("dashboard.user.period.dateFrom")}</span>
            <input
              type="date"
              name="date_from"
              value={draft.date_from}
              max={draft.date_to || undefined}
              onChange={handleDraft}
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              required
            />
          </label>
          <label>
            <span>{t("dashboard.user.period.dateTo")}</span>
            <input
              type="date"
              name="date_to"
              value={draft.date_to}
              min={draft.date_from || undefined}
              onChange={handleDraft}
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              required
            />
          </label>
          <button type="submit" disabled={disabled}>
            {t("dashboard.user.period.apply")}
          </button>
          {error && (
            <p className="dashboard-period__error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
