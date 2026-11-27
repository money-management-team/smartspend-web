import { useTranslation } from "react-i18next";

import { MOBILE_NAMESPACE } from "../i18n/messages.js";

/*
 * A transaction's status as the backend reports it. The five known values have
 * a translated label; anything else is shown as sent ("Unknown status: x"), not
 * mapped to the nearest known one. Posted is the only success state (and the
 * only one that may be green); the others are never dressed as success.
 */
export default function StatusChip({ status, known }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  if (!status) return <span className="sm-chip sm-status" data-sm-status="missing">{t("status.missing")}</span>;

  const label = known ? t(`status.${status}`) : t("status.unknown", { status: String(status).replace(/_/g, " ").slice(0, 40) });

  return <span className="sm-chip sm-status" data-sm-status={known ? status : "unknown"}>{label}</span>;
}
