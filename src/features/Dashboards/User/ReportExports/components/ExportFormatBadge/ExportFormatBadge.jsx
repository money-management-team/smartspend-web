import { getFormatName, isExportFormat } from "../../reportExportHelpers";

import "./ExportFormatBadge.css";

// "CSV" / "XLSX" / "PDF" pill. Always left-to-right, also inside Arabic text.
export default function ExportFormatBadge({ format }) {
  const variant = isExportFormat(format) ? format : "other";

  return (
    <bdi dir="ltr" className={`export-format-badge export-format-badge--${variant}`}>
      {getFormatName(format)}
    </bdi>
  );
}
