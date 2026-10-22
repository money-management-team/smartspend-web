import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCalendarArrowUp, LuCheck, LuRotateCcw, LuSkipForward } from "react-icons/lu";

import { translateEnum } from "../../../FinancialOperations/transactionHelpers";
import {
  canReverseLegs,
  getInstallmentState,
  isMultiAccountInstallment,
  getOverdueInstallmentIds,
  getVisibleInstallments,
  isOpenInstallment,
} from "../../smartPlanHelpers";

import "./InstallmentTimeline.css";

const ACTIONS = [
  { type: "confirm", icon: LuCheck },
  { type: "postpone", icon: LuCalendarArrowUp },
  { type: "skip", icon: LuSkipForward },
];

/*
 * The plan's installments in sequence, each with its date (and the original
 * one when postponed), its exact scheduled amount and its state. Fulfilled
 * rows show what was really paid when it differs; partially reversed rows
 * show the reversed part and the shortfall. All values are the backend's.
 *
 * Open installments offer Confirm / Postpone / Skip while `canAct`; the
 * actions only open dialogs, which re-check everything with the backend.
 * Installments paid from several accounts can have their payments reversed
 * (`canReverse`); single-account ones keep the existing transfer reversal.
 * `money(value)` / `day(value)` render an amount / a Y-m-d date.
 */
export default function InstallmentTimeline({ plan, health, canAct, canReverse = false, onAction, money, day }) {
  const { t, i18n } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const prefix = "dashboard.savingsGoals.smartPlan.timeline";

  const installments = plan.installments ?? [];
  const overdueIds = getOverdueInstallmentIds(plan, health);
  const nextId = installments.find(isOpenInstallment)?.id;
  const { rows, hidden } = getVisibleInstallments(installments, showAll);

  if (installments.length === 0) {
    return <p className="installment-timeline__empty">{t(`${prefix}.empty`)}</p>;
  }

  return (
    <div className="installment-timeline">
      <ol className="installment-timeline__list">
        {rows.map((installment) => {
          const state = getInstallmentState(installment, overdueIds);
          const isNext = installment.id === nextId;
          const isOpen = isOpenInstallment(installment);
          const paidDiffers =
            installment.status === "fulfilled" &&
            installment.effective_amount != null &&
            installment.effective_amount !== installment.amount;
          const label = t(`${prefix}.installmentNumber`, { number: installment.sequence });

          return (
            <li
              key={installment.id}
              className={`installment-timeline__row installment-timeline__row--${state}${
                isNext ? " installment-timeline__row--next" : ""
              }`}
            >
              <span className="installment-timeline__marker" aria-hidden="true">
                {installment.status === "fulfilled" && <LuCheck />}
                {installment.status === "skipped" && <LuSkipForward />}
              </span>

              <div className="installment-timeline__main">
                <div className="installment-timeline__heading">
                  <span className="installment-timeline__date">{day(installment.planned_date)}</span>
                  <span className="installment-timeline__seq">{label}</span>
                  {isNext && (
                    <span className="installment-timeline__next">{t(`${prefix}.next`)}</span>
                  )}
                </div>

                <div className="installment-timeline__meta">
                  <span className={`installment-timeline__state installment-timeline__state--${state}`}>
                    {translateEnum(t, i18n, `${prefix}.states`, state)}
                  </span>

                  {Number(installment.postponed_count) > 0 && (
                    <span className="installment-timeline__note">
                      {t(`${prefix}.postponedCount`, { count: Number(installment.postponed_count) })}
                      {installment.original_planned_date && (
                        <>
                          {" · "}
                          {t(`${prefix}.originally`)}{" "}
                          <s>{day(installment.original_planned_date)}</s>
                        </>
                      )}
                    </span>
                  )}

                  {state === "partially_reversed" && (
                    <span className="installment-timeline__note">
                      {t(`${prefix}.paid`)} {money(installment.effective_amount)}
                      {" · "}
                      {t(`${prefix}.reversed`)} {money(installment.reversed_amount)}
                      {installment.shortfall_amount != null && (
                        <>
                          {" · "}
                          {t(`${prefix}.shortfall`)} {money(installment.shortfall_amount)}
                        </>
                      )}
                    </span>
                  )}

                  {state === "fulfilled" && paidDiffers && (
                    <span className="installment-timeline__note">
                      {t(`${prefix}.paid`)} {money(installment.effective_amount)}
                    </span>
                  )}

                  {isMultiAccountInstallment(installment) && (
                    <span className="installment-timeline__note">{t(`${prefix}.multiAccount`)}</span>
                  )}

                  {state === "skipped" && (
                    <span className="installment-timeline__note">{t(`${prefix}.skippedNote`)}</span>
                  )}
                </div>
              </div>

              <div className="installment-timeline__amount">
                {state === "skipped" || state === "cancelled" ? (
                  <s>{money(installment.amount)}</s>
                ) : (
                  money(installment.amount)
                )}
                <small>{t(`${prefix}.scheduled`)}</small>
              </div>

              {canReverse && canReverseLegs(installment) && (
                <div className="installment-timeline__actions installment-timeline__actions--compact-text">
                  <button
                    type="button"
                    className="installment-timeline__action installment-timeline__action--reverse"
                    onClick={() => onAction("reverse", installment)}
                    aria-label={t(`${prefix}.actions.reverseNamed`, { number: installment.sequence })}
                  >
                    <LuRotateCcw aria-hidden="true" />
                    <span>{t(`${prefix}.actions.reverse`)}</span>
                  </button>
                </div>
              )}

              {isOpen && canAct && (
                // Full buttons where action is expected (the next or an
                // overdue installment); compact icon buttons on later ones.
                <div
                  className={`installment-timeline__actions${
                    isNext || state === "overdue" ? "" : " installment-timeline__actions--compact"
                  }`}
                >
                  {ACTIONS.map(({ type, icon: Icon }) => (
                    <button
                      key={type}
                      type="button"
                      className={`installment-timeline__action${
                        type === "confirm" ? " installment-timeline__action--primary" : ""
                      }`}
                      onClick={() => onAction(type, installment)}
                      aria-label={t(`${prefix}.actions.${type}Named`, { number: installment.sequence })}
                      title={t(`${prefix}.actions.${type}Named`, { number: installment.sequence })}
                    >
                      <Icon aria-hidden="true" />
                      <span>{t(`${prefix}.actions.${type}`)}</span>
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {(hidden > 0 || showAll) && (
        <button
          type="button"
          className="installment-timeline__toggle"
          onClick={() => setShowAll((value) => !value)}
          aria-expanded={showAll}
        >
          {showAll
            ? t(`${prefix}.showLess`)
            : t(`${prefix}.showAll`, { count: installments.length })}
        </button>
      )}
    </div>
  );
}
