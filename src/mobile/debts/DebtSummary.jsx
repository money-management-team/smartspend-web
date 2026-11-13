import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import Money from "../money/Money.jsx";
import { buildDebtSummary } from "../models/debts.js";
import { MOBILE_DEBTS, reportPath } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import StaleNotice from "../ui/StaleNotice.jsx";

const MALFORMED = Object.freeze({ code: "MALFORMED_RESPONSE" });
const SIDES = [
  { key: "payable", label: "owe" },
  { key: "receivable", label: "owed" },
];

/*
 * Where the person stands on their debts (GET /debts/summary): one block per currency, each with what they owe and what
 * they are owed, the paid part of each, and the backend's own net position. Open debts only, as the backend counts
 * them. Nothing is added, subtracted or converted here, and two currencies are never put into one figure.
 */
export default function DebtSummary({ resource }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const rows = useMemo(() => {
    if (resource.data === undefined) return null;
    try {
      return buildDebtSummary(resource.data);
    } catch {
      return null;
    }
  }, [resource.data]);

  let body;
  if (resource.loading) body = <Skeleton lines={3} label={t("debtView.summary.loading")} />;
  else if (!rows) body = <ErrorPanel error={resource.error ?? MALFORMED} onRetry={resource.reload} retrying={resource.refreshing} compact />;
  else if (rows.length === 0) body = <p className="sm-text sm-muted" data-sm-summary="none">{t("debtView.summary.empty")}</p>;
  else {
    body = (
      <>
        {resource.stale && <StaleNotice error={resource.error} updatedAt={resource.updatedAt} onRetry={resource.reload} retrying={resource.refreshing} />}
        {rows.map((row) => (
          <div key={row.currency} className="sm-debt-currency" data-sm-currency={row.currency}>
            <h3 className="sm-debt-currency-head">
              <bdi dir="ltr" className="sm-debt-currency-code">{row.currency}</bdi>
              {row.openCount !== null && <span className="sm-text sm-muted sm-fine">{t("debtView.summary.openCount", { n: row.openCount })}</span>}
            </h3>

            <dl className="sm-debt-sides">
              {SIDES.map(({ key, label }) => (
                <div key={key} className="sm-debt-side" data-sm-side={key}>
                  <dt>{t(`debtView.summary.${label}`)}</dt>
                  <dd>
                    <Money className="sm-debt-side-money" value={row[key].remaining} currency={row.currency} />
                    <span className="sm-debt-side-meta">{t("debtView.summary.paidSoFar")} <Money plain value={row[key].paid} currency={row.currency} /></span>
                  </dd>
                </div>
              ))}
            </dl>

            <div className="sm-debt-net" data-sm-net={row.netSign}>
              <span className="sm-debt-net-label">{t("debtView.summary.net")}</span>
              <Money className="sm-debt-net-money" value={row.net} currency={row.currency} />
              <span className="sm-text sm-muted sm-fine">{t(`debtView.summary.netWords.${row.netSign}`)}</span>
            </div>

            {row.overdueCount > 0 && (
              <Link className="sm-note-link" to={`${MOBILE_DEBTS}?status=overdue`} data-sm-overdue-link={row.currency}>
                {t("debtView.summary.overdueCount", { n: row.overdueCount })} · {t("debtView.summary.showOverdue")}
              </Link>
            )}
          </div>
        ))}
      </>
    );
  }

  return (
    <section className="sm-card" aria-labelledby="sm-debt-summary" data-sm-section="debt-summary">
      <h2 id="sm-debt-summary" className="sm-card-title">{t("debtView.summary.title")}</h2>
      <p className="sm-text sm-muted sm-fine">{t("debtView.summary.hint")}</p>
      {body}
      <Link className="sm-link-row" to={reportPath("debts")}>
        <span>{t("debtView.summary.report")}</span>
        <Chevron />
      </Link>
    </section>
  );
}
