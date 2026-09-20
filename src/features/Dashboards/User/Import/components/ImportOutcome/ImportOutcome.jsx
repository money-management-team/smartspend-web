import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LuCircleCheck, LuCircleX, LuLoaderCircle, LuUndo2 } from "react-icons/lu";

import { PATH } from "../../../../../../routes/Path";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import {
  canReverseImport,
  getImportErrorMessage,
  isImportInFlight,
} from "../../importHelpers";
import { useImportStatus } from "../../useImportStatus";
import ImportPanel from "../ImportPanel/ImportPanel";
import ImportReverse from "../ImportReverse/ImportReverse";

import "./ImportOutcome.css";

const ICONS = {
  processing: LuLoaderCircle,
  completed: LuCircleCheck,
  failed: LuCircleX,
  cancelled: LuCircleX,
  reversed: LuUndo2,
};

// Which of the five outcome faces a status wears.
const faceFor = (status) => {
  if (status === "confirmed" || status === "processing" || status === "validating") return "processing";
  if (["completed", "failed", "cancelled", "reversed"].includes(status)) return status;
  return "processing";
};

/*
 * The end of the wizard: what confirmation actually did.
 *
 * Confirmation may answer 202 with the import still `confirmed` or
 * `processing`, so this screen polls GET /imports/{id} until the import is
 * final and shows whatever the backend reports — it never decides an import
 * completed on its own, and never adjusts balances or transaction lists to
 * match. Whatever the backend says is the financial truth.
 *
 * A completed import can be reversed from here; a cancelled or reversed one
 * is read-only.
 */
export default function ImportOutcome({ importRecord, onImportChange }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const number = new Intl.NumberFormat(locale);
  const { record, replace, isPolling, pollError, gaveUp, checkAgain } = useImportStatus(importRecord);

  // Keep the page (and its summary card) on the backend's latest import.
  useEffect(() => {
    onImportChange(record);
  }, [record, onImportChange]);

  const face = faceFor(record.status);
  const Icon = ICONS[face] ?? LuLoaderCircle;
  const counts = record.counts ?? {};
  const isBusy = isImportInFlight(record);

  return (
    <ImportPanel
      title={t(`dashboard.importPage.outcome.${face}.title`)}
      hint={t(`dashboard.importPage.outcome.${face}.hint`)}
    >
      <div className={`import-outcome import-outcome--${face}`}>
        <Icon className={`import-outcome__icon${isBusy ? " import-outcome__icon--spin" : ""}`} aria-hidden="true" />
        <div className="import-outcome__text">
          <p className="import-outcome__status" aria-live="polite">
            {t(`dashboard.importPage.statuses.${record.status}`, { defaultValue: record.status ?? "—" })}
          </p>
          {isBusy && <p className="import-outcome__note">{t("dashboard.importPage.outcome.processing.note")}</p>}
        </div>
      </div>

      {["imported", "failed", "ignored"].some((key) => Number(counts[key]) > 0) && (
        <dl className="import-outcome__counts">
          {["imported", "failed", "ignored"]
            .filter((key) => counts[key] != null)
            .map((key) => (
              <div key={key}>
                <dt>{t(`dashboard.importPage.counts.${key}`)}</dt>
                <dd>
                  <bdi dir="ltr">{number.format(Number(counts[key]) || 0)}</bdi>
                </dd>
              </div>
            ))}
        </dl>
      )}

      {record.failure_reason && (
        <p className="import-outcome__failure" dir="auto">
          {record.failure_reason}
        </p>
      )}

      {record.reversal_reason && (
        <p className="import-outcome__failure" dir="auto">
          {t("dashboard.importPage.reverse.reasonGiven", { reason: record.reversal_reason })}
        </p>
      )}

      {pollError && (
        <div className="import-panel__alert" role="alert">
          <p>{getImportErrorMessage(pollError, t, "resume")}</p>
        </div>
      )}

      {gaveUp && (
        <div className="import-outcome__gaveup">
          <p>{t("dashboard.importPage.outcome.stillWorking")}</p>
          <button type="button" className="import-panel__secondary" onClick={checkAgain}>
            {t("dashboard.importPage.outcome.checkAgain")}
          </button>
        </div>
      )}

      <div className="import-outcome__actions">
        {canReverseImport(record) && <ImportReverse importRecord={record} onReversed={replace} />}
        <Link to={PATH.USER.IMPORT_HISTORY} className="import-panel__secondary import-outcome__link">
          {t("dashboard.importPage.history.title")}
        </Link>
        {!isPolling && (
          <Link to={PATH.USER.IMPORT} className="import-panel__secondary import-outcome__link">
            {t("dashboard.importPage.actions.newImport")}
          </Link>
        )}
      </div>
    </ImportPanel>
  );
}
