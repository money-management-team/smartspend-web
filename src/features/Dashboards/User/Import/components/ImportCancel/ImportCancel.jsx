import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuTrash2 } from "react-icons/lu";

import { ApiError } from "../../../api/apiClient";
import { importsApi } from "../../../api/importsApi";
import { getImportErrorMessage, isImportLifecycleConflict, parseImportResponse } from "../../importHelpers";

import "./ImportCancel.css";

/*
 * POST /imports/{id}/cancel — abandons an import that was never confirmed.
 *
 * Nothing financial has happened yet, so there is nothing to undo: the stored
 * file is dropped and the import becomes `cancelled`. It is only ever offered
 * while `canCancelImport` is true; a confirmed import is undone with Reverse,
 * never with this. No idempotency key: cancelling twice is harmless and moves
 * no money.
 *
 * Confirms inline first, in the same style as the export actions.
 */
export default function ImportCancel({ importRecord, onCancelled }) {
  const { t } = useTranslation();
  const [state, setState] = useState({ confirming: false, pending: false, error: null });
  const pendingRef = useRef(false);

  const handleCancel = async () => {
    if (pendingRef.current) return;

    pendingRef.current = true;
    setState({ confirming: true, pending: true, error: null });

    try {
      const cancelled = parseImportResponse(await importsApi.cancel(importRecord.id));
      if (!cancelled) throw new ApiError("", { code: "MALFORMED_RESPONSE" });

      setState({ confirming: false, pending: false, error: null });
      onCancelled(cancelled);
    } catch (error) {
      setState({ confirming: false, pending: false, error });

      // It moved on meanwhile (e.g. it was confirmed): show its real state.
      if (isImportLifecycleConflict(error)) {
        importsApi
          .get(importRecord.id)
          .then((response) => {
            const current = response?.data?.import;
            if (current?.id != null) onCancelled(current);
          })
          .catch(() => {});
      }
    } finally {
      pendingRef.current = false;
    }
  };

  if (!state.confirming) {
    return (
      <>
        <button
          type="button"
          className="import-cancel__open"
          onClick={() => setState({ confirming: true, pending: false, error: null })}
        >
          <LuTrash2 aria-hidden="true" />
          {t("dashboard.importPage.cancel.action")}
        </button>
        {state.error && (
          <p className="import-cancel__error" role="alert">
            {getImportErrorMessage(state.error, t, "cancel")}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="import-cancel" role="group" aria-label={t("dashboard.importPage.cancel.action")}>
      <p>{t("dashboard.importPage.cancel.confirm")}</p>
      <div className="import-cancel__buttons">
        <button type="button" className="import-cancel__danger" onClick={handleCancel} disabled={state.pending}>
          {state.pending ? t("dashboard.importPage.cancel.cancelling") : t("dashboard.importPage.cancel.confirmAction")}
        </button>
        <button
          type="button"
          className="import-cancel__keep"
          onClick={() => setState({ confirming: false, pending: false, error: null })}
          disabled={state.pending}
        >
          {t("dashboard.importPage.cancel.keep")}
        </button>
      </div>
    </div>
  );
}
