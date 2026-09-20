import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuRotateCcw, LuSlidersHorizontal } from "react-icons/lu";

import {
  DATE_PRESETS,
  GROUP_BY_OPTIONS,
  PER_PAGE_OPTIONS,
  getActivePreset,
  getPresetRange,
  validateDateRange,
} from "../../reportHelpers";

import "./ReportFilters.css";

const FIELDS = ["from", "to", "currency", "group_by", "per_page"];

/*
 * The documented report filters: from, to, currency, group_by and (for the
 * paginated reports) per_page. Edits stay in a draft until applied, and an
 * incomplete or reversed range is never applied. The parent remounts this
 * component (via `key`) when the applied filters change, so the draft always
 * starts from what is in the URL.
 */
export default function ReportFilters({ filters, currencies, showPerPage, timeZone, onApply, onReset }) {
  const { t } = useTranslation();
  const errorId = useId();
  const [draft, setDraft] = useState(() => ({
    from: filters.from,
    to: filters.to,
    currency: filters.currency,
    group_by: filters.group_by,
    per_page: filters.per_page,
  }));
  const [error, setError] = useState(null);
  const activePreset = getActivePreset(draft.from, draft.to, timeZone);
  const isDirty = FIELDS.some((field) => draft[field] !== filters[field]);

  const update = (field) => (event) => {
    const { value } = event.target;

    setDraft((current) => ({ ...current, [field]: field === "per_page" ? Number(value) : value }));
    setError(null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const rangeError = validateDateRange(draft.from, draft.to);
    if (rangeError) {
      setError(rangeError);
      return;
    }

    onApply(draft);
  };

  const applyPreset = (preset) => {
    setError(null);
    onApply({ ...draft, ...getPresetRange(preset, timeZone) });
  };

  return (
    <form className="report-filters" onSubmit={handleSubmit} noValidate>
      <div className="report-filters__presets" role="group" aria-label={t("dashboard.reports.filters.presetsLabel")}>
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`report-filters__preset ${activePreset === preset ? "report-filters__preset--active" : ""}`}
            aria-pressed={activePreset === preset}
            onClick={() => applyPreset(preset)}
          >
            {t(`dashboard.reports.filters.presets.${preset}`)}
          </button>
        ))}
      </div>

      <div className="report-filters__fields">
        <label className="report-filters__field">
          <span>{t("dashboard.reports.filters.from")}</span>
          <input
            type="date"
            value={draft.from}
            max={draft.to || undefined}
            onChange={update("from")}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? errorId : undefined}
            required
          />
        </label>

        <label className="report-filters__field">
          <span>{t("dashboard.reports.filters.to")}</span>
          <input
            type="date"
            value={draft.to}
            min={draft.from || undefined}
            onChange={update("to")}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? errorId : undefined}
            required
          />
        </label>

        <label className="report-filters__field">
          <span>{t("dashboard.reports.filters.currency")}</span>
          <select value={draft.currency} onChange={update("currency")}>
            <option value="">{t("dashboard.reports.filters.allCurrencies")}</option>
            {currencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>

        <label className="report-filters__field">
          <span>{t("dashboard.reports.filters.groupBy")}</span>
          <select value={draft.group_by} onChange={update("group_by")}>
            {GROUP_BY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {t(`dashboard.reports.filters.groupByOptions.${option}`)}
              </option>
            ))}
          </select>
        </label>

        {showPerPage && (
          <label className="report-filters__field">
            <span>{t("dashboard.reports.filters.perPage")}</span>
            <select value={draft.per_page} onChange={update("per_page")}>
              {PER_PAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="report-filters__actions">
          <button type="submit" className="report-filters__apply" disabled={!isDirty}>
            <LuSlidersHorizontal aria-hidden="true" />
            <span>{t("dashboard.reports.filters.apply")}</span>
          </button>
          <button type="button" className="report-filters__reset" onClick={onReset}>
            <LuRotateCcw aria-hidden="true" />
            <span>{t("dashboard.reports.filters.reset")}</span>
          </button>
        </div>
      </div>

      {error && (
        <p id={errorId} className="report-filters__error" role="alert">
          {t(`dashboard.reports.filters.errors.${error}`)}
        </p>
      )}
    </form>
  );
}
