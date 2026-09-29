import { useTranslation } from "react-i18next";

import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatReportValue, getAmountTone } from "../../reportHelpers";

import "./ReportValue.css";

const NUMERIC_TYPES = new Set(["money", "count", "decimal", "percent"]);

/*
 * One backend value, formatted for its type. Money uses its own currency and
 * keeps the backend's string until the formatter; numbers are isolated as LTR
 * so they read correctly inside Arabic text. `tone` colors a signed amount.
 */
export default function ReportValue({ value, type, currency, tone = false, className = "" }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const text = formatReportValue(value, type, { currency, locale, t, i18n });
  const classes = ["report-value", tone ? `report-value--${getAmountTone(value)}` : "", className]
    .filter(Boolean)
    .join(" ");

  return NUMERIC_TYPES.has(type) ? (
    <bdi dir="ltr" className={classes}>{text}</bdi>
  ) : (
    <bdi className={classes}>{text}</bdi>
  );
}
