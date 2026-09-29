import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { getTransactionDetailsPath } from "../../../../../../routes/Path";
import { isCurrencyCode, toTransactionRow } from "../../reportHelpers";
import ReportBadge from "../ReportBadge/ReportBadge";
import ReportValue from "../ReportValue/ReportValue";

import "./ReportTransactions.css";

/*
 * Transaction highlights (`top_transactions`,
 * `recent_high_value_transactions`). Each row keeps its own currency; the
 * list is shown in the backend's order.
 */
export default function ReportTransactions({ rows }) {
  const { t } = useTranslation();

  return (
    <ol className="report-transactions">
      {rows.map(toTransactionRow).map((row, index) => {
        const title = row.title ?? t("dashboard.reports.untitledTransaction");
        const meta = [row.category, row.account].filter(Boolean).join(" · ");

        return (
          <li className="report-transactions__row" key={row.id ?? index}>
            <div className="report-transactions__main">
              {row.id != null ? (
                <Link to={getTransactionDetailsPath(row.id)}>{title}</Link>
              ) : (
                <bdi>{title}</bdi>
              )}
              <span className="report-transactions__meta">
                {row.date && <ReportValue value={row.date} type="date" />}
                {meta && <bdi>{meta}</bdi>}
              </span>
            </div>
            <div className="report-transactions__side">
              <strong>
                <ReportValue
                  value={row.amount}
                  type="money"
                  currency={isCurrencyCode(row.currency) ? row.currency : null}
                />
              </strong>
              {row.type && <ReportBadge value={row.type} />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
