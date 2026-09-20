import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCircleCheck, LuTriangleAlert } from "react-icons/lu";

import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { importsApi } from "../../../api/importsApi";
import { ApiError } from "../../../api/apiClient";
import { createIdempotentAttempt } from "../../../FinancialOperations/transactionHelpers";
import {
  getImportErrorMessage,
  getImportableCount,
  isImportLifecycleConflict,
  parseImportResponse,
} from "../../importHelpers";
import ImportPanel from "../ImportPanel/ImportPanel";

import "./ImportConfirm.css";

/*
 * Step 5: POST /imports/{id}/confirm — the point where reviewed rows become
 * real transactions.
 *
 * Idempotency: one attempt object lives for the life of this component, so a
 * retry after a timeout or a double click reuses the same `Idempotency-Key`
 * and the import can never post twice. `settle` clears the key only when the
 * backend gave a definitive answer; an unknown outcome (timeout, network,
 * 5xx) keeps it.
 *
 * The response may be 202 with the import still `confirmed` or `processing`.
 * This component never decides that an import completed: it hands the
 * returned import back and the outcome screen polls until it is final.
 *
 * Nothing here touches account balances, budgets or transaction lists — the
 * backend owns the financial state.
 */
export default function ImportConfirm({ importRecord, onConfirmed, onBack }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const number = new Intl.NumberFormat(locale);
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirm, setConfirm] = useState({ pending: false, error: null });
  const pendingRef = useRef(false);
  // One logical confirmation attempt per mounted import.
  const attemptRef = useRef(null);
  attemptRef.current ??= createIdempotentAttempt("import-confirm");

  const counts = importRecord.counts ?? {};
  const importable = getImportableCount(importRecord);
  const skipped = ["invalid", "duplicate", "ignored"].filter((key) => Number(counts[key]) > 0);

  const handleConfirm = async () => {
    if (pendingRef.current || !acknowledged) return;

    pendingRef.current = true;
    setConfirm({ pending: true, error: null });

    // Same import, same attempt: one key for every retry of this intent.
    const idempotencyKey = attemptRef.current.keyFor({ import: importRecord.id });

    try {
      const confirmed = parseImportResponse(await importsApi.confirm(importRecord.id, { idempotencyKey }));
      if (!confirmed) throw new ApiError("", { code: "MALFORMED_RESPONSE" });

      attemptRef.current.settle(null);
      setConfirm({ pending: false, error: null });
      onConfirmed(confirmed);
    } catch (error) {
      attemptRef.current.settle(error);
      setConfirm({ pending: false, error });

      /*
       * 409 "already confirmed": the backend has it. Never send a second
       * confirmation and never mint a fresh key — read the real state back.
       */
      if (isImportLifecycleConflict(error)) {
        importsApi
          .get(importRecord.id)
          .then((response) => {
            const current = response?.data?.import;
            if (current?.id != null) onConfirmed(current);
          })
          .catch(() => {});
      }
    } finally {
      pendingRef.current = false;
    }
  };

  return (
    <ImportPanel title={t("dashboard.importPage.confirm.title")} hint={t("dashboard.importPage.confirm.hint")}>
      <div className="import-confirm__warning" role="note">
        <LuTriangleAlert aria-hidden="true" />
        <div>
          <p className="import-confirm__warning-title">{t("dashboard.importPage.confirm.moneyTitle")}</p>
          <p>{t("dashboard.importPage.confirm.moneyBody")}</p>
        </div>
      </div>

      <dl className="import-confirm__counts">
        <div className="import-confirm__count import-confirm__count--primary">
          <dt>{t("dashboard.importPage.confirm.willImport")}</dt>
          <dd>
            <bdi dir="ltr">{number.format(importable)}</bdi>
          </dd>
        </div>
        {skipped.map((key) => (
          <div key={key} className="import-confirm__count">
            <dt>{t(`dashboard.importPage.confirm.willSkip.${key}`)}</dt>
            <dd>
              <bdi dir="ltr">{number.format(Number(counts[key]) || 0)}</bdi>
            </dd>
          </div>
        ))}
      </dl>

      {skipped.length > 0 && <p className="import-confirm__note">{t("dashboard.importPage.confirm.skipNote")}</p>}

      <label className="import-confirm__acknowledge">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
          disabled={confirm.pending}
        />
        <span>{t("dashboard.importPage.confirm.acknowledge", { count: importable })}</span>
      </label>

      {confirm.error && (
        <div className="import-panel__alert" role="alert">
          <p>{getImportErrorMessage(confirm.error, t, "confirm")}</p>
          {isImportLifecycleConflict(confirm.error) && <p>{t("dashboard.importPage.confirm.conflictHint")}</p>}
        </div>
      )}

      <div className="import-confirm__actions">
        <button
          type="button"
          className="import-confirm__submit"
          onClick={handleConfirm}
          disabled={!acknowledged || confirm.pending || importable === 0}
          aria-busy={confirm.pending}
        >
          <LuCircleCheck aria-hidden="true" />
          {confirm.pending ? t("dashboard.importPage.confirm.submitting") : t("dashboard.importPage.confirm.submit")}
        </button>
        {onBack && (
          <button type="button" className="import-panel__secondary" onClick={onBack} disabled={confirm.pending}>
            {t("dashboard.importPage.confirm.backToReview")}
          </button>
        )}
      </div>
    </ImportPanel>
  );
}
