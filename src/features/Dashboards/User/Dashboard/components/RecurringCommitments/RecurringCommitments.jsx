import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import SectionCard from "../shared/SectionCard";
import { PATH, getRecurringDetailsPath } from "../../../../../../routes/Path";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { translateEnum } from "../../../FinancialOperations/transactionHelpers";
import { formatDate } from "../../../utils/formatters";
import { formatOptionalMoney, getBlockCounts, getBlockItems } from "../../dashboardHelpers";

import "./RecurringCommitments.css";

const COUNT_KEYS = ["active_count", "due_count", "overdue_count", "upcoming_count", "paused_count"];
const VISIBLE_ROWS = 4;

const isTrue = (value) => value === true || value === 1 || value === "1" || value === "true";

/*
 * `commitments.recurring` of GET /dashboard: upcoming recurring rules and
 * their counts, as the backend reports them. A rule is not money: nothing
 * here is posted until an occurrence is confirmed (or processed
 * automatically by the backend).
 */
export default function RecurringCommitments({ block }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const rows = getBlockItems(block).slice(0, VISIBLE_ROWS);
  const counts = getBlockCounts(block, COUNT_KEYS);

  return (
    <SectionCard
      className="recurring-commitments"
      title={t("dashboard.user.commitments.title")}
      action={
        <Link to={PATH.USER.RECURRING} className="dashboard-section-link">
          {t("dashboard.user.common.viewAll")}
        </Link>
      }
    >
      <div className="recurring-commitments__body">
        {counts.length > 0 && (
          <ul className="recurring-commitments__counts">
            {counts.map(([key, value]) => (
              <li key={key}>
                <strong>
                  <bdi>{Number(value).toLocaleString(locale)}</bdi>
                </strong>
                <span>{translateEnum(t, i18n, "dashboard.user.commitments.counts", key)}</span>
              </li>
            ))}
          </ul>
        )}

        {rows.length === 0 ? (
          <p className="recurring-commitments__empty">{t("dashboard.user.commitments.empty")}</p>
        ) : (
          <ul className="recurring-commitments__list">
            {rows.map((row, index) => {
              const ruleId = row.recurring_transaction_id ?? row.id;
              const dueDate = row.next_due_date ?? row.due_date;
              const type = row.type ?? row.recurring_transaction?.type;
              const name = row.name ?? row.recurring_transaction?.name ?? `#${ruleId ?? index + 1}`;

              return (
                <li key={`${ruleId ?? index}-${dueDate ?? ""}`} className="recurring-commitments__item">
                  <div className="recurring-commitments__copy">
                    {ruleId != null ? (
                      <Link to={getRecurringDetailsPath(ruleId)} dir="auto">
                        {name}
                      </Link>
                    ) : (
                      <span dir="auto">{name}</span>
                    )}
                    <small>
                      {dueDate && <bdi>{formatDate(dueDate, locale)}</bdi>}
                      {isTrue(row.is_overdue) && (
                        <span className="recurring-commitments__overdue">
                          {t("dashboard.recurring.overdue")}
                        </span>
                      )}
                    </small>
                  </div>
                  <strong className={`recurring-commitments__amount recurring-commitments__amount--${type ?? "neutral"}`}>
                    {type === "income" ? "+" : type === "expense" ? "-" : ""}
                    {formatOptionalMoney(row.amount, row.currency_code, locale)}
                  </strong>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}
