import { useTranslation } from "react-i18next";

import { translateEnum } from "../../transactionHelpers";

import "./TransactionStatusBadge.css";

const TONES = {
  posted: "success",
  reversed: "warning",
  pending: "info",
  pending_review: "info",
  draft: "neutral",
  failed: "danger",
};

// `labelsKey` lets another ledger record (e.g. a transfer, whose statuses
// include `pending`) use its own translated labels with the same tones.
export default function TransactionStatusBadge({
  status,
  labelsKey = "dashboard.transactions.statuses",
}) {
  const { t, i18n } = useTranslation();

  if (!status) return null;

  return (
    <span
      className={`transaction-status-badge transaction-status-badge--${TONES[status] ?? "neutral"}`}
    >
      {translateEnum(t, i18n, labelsKey, status)}
    </span>
  );
}
