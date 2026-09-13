import { useTranslation } from "react-i18next";

import { translateEnum } from "../../../FinancialOperations/transactionHelpers";

import "./RecurringBadge.css";

// Translation prefix of each badge kind.
const PREFIXES = {
  status: "dashboard.recurring.statuses",
  mode: "dashboard.recurring.processingModes",
  occurrence: "dashboard.recurring.occurrenceStatuses",
};

/*
 * `kind`: "status" (rule status), "mode" (processing mode), "occurrence"
 * (occurrence status) or "overdue" (the backend's `is_overdue` flag).
 */
export default function RecurringBadge({ kind, value }) {
  const { t, i18n } = useTranslation();

  if (kind === "overdue") {
    return <span className="recurring-badge recurring-badge--overdue">{t("dashboard.recurring.overdue")}</span>;
  }

  if (!value) return null;

  return (
    <span className={`recurring-badge recurring-badge--${kind} recurring-badge--${kind}-${value}`}>
      {translateEnum(t, i18n, PREFIXES[kind], value)}
    </span>
  );
}
