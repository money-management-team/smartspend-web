import { useTranslation } from "react-i18next";

import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { MINUS, currencyName, formatMoneyParts } from "./decimal.js";
import { useMoneyHidden } from "./privacyContext.js";

/*
 * One amount. The visible text is a single left-to-right run (so digits keep
 * their order inside Arabic text), and a separate text for assistive
 * technology says the amount in words: "minus 1,234.50 Israeli New Shekel"
 * instead of "ILS" read letter by letter. An amount that is unavailable shows
 * "—" and says "not available"; it never shows 0.
 *
 * `plus` puts "+" in front of a positive amount (income). A negative amount is
 * tinted unless `plain` is set (a ledger row's sign comes from its type, and a
 * list of expenses in red is noise); the sign is always in the text, never in
 * colour alone, and no amount is ever green.
 */
export default function Money({ value, currency, plus = false, plain = false, className = "" }) {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const hidden = useMoneyHidden();
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";
  const parts = formatMoneyParts(value, currency, locale);
  const base = `sm-money${className ? ` ${className}` : ""}`;

  if (hidden) {
    return (
      <span className={`${base} sm-money-hidden`}>
        <span aria-hidden="true">••••</span>
        <span className="sm-sr">{t("money.hidden")}</span>
      </span>
    );
  }

  if (!parts) {
    return (
      <span className={`${base} sm-money-na`}>
        <span aria-hidden="true">—</span>
        <span className="sm-sr">{t("money.unavailable")}</span>
      </span>
    );
  }

  const sign = parts.negative ? MINUS : plus && !parts.zero ? "+" : "";
  const spoken = `${parts.negative ? `${t("money.minus")} ` : plus && !parts.zero ? `${t("money.plus")} ` : ""}${parts.number} ${currencyName(parts.currency, locale)}`;

  return (
    <span className={`${base}${parts.negative && !plain ? " sm-money-negative" : ""}`} data-sm-len={parts.number.length > 18 ? "xlong" : parts.number.length > 13 ? "long" : undefined}>
      <bdi dir="ltr" aria-hidden="true" className="sm-money-run">
        <span className="sm-money-number">{sign}{parts.number}</span>
        <span className="sm-money-currency">{parts.currency}</span>
      </bdi>
      <span className="sm-sr">{spoken}</span>
    </span>
  );
}
