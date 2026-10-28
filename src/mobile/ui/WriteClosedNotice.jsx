import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import Chevron from "./Chevron.jsx";

/*
 * In place of an action whose write is closed (data/writeGate.js): what it is,
 * why Mobile does not send it, and the full-version page that does. It is a note,
 * not an error, and it has no button that could send anything.
 */
export default function WriteClosedNotice({ operation, fullPath, compact = false }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);

  return (
    <div className={compact ? "sm-closed sm-closed-compact" : "sm-card sm-closed"} role="note" data-sm-note="write-closed" data-sm-write={operation}>
      {!compact && <h2 className="sm-card-title">{t("writes.closedTitle")}</h2>}
      <p className="sm-text sm-muted">{t("writes.closedBody")}</p>
      {fullPath && (
        <Link className="sm-link-row" to={fullPath}>
          <span>{t("writes.openFull")}</span>
          <Chevron />
        </Link>
      )}
    </div>
  );
}
