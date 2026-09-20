import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { getCategoryDetailsPath } from "../../../../../../routes/Path";
import { isCurrencyCode, toBarWidth, toRankedRow } from "../../reportHelpers";
import ReportBadge from "../ReportBadge/ReportBadge";
import ReportValue from "../ReportValue/ReportValue";

import "./ReportRankedList.css";

/*
 * Category rankings (`categories_by_currency`, `top_expense_categories`,
 * `top_income_categories`), one list per currency (and type when the backend
 * splits them). Amounts and percentages are the backend's; without a
 * percentage the bar only compares rows of the same list.
 */
export default function ReportRankedList({ groups }) {
  const { t } = useTranslation();

  return (
    <div className="report-ranked">
      {groups.map((group, groupIndex) => {
        const rows = group.rows.map(toRankedRow);
        const hasPercent = rows.some((row) => row.percent != null);
        const max = Math.max(...rows.map((row) => Math.abs(Number(row.amount)) || 0), 0);

        return (
          <div className="report-ranked__group" key={`${group.currency}-${group.type ?? groupIndex}`}>
            {(group.currency || group.type) && (
              <h3>
                {group.currency && <bdi dir="ltr">{group.currency}</bdi>}
                {group.type && <ReportBadge value={group.type} />}
              </h3>
            )}

            <ol>
              {rows.map((row, index) => {
                const currency = isCurrencyCode(row.currency) ? row.currency : isCurrencyCode(group.currency) ? group.currency : null;
                const width = hasPercent
                  ? toBarWidth(row.percent)
                  : max > 0
                    ? ((Math.abs(Number(row.amount)) || 0) / max) * 100
                    : 0;
                const name = row.name ?? t("dashboard.reports.uncategorized");

                return (
                  <li key={row.id ?? `${row.name}-${index}`} className="report-ranked__row">
                    <div className="report-ranked__top">
                      <span className="report-ranked__name">
                        {row.color && <i style={{ background: row.color }} aria-hidden="true" />}
                        {row.id != null ? <Link to={getCategoryDetailsPath(row.id)}>{name}</Link> : <bdi>{name}</bdi>}
                        {!group.type && row.type && <ReportBadge value={row.type} />}
                      </span>
                      <strong>
                        <ReportValue value={row.amount} type="money" currency={currency} />
                      </strong>
                    </div>
                    <div className="report-ranked__bottom">
                      <span className="report-ranked__track" aria-hidden="true">
                        <span style={{ inlineSize: `${width}%` }} />
                      </span>
                      {row.percent != null && <ReportValue value={row.percent} type="percent" />}
                      {row.count != null && (
                        <span className="report-ranked__count">
                          {t("dashboard.reports.transactionsCount", { value: row.count })}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
    </div>
  );
}
