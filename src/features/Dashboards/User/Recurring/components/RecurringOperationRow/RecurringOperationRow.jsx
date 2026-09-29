import { createElement } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  LuArchive,
  LuArrowDownRight,
  LuArrowUpRight,
  LuPause,
  LuPencil,
  LuPlay,
} from "react-icons/lu";

import { getRecurringDetailsPath } from "../../../../../../routes/Path";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { translateEnum } from "../../../FinancialOperations/transactionHelpers";
import { getAccountLabel } from "../../../Transfers/transferHelpers";
import { formatDate, formatMoney } from "../../../utils/formatters";
import RecurringBadge from "../RecurringBadge/RecurringBadge";
import {
  getRuleActions,
  getRuleCurrency,
  getRuleStatus,
  getRuleType,
  getSchedule,
  isOverdueOccurrence,
} from "../../recurringHelpers";

import "./RecurringOperationRow.css";

/*
 * One recurring rule in the list: name (link to its page), category ·
 * account · frequency, next due date (with the backend's overdue flag and
 * next occurrence status when the row carries a schedule), status and
 * processing mode, the rule's amount, and the actions its status allows.
 * "Confirm" posts money, so it only opens the confirmation dialog.
 */
export default function RecurringOperationRow({ rule, onConfirm, onEdit, onPause, onResume, onArchive }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const type = getRuleType(rule);
  const status = getRuleStatus(rule);
  const actions = getRuleActions(rule);
  const { next } = getSchedule(rule);
  const dueDate = next?.due_date ?? rule.next_due_date;
  const interval = Number(rule.interval) || 1;
  const frequency = ["weekly", "monthly", "yearly"].includes(rule.frequency)
    ? t(`dashboard.recurring.every.${rule.frequency}`, { count: interval })
    : translateEnum(t, i18n, "dashboard.recurring.frequencies", rule.frequency);

  return (
    <article className={`recurring-row recurring-row--${status}`}>
      <span className={`recurring-row__trend recurring-row__trend--${type}`} aria-hidden="true">
        {createElement(type === "income" ? LuArrowUpRight : LuArrowDownRight)}
      </span>

      <div className="recurring-row__copy">
        <Link to={getRecurringDetailsPath(rule.id)} className="recurring-row__name" dir="auto">
          {rule.name || `#${rule.id}`}
        </Link>

        <span className="recurring-row__meta">
          {[rule.category?.name, getAccountLabel(rule.account, rule.account_id), frequency]
            .filter(Boolean)
            .join(" · ")}
        </span>

        <span className="recurring-row__badges">
          <RecurringBadge kind="status" value={rule.status} />
          <RecurringBadge kind="mode" value={rule.processing_mode} />
          {next?.status && <RecurringBadge kind="occurrence" value={next.status} />}
          {isOverdueOccurrence(next) && <RecurringBadge kind="overdue" />}
        </span>

        {dueDate && status !== "archived" && status !== "completed" && (
          <span className={`recurring-row__next${isOverdueOccurrence(next) ? " recurring-row__next--overdue" : ""}`}>
            {t("dashboard.recurring.nextDue", { date: formatDate(dueDate, locale) })}
          </span>
        )}
      </div>

      <strong className={`recurring-row__amount recurring-row__amount--${type}`}>
        <bdi>
          {type === "income" ? "+" : type === "expense" ? "-" : ""}
          {formatMoney(rule.amount, getRuleCurrency(rule) || undefined, locale)}
        </bdi>
      </strong>

      {actions.canConfirm ? (
        <button type="button" className="recurring-row__confirm" onClick={onConfirm}>
          {t(type === "income" ? "dashboard.recurring.actions.confirmIncome" : "dashboard.recurring.actions.confirmExpense")}
        </button>
      ) : (
        <span className="recurring-row__confirm-placeholder" aria-hidden="true" />
      )}

      <div className="recurring-row__actions">
        {actions.canEdit && (
          <button type="button" onClick={onEdit} aria-label={t("dashboard.recurring.actions.editNamed", { name: rule.name })} title={t("dashboard.recurring.actions.edit")}>
            <LuPencil aria-hidden="true" />
          </button>
        )}
        {actions.canPause && (
          <button type="button" onClick={onPause} aria-label={t("dashboard.recurring.actions.pauseNamed", { name: rule.name })} title={t("dashboard.recurring.actions.pause")}>
            <LuPause aria-hidden="true" />
          </button>
        )}
        {actions.canResume && (
          <button type="button" onClick={onResume} aria-label={t("dashboard.recurring.actions.resumeNamed", { name: rule.name })} title={t("dashboard.recurring.actions.resume")}>
            <LuPlay aria-hidden="true" />
          </button>
        )}
        {actions.canArchive && (
          <button
            type="button"
            className="recurring-row__archive"
            onClick={onArchive}
            aria-label={t("dashboard.recurring.actions.archiveNamed", { name: rule.name })}
            title={t("dashboard.recurring.actions.archive")}
          >
            <LuArchive aria-hidden="true" />
          </button>
        )}
      </div>
    </article>
  );
}
