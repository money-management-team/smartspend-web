import { useTranslation } from "react-i18next";
import { LuLoaderCircle } from "react-icons/lu";

import { getExportStatus, isActiveExport } from "../../reportExportHelpers";

import "./ExportStatusBadge.css";

export default function ExportStatusBadge({ record }) {
  const { t } = useTranslation();
  const status = getExportStatus(record);

  return (
    <span className={`export-status export-status--${status}`}>
      {isActiveExport(record) && <LuLoaderCircle className="export-status__spinner" aria-hidden="true" />}
      {status === "unknown" ? String(record?.status ?? "—") : t(`dashboard.reportExports.statuses.${status}`)}
    </span>
  );
}
