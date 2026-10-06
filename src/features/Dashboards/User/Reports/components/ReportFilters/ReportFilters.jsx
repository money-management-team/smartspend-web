import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuChevronDown, LuRotateCcw, LuSlidersHorizontal } from "react-icons/lu";
import { DATE_PRESETS, GROUP_BY_OPTIONS, PER_PAGE_OPTIONS, getActivePreset,
  getPresetRange, validateDateRange } from "../../reportHelpers";
import "./ReportFilters.css";

const FIELDS = ["from", "to", "currency", "group_by", "per_page"];

// Applied state stays in the URL; custom/advanced edits remain drafts until validated.
export default function ReportFilters({ filters, currencies, showPerPage, timeZone,
  onApply, onReset, reportSelector }) {
  const { t } = useTranslation();
  const errorId = useId();
  const fieldsId = useId();
  const [showFields, setShowFields] = useState(false);
  const [customSelected, setCustomSelected] = useState(() => !getActivePreset(filters.from, filters.to, timeZone));
  const [draft, setDraft] = useState(() => ({ from: filters.from, to: filters.to,
    currency: filters.currency, group_by: filters.group_by, per_page: filters.per_page }));
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
    if (rangeError) { setError(rangeError); setCustomSelected(true); return; }
    onApply(draft);
  };
  const selectPeriod = (event) => {
    const value = event.target.value;
    setError(null);
    if (value === "custom") { setCustomSelected(true); return; }
    setCustomSelected(false);
    onApply({ ...draft, ...getPresetRange(value, timeZone) });
  };
  return (
    <form className="report-filters" onSubmit={handleSubmit} noValidate>
      <div className="report-filters__primary">
        {reportSelector}
        <label className="report-filters__field">
          <span>{t("dashboard.reports.ui.periodLabel")}</span>
          <div className="report-filters__select">
            <select value={customSelected ? "custom" : activePreset ?? "custom"} onChange={selectPeriod}>
              {DATE_PRESETS.map((preset) => <option key={preset} value={preset}>{t(`dashboard.reports.filters.presets.${preset}`)}</option>)}
              <option value="custom">{t("dashboard.reports.ui.customRange")}</option>
            </select>
            <LuChevronDown aria-hidden="true" />
          </div>
        </label>
        <label className="report-filters__field">
          <span>{t("dashboard.reports.filters.currency")}</span>
          <div className="report-filters__select">
            <select value={draft.currency} onChange={update("currency")}>
              <option value="">{t("dashboard.reports.filters.allCurrencies")}</option>
              {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
            <LuChevronDown aria-hidden="true" />
          </div>
        </label>
      </div>
      {customSelected && <div className="report-filters__custom">
        <label className="report-filters__field">
          <span>{t("dashboard.reports.filters.from")}</span>
          <input type="date" value={draft.from} max={draft.to || undefined} onChange={update("from")}
            aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined} required />
        </label>
        <label className="report-filters__field">
          <span>{t("dashboard.reports.filters.to")}</span>
          <input type="date" value={draft.to} min={draft.from || undefined} onChange={update("to")}
            aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined} required />
        </label>
      </div>}
      <div className="report-filters__toolbar">
        <button type="button" className="report-filters__toggle" aria-expanded={showFields}
          aria-controls={fieldsId} onClick={() => setShowFields((open) => !open)}>
          <LuSlidersHorizontal aria-hidden="true" />{t("dashboard.reports.ui.advanced")}
          <LuChevronDown aria-hidden="true" className={showFields ? "report-filters__chevron--open" : ""} />
        </button>
        <button type="button" className="report-filters__reset" onClick={onReset}>
          <LuRotateCcw aria-hidden="true" />{t("dashboard.reports.filters.reset")}
        </button>
        {isDirty && <button type="submit" className="report-filters__apply">
          {t("dashboard.reports.filters.apply")}
        </button>}
      </div>
      <div id={fieldsId} hidden={!showFields} className="report-filters__advanced">
        <label className="report-filters__field">
          <span>{t("dashboard.reports.filters.groupBy")}</span>
          <div className="report-filters__select">
            <select value={draft.group_by} onChange={update("group_by")}>
              {GROUP_BY_OPTIONS.map((option) => <option key={option} value={option}>{t(`dashboard.reports.filters.groupByOptions.${option}`)}</option>)}
            </select><LuChevronDown aria-hidden="true" />
          </div>
        </label>
        {showPerPage && <label className="report-filters__field">
          <span>{t("dashboard.reports.filters.perPage")}</span>
          <div className="report-filters__select">
            <select value={draft.per_page} onChange={update("per_page")}>
              {PER_PAGE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select><LuChevronDown aria-hidden="true" />
          </div>
        </label>}
      </div>
      {error && <p id={errorId} className="report-filters__error" role="alert">{t(`dashboard.reports.filters.errors.${error}`)}</p>}
    </form>
  );
}
