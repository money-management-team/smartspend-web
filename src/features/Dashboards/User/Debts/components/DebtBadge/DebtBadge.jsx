import { createElement } from "react";
import { useTranslation } from "react-i18next";
import {
  LuArchive,
  LuArrowDownLeft,
  LuArrowUpRight,
  LuCircleCheck,
  LuTriangleAlert,
  LuUndo2,
} from "react-icons/lu";

import { translateEnum } from "../../../FinancialOperations/transactionHelpers";

import "./DebtBadge.css";

const ICONS = {
  status: {
    overdue: LuTriangleAlert,
    paid: LuCircleCheck,
    archived: LuArchive,
  },
  // payable: the money goes out of the user's hands when repaid; receivable:
  // it comes back to them.
  direction: {
    payable: LuArrowUpRight,
    receivable: LuArrowDownLeft,
  },
  payment: {
    posted: LuCircleCheck,
    reversed: LuUndo2,
  },
};

const PREFIX = {
  status: "dashboard.debts.status",
  direction: "dashboard.debts.directionShort",
  payment: "dashboard.debts.paymentStatus",
};

/*
 * One badge for a debt's direction (`kind="direction"`: payable / receivable,
 * shown as "I owe" / "Owed to me"), its state (`kind="status"`: pass the
 * backend's `effective_status`) or a payment's state (`kind="payment"`:
 * posted / reversed). Values are never derived here; unknown ones are shown
 * raw.
 */
export default function DebtBadge({ kind = "status", value }) {
  const { t, i18n } = useTranslation();

  if (!value) return null;

  const icon = ICONS[kind]?.[value];

  return (
    <span className={`debt-badge debt-badge--${kind}-${value}`}>
      {icon && createElement(icon, { "aria-hidden": "true" })}
      {translateEnum(t, i18n, PREFIX[kind], value)}
    </span>
  );
}
