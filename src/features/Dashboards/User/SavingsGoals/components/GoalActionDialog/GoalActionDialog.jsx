import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LuTriangleAlert } from "react-icons/lu";

import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatMoney } from "../../../utils/formatters";
import {
  getGoalActions,
  getGoalCurrency,
  getGoalErrorMessage,
  getGoalProgress,
} from "../../savingsGoalHelpers";

// Same modal shell as the other dashboard dialogs; the error block comes from
// the reverse dialog's stylesheet.
import "../../../Accounts/components/AccountForm/AccountForm.css";
import "../../../FinancialOperations/components/ReverseTransactionDialog/ReverseTransactionDialog.css";
import "./GoalActionDialog.css";

// What each action explains before it runs.
const POINTS = {
  pause: ["moneyStays", "withdrawalsAllowed", "contributionsBlocked"],
  resume: ["contributionsAllowed", "statusFromBackend"],
  archive: ["notDeleted", "keepsHistory", "readOnly", "mustBeEmpty"],
};

/*
 * Confirms a lifecycle action on a goal:
 * - "pause"   → POST /savings-goals/{id}/pause
 * - "resume"  → POST /savings-goals/{id}/resume
 * - "archive" → DELETE /savings-goals/{id} (an archive, never a deletion)
 *
 * Archiving needs an empty goal: while it holds money the confirm button is
 * disabled and the dialog points to the withdrawal (`onWithdraw` opens it in
 * place; `withdrawPath` links to the goal's page instead). The backend still
 * rejects a non-empty goal with 409, shown here. `onConfirm` performs the
 * request and throws on failure.
 */
export default function GoalActionDialog({
  action,
  goal,
  onConfirm,
  onClose,
  onWithdraw,
  withdrawPath,
}) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const pendingRef = useRef(false);
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState("");

  const isBlocked = action === "archive" && getGoalActions(goal).mustWithdrawFirst;
  const savedAmount = getGoalProgress(goal)?.saved_amount;
  const prefix = `dashboard.savingsGoals.actionDialog.${action}`;

  const close = () => {
    if (!pendingRef.current) onClose();
  };

  const handleConfirm = async () => {
    if (pendingRef.current || isBlocked) return;

    pendingRef.current = true;
    setIsRunning(true);
    setMessage("");

    try {
      await onConfirm();
    } catch (error) {
      // 401 is handled by apiClient's session-expired flow.
      if (error?.code !== "UNAUTHENTICATED") {
        setMessage(getGoalErrorMessage(error, t, action));
      }
    } finally {
      pendingRef.current = false;
      setIsRunning(false);
    }
  };

  return (
    <div
      className="account-form-modal"
      role="presentation"
      onMouseDown={close}
      onKeyDown={(event) => event.key === "Escape" && close()}
    >
      <section
        className="account-form-modal__dialog goal-action-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="goal-action-title"
        aria-describedby="goal-action-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="goal-action-title" dir="auto">
            {t(`${prefix}.title`, { name: goal.name })}
          </h2>
          <button type="button" onClick={close} disabled={isRunning} aria-label={t("common.close")}>
            ×
          </button>
        </header>

        <div id="goal-action-description" className="goal-action-dialog__body">
          <p>{t(`${prefix}.description`)}</p>

          <ul>
            {POINTS[action].map((point) => (
              <li key={point}>{t(`${prefix}.${point}`)}</li>
            ))}
          </ul>
        </div>

        {isBlocked && (
          <div className="goal-action-dialog__blocked" role="note">
            <LuTriangleAlert aria-hidden="true" />
            <div>
              <p>
                {t("dashboard.savingsGoals.actionDialog.archive.hasBalance", {
                  amount: formatMoney(savedAmount, getGoalCurrency(goal), locale),
                })}
              </p>
              {onWithdraw && (
                <button type="button" onClick={onWithdraw}>
                  {t("dashboard.savingsGoals.actions.withdraw")}
                </button>
              )}
              {!onWithdraw && withdrawPath && (
                <Link to={withdrawPath}>{t("dashboard.savingsGoals.actionDialog.archive.openGoal")}</Link>
              )}
            </div>
          </div>
        )}

        {message && (
          <div className="account-form-modal__error goal-action-dialog__error" role="alert">
            <p dir="auto">{message}</p>
          </div>
        )}

        <footer>
          <button type="button" onClick={close} disabled={isRunning} autoFocus>
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            onClick={handleConfirm}
            disabled={isRunning || isBlocked}
            aria-busy={isRunning || undefined}
          >
            {t(isRunning ? `${prefix}.running` : `${prefix}.confirm`)}
          </button>
        </footer>
      </section>
    </div>
  );
}
