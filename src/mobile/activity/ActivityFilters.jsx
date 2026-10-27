import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuX } from "react-icons/lu";

import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatDay } from "../money/format.js";
import { ACTIVITY_SORTS, ACTIVITY_STATUSES, ACTIVITY_TYPES, DEFAULT_SORT, activeFilterKeys, isCalendarDate } from "../models/activity.js";
import MobileSheet from "../shell/MobileSheet.jsx";
import { useFilterChoices } from "./useFilterChoices.js";

const EMPTY = Object.freeze({ type: "", status: "", account_id: "", category_id: "", date_from: "", date_to: "", sort: DEFAULT_SORT });

function FilterForm({ initial, choices, onApply, onCancel }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const [draft, setDraft] = useState(initial);
  const [problem, setProblem] = useState(null);
  const set = (name, value) => {
    setProblem(null);
    setDraft((current) => ({ ...current, [name]: value }));
  };

  const categoryChoices = choices.categories.filter((item) => !draft.type || draft.type === "transfer" || item.type === draft.type);

  const apply = (event) => {
    event.preventDefault();

    if (draft.date_from && draft.date_to && draft.date_from > draft.date_to) {
      setProblem("dateOrder");
      return;
    }

    onApply(draft);
  };

  return (
    <form className="sm-filter-form" onSubmit={apply} noValidate>
      <fieldset className="sm-fieldset">
        <legend className="sm-label">{t("filter.type")}</legend>
        <div className="sm-segment">
          {["", ...ACTIVITY_TYPES].map((value) => (
            <button key={value || "all"} type="button" className="sm-segment-button" aria-pressed={draft.type === value} onClick={() => set("type", value)}>
              {t(value ? `types.${value}` : "filter.typeAll")}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="sm-field">
        <span className="sm-label">{t("filter.status")}</span>
        <select className="sm-select" value={draft.status} onChange={(event) => set("status", event.target.value)}>
          <option value="">{t("filter.statusAll")}</option>
          {ACTIVITY_STATUSES.map((value) => (
            <option key={value} value={value}>{t(`status.${value}`)}</option>
          ))}
        </select>
      </label>

      <label className="sm-field">
        <span className="sm-label">{t("filter.account")}</span>
        <select className="sm-select" value={draft.account_id} onChange={(event) => set("account_id", event.target.value)}>
          <option value="">{t("filter.accountAll")}</option>
          {draft.account_id && !choices.accounts.some((item) => item.id === draft.account_id) && <option value={draft.account_id}>{t("filter.accountId", { id: draft.account_id })}</option>}
          {choices.accounts.map((item) => (
            <option key={item.id} value={item.id}>{item.name}{item.currency ? ` (${item.currency})` : ""}</option>
          ))}
        </select>
      </label>

      <label className="sm-field">
        <span className="sm-label">{t("filter.category")}</span>
        <select className="sm-select" value={draft.category_id} onChange={(event) => set("category_id", event.target.value)}>
          <option value="">{t("filter.categoryAll")}</option>
          {draft.category_id && !categoryChoices.some((item) => item.id === draft.category_id) && <option value={draft.category_id}>{t("filter.categoryId", { id: draft.category_id })}</option>}
          {categoryChoices.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </label>

      {choices.failed && <p className="sm-text sm-muted sm-fine" role="status">{t("filter.choicesFailed")}</p>}

      <div className="sm-field-row">
        <label className="sm-field">
          <span className="sm-label">{t("filter.from")}</span>
          <input className="sm-input" type="date" value={draft.date_from} max={draft.date_to || undefined} onChange={(event) => set("date_from", isCalendarDate(event.target.value) ? event.target.value : "")} aria-invalid={problem === "dateOrder"} />
        </label>
        <label className="sm-field">
          <span className="sm-label">{t("filter.to")}</span>
          <input className="sm-input" type="date" value={draft.date_to} min={draft.date_from || undefined} onChange={(event) => set("date_to", isCalendarDate(event.target.value) ? event.target.value : "")} aria-invalid={problem === "dateOrder"} />
        </label>
      </div>
      {problem === "dateOrder" && <p className="sm-text sm-form-error" role="alert">{t("filter.dateOrder")}</p>}

      <label className="sm-field">
        <span className="sm-label">{t("filter.sort")}</span>
        <select className="sm-select" value={draft.sort} onChange={(event) => set("sort", event.target.value)}>
          {ACTIVITY_SORTS.map((value) => (
            <option key={value} value={value}>{t(value === DEFAULT_SORT ? "filter.sortDesc" : "filter.sortAsc")}</option>
          ))}
        </select>
      </label>

      <div className="sm-actions">
        <button type="submit" className="sm-button">{t("filter.apply")}</button>
        <button type="button" className="sm-button sm-button-quiet" onClick={() => { setProblem(null); setDraft(EMPTY); }}>{t("filter.reset")}</button>
        <button type="button" className="sm-button sm-button-quiet" onClick={onCancel}>{t("filter.cancel")}</button>
      </div>
    </form>
  );
}

/*
 * The filter sheet and the chips that show what is applied.
 *
 * Only what GET /transactions accepts is offered: type, status, account,
 * category, a date range and the two date orders. The form edits a draft;
 * Apply commits it (the screen puts it in the address), Reset clears the draft
 * (and still needs Apply), Cancel closes without changing anything. There is
 * no text search because the endpoint has none.
 */
export default function ActivityFilters({ open, onOpen, onClose, openerRef, filters, onApply, onRemove, onResetAll }) {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";
  const active = activeFilterKeys(filters);
  const choices = useFilterChoices(open || active.includes("account_id") || active.includes("category_id"));
  const [opened, setOpened] = useState(0);

  const label = (key) => {
    switch (key) {
      case "type":
        return t(`types.${filters.type}`);
      case "status":
        return t(`status.${filters.status}`);
      case "account_id":
        return t("chip.account", { name: choices.accounts.find((item) => item.id === filters.account_id)?.name ?? t("filter.accountId", { id: filters.account_id }) });
      case "category_id":
        return t("chip.category", { name: choices.categories.find((item) => item.id === filters.category_id)?.name ?? t("filter.categoryId", { id: filters.category_id }) });
      case "date_from":
        return t("chip.from", { date: formatDay(filters.date_from, locale) });
      default:
        return t("chip.to", { date: formatDay(filters.date_to, locale) });
    }
  };

  return (
    <>
      <div className="sm-toolbar">
        <button
          type="button"
          ref={openerRef}
          className="sm-button sm-button-quiet sm-button-small"
          aria-haspopup="dialog"
          onClick={() => {
            setOpened((count) => count + 1);
            onOpen();
          }}
        >
          {active.length ? t("activity.filtersActive", { count: active.length }) : t("activity.filters")}
        </button>
        {filters.sort !== DEFAULT_SORT && <span className="sm-chip">{t("filter.sortAsc")}</span>}
      </div>

      {active.length > 0 && (
        <ul className="sm-chips" aria-label={t("activity.activeFilters")}>
          {active.map((key) => (
            <li key={key}>
              <button type="button" className="sm-chip sm-chip-button" onClick={() => onRemove(key)} aria-label={t("activity.removeFilter", { label: label(key) })}>
                <span>{label(key)}</span>
                <LuX aria-hidden="true" />
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="sm-chip sm-chip-button sm-chip-quiet" onClick={onResetAll}>{t("activity.resetAll")}</button>
          </li>
        </ul>
      )}

      <MobileSheet open={open} onClose={onClose} titleId="sm-filter-title" title={t("filter.title")} returnFocusRef={openerRef}>
        <FilterForm key={opened} initial={{ ...EMPTY, ...filters }} choices={choices} onApply={onApply} onCancel={onClose} />
      </MobileSheet>
    </>
  );
}
