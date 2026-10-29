import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { DASHBOARD_PERIODS } from "../data/readApi.js";
import { isCalendarDay } from "../forms/validation.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { HOME_BLOCKS, useDevicePreferences } from "../preferences/deviceStore.js";
import MobileSheet from "../shell/MobileSheet.jsx";

/*
 * Home's period: one of the periods GET /dashboard documents (docs/dashboard/api.md),
 * or a custom range of two real days in order. The figures for it are the
 * backend's; nothing is worked out here. Choosing one changes the address, so
 * Back returns to the previous period.
 */
export function PeriodPicker({ value, onChange }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const [from, setFrom] = useState(value.from ?? "");
  const [to, setTo] = useState(value.to ?? "");
  const [custom, setCustom] = useState(value.period === "custom");
  const rangeOk = isCalendarDay(from) && isCalendarDay(to) && from <= to;

  const pick = (period) => {
    if (period === "custom") {
      setCustom(true);
      return;
    }
    setCustom(false);
    onChange({ period });
  };

  const apply = (event) => {
    event.preventDefault();
    if (rangeOk) onChange({ period: "custom", from, to });
  };

  return (
    <div className="sm-card sm-home-period" data-sm-section="period">
      <div className="sm-segment sm-segment-wrap" role="group" aria-label={t("home.periodLabel")}>
        {DASHBOARD_PERIODS.map((period) => (
          <button key={period} type="button" className="sm-segment-button" aria-pressed={period === "custom" ? custom : !custom && value.period === period} onClick={() => pick(period)} data-sm-period={period}>
            {t(`home.periods.${period}`)}
          </button>
        ))}
      </div>
      {custom && (
        <form className="sm-field-row sm-home-range" onSubmit={apply} noValidate>
          <div className="sm-field">
            <label className="sm-label" htmlFor={`${ids}-from`}>{t("home.from")}</label>
            <input id={`${ids}-from`} className="sm-input" type="date" dir="ltr" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div className="sm-field">
            <label className="sm-label" htmlFor={`${ids}-to`}>{t("home.to")}</label>
            <input id={`${ids}-to`} className="sm-input" type="date" dir="ltr" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
          </div>
          <button type="submit" className="sm-button sm-button-quiet" disabled={!rangeOk} data-sm-action="apply-range">{t("home.apply")}</button>
          {from && to && !rangeOk && <p className="sm-text sm-form-error">{t("forms.errors.endBeforeStart")}</p>}
        </form>
      )}
    </div>
  );
}

/* Show, hide and order the Home cards, on this device, for this person and workspace (preferences/deviceStore.js). */
export function ArrangeSheet({ open, onClose, returnFocusRef }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const prefs = useDevicePreferences();
  const move = (index, step) =>
    prefs.change((current) => {
      const order = [...current.homeOrder];
      const [item] = order.splice(index, 1);
      order.splice(index + step, 0, item);
      return { homeOrder: order };
    });
  const toggle = (id) => prefs.change((current) => ({ homeHidden: current.homeHidden.includes(id) ? current.homeHidden.filter((item) => item !== id) : [...current.homeHidden, id] }));

  return (
    <MobileSheet open={open} onClose={onClose} titleId="sm-arrange-title" title={t("home.arrangeTitle")} returnFocusRef={returnFocusRef}>
      <ul className="sm-arrange-list">
        {prefs.homeOrder.map((id, index) => (
          <li key={id} className="sm-arrange-row" data-sm-arrange={id}>
            <label className="sm-choice sm-cat-choice">
              <input type="checkbox" checked={!prefs.homeHidden.includes(id)} onChange={() => toggle(id)} />
              <span>{t(`home.blocks.${id}`)}</span>
            </label>
            <span className="sm-arrange-moves">
              <button type="button" className="sm-button sm-button-quiet sm-button-small" disabled={index === 0} onClick={() => move(index, -1)} aria-label={t("home.moveUp", { name: t(`home.blocks.${id}`) })} data-sm-move="up">↑</button>
              <button type="button" className="sm-button sm-button-quiet sm-button-small" disabled={index === prefs.homeOrder.length - 1} onClick={() => move(index, 1)} aria-label={t("home.moveDown", { name: t(`home.blocks.${id}`) })} data-sm-move="down">↓</button>
            </span>
          </li>
        ))}
      </ul>
      {!prefs.persisted && <p className="sm-text sm-muted sm-fine" data-sm-note="not-persisted">{t("home.notRemembered")}</p>}
      <div className="sm-actions">
        <button type="button" className="sm-button sm-button-quiet" onClick={() => prefs.change(() => ({ homeOrder: [...HOME_BLOCKS], homeHidden: [] }))} data-sm-action="reset-arrange">{t("home.resetArrange")}</button>
        <button type="button" className="sm-button" onClick={onClose}>{t("home.done")}</button>
      </div>
    </MobileSheet>
  );
}
