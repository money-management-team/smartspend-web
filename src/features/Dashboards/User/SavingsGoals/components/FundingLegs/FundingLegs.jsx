import { useTranslation } from "react-i18next";
import { LuArrowRight } from "react-icons/lu";

import "./FundingLegs.css";

/*
 * The parts of one installment payment, one account each, exactly as the
 * backend gave them. Read only, except that a row with `selectable` gets a
 * checkbox (choosing payments to reverse).
 *
 * rows: [{ id, name, amount, detail?, state?: "effective" | "reversed",
 *          selectable?, checked? }]
 * `goalName` draws each row as account → goal; `money` renders amounts.
 */
export default function FundingLegs({ rows, goalName, money, onToggle, total, totalLabel }) {
  const { t } = useTranslation();

  return (
    <div className="funding-legs">
      <ol className="funding-legs__list">
        {rows.map((row) => {
          const content = (
            <>
              <span className="funding-legs__route">
                <span className="funding-legs__account" dir="auto">
                  {row.name ?? "—"}
                </span>
                {goalName && (
                  <>
                    <LuArrowRight className="funding-legs__arrow" aria-hidden="true" />
                    <span className="funding-legs__goal" dir="auto">
                      {goalName}
                    </span>
                  </>
                )}
                {row.detail && <small className="funding-legs__detail">{row.detail}</small>}
              </span>
              <span className="funding-legs__amount">
                {row.state === "reversed" ? <s>{money(row.amount)}</s> : money(row.amount)}
                {row.state === "reversed" && (
                  <small className="funding-legs__state">{t("dashboard.savingsGoals.smartPlan.legs.reversed")}</small>
                )}
              </span>
            </>
          );

          return (
            <li
              key={row.id}
              className={`funding-legs__row${row.state === "reversed" ? " funding-legs__row--reversed" : ""}${
                row.checked ? " funding-legs__row--checked" : ""
              }`}
            >
              {row.selectable ? (
                <label className="funding-legs__select">
                  <input type="checkbox" checked={Boolean(row.checked)} onChange={() => onToggle(row.id)} />
                  {content}
                </label>
              ) : (
                <div className="funding-legs__static">{content}</div>
              )}
            </li>
          );
        })}
      </ol>

      {total != null && (
        <p className="funding-legs__total">
          <span>{totalLabel}</span>
          <strong>{money(total)}</strong>
        </p>
      )}
    </div>
  );
}
