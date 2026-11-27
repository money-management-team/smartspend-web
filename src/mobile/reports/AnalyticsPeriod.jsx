import { useId, useState } from "react";
import { LuCalendarDays, LuChevronDown } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatDay } from "../money/format.js";
import { HUB_PRESETS } from "../models/analytics.js";
import { validReportRange } from "../models/reports.js";

/*
 * The period the analytics are for: a few ready-made ones in one compact selector (the same control Home uses for
 * its period), or a custom range of two real dates in order. The range is in the address, so Back and a shared
 * link show the same figures; nothing is stored. The dates under the selector are the range actually asked for.
 */
export default function AnalyticsPeriod({ range, locale, onPreset, onRange }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const id = useId();
  const [custom, setCustom] = useState(range.preset === "custom");
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [tried, setTried] = useState(false);
  const valid = validReportRange(from, to);

  const choose = (value) => {
    if (value === "custom") {
      setCustom(true);
      return;
    }
    setCustom(false);
    onPreset(value);
  };

  return (
    <div className="sm-an-period" data-sm-section="period">
      <div className="sm-an-period-row">
        <label className="sm-period-select" data-sm-period-picker>
          <span className="sm-sr">{t("analytics.period")}</span>
          <LuCalendarDays className="sm-period-select-icon" aria-hidden="true" />
          <select className="sm-period-select-input" value={custom ? "custom" : range.preset} onChange={(event) => choose(event.target.value)}>
            {[...HUB_PRESETS, "custom"].map((value) => <option key={value} value={value}>{t(`analytics.preset.${value}`)}</option>)}
          </select>
          <LuChevronDown className="sm-period-select-chevron" aria-hidden="true" />
        </label>
        <p className="sm-text sm-muted sm-fine sm-an-range" data-sm-range={`${range.from}:${range.to}`}>
          <bdi>{formatDay(range.from, locale) ?? range.from}</bdi> – <bdi>{formatDay(range.to, locale) ?? range.to}</bdi>
        </p>
      </div>

      {custom && (
        <form
          className="sm-field-row sm-an-custom"
          onSubmit={(event) => {
            event.preventDefault();
            setTried(true);
            if (valid) onRange({ from, to });
          }}
          noValidate
        >
          <div className="sm-field">
            <label className="sm-label" htmlFor={`${id}-from`}>{t("reports.from")}</label>
            <input id={`${id}-from`} className="sm-input" type="date" dir="ltr" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} aria-invalid={tried && !valid ? "true" : undefined} />
          </div>
          <div className="sm-field">
            <label className="sm-label" htmlFor={`${id}-to`}>{t("reports.to")}</label>
            <input id={`${id}-to`} className="sm-input" type="date" dir="ltr" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} aria-invalid={tried && !valid ? "true" : undefined} />
          </div>
          <button type="submit" className="sm-button sm-button-quiet" data-sm-action="apply-range">{t("reports.apply")}</button>
          {tried && !valid && <p className="sm-text sm-form-error" role="alert">{t("reports.rangeInvalid")}</p>}
        </form>
      )}
    </div>
  );
}
