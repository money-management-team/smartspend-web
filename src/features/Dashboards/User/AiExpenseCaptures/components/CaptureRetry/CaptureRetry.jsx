import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuRefreshCw, LuRotateCcw, LuTriangleAlert } from "react-icons/lu";

import { getApiErrorMessage } from "../../../api/apiClient";
import { canRetryCapture, isUncertainOutcome } from "../../captureHelpers";

import "./CaptureRetry.css";

/*
 * Asks the backend to run the AI over a failed receipt again
 * (POST /ai/expense-captures/{id}/retry).
 *
 * Rendered only when `canRetryCapture(status)` — that is, `failed`. Every
 * other status gets nothing at all, so no button ever offers an action the
 * backend would refuse.
 *
 * Retry requeues processing and moves no money: no transaction, no ledger
 * entry, no balance change, and no edit to the reviewed draft. On success the
 * backend answers with the new status (`queued`), the parent applies it, and
 * this section disappears because the capture is no longer failed.
 *
 * `onRetry()` performs the request and throws on failure; `onRefreshStatus()`
 * refetches the capture, which is the honest way out of an uncertain result.
 */
export default function CaptureRetry({
  status,
  onRetry,
  onRefreshStatus,
  // Another write is in flight: the page's shared action lock.
  isBusy = false,
  onBusyChange,
}) {
  const { t } = useTranslation();

  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState(null);
  /*
   * Synchronous guard: a double click fires twice before React re-renders, and
   * two concurrent POSTs would be two requeue requests for the same capture.
   */
  const pendingRef = useRef(false);

  if (!canRetryCapture(status)) return null;

  const retry = async () => {
    if (pendingRef.current) return;

    pendingRef.current = true;
    setIsRetrying(true);
    onBusyChange?.(true);
    setError(null);

    try {
      await onRetry();
    } catch (requestError) {
      // 401 is the global session-expired flow; nothing to show here. A 422
      // is handled by the parent, which refetches the real state once.
      if (requestError?.code !== "UNAUTHENTICATED") setError(requestError);
    } finally {
      pendingRef.current = false;
      setIsRetrying(false);
      onBusyChange?.(false);
    }
  };

  const isForbidden = error?.code === "FORBIDDEN";
  /*
   * A timeout, a dropped connection or a 5xx: the backend may or may not have
   * queued the capture. Nothing claims it did, and the way forward is a GET
   * rather than a second POST.
   */
  const isUncertain = isUncertainOutcome(error);

  return (
    <section className="capture-retry" aria-labelledby="capture-retry-title">
      <header className="capture-retry__header">
        <h2 id="capture-retry-title">
          <LuTriangleAlert aria-hidden="true" />
          {t("dashboard.aiCaptures.retry.title")}
        </h2>
        <p>{t("dashboard.aiCaptures.retry.description")}</p>
      </header>

      {error && (
        <div className="capture-retry__error" role="alert">
          <p dir="auto">
            {isForbidden
              ? t("dashboard.aiCaptures.details.forbiddenMessage")
              : `${t("dashboard.aiCaptures.retry.failed")} ${getApiErrorMessage(error, t)}`}
          </p>

          {isUncertain && <p>{t("dashboard.aiCaptures.retry.uncertain")}</p>}

          {/*
            * Offered whenever the outcome is unknown: reading the current
            * status is safer than sending another retry blind. A 403 gets no
            * action at all — it will not change on a second attempt.
            */}
          {isUncertain && (
            <button type="button" className="capture-retry__refresh" onClick={onRefreshStatus}>
              <LuRefreshCw aria-hidden="true" />
              {t("dashboard.aiCaptures.processing.refresh")}
            </button>
          )}
        </div>
      )}

      {/*
        * Nothing here retries by itself: a rate limit, a server error or a
        * refusal all wait for the user to press the button again.
        */}
      {!isForbidden && (
        <button
          type="button"
          className="capture-retry__action"
          onClick={retry}
          disabled={isRetrying || isBusy}
        >
          <LuRotateCcw aria-hidden="true" />
          {t(
            isRetrying
              ? "dashboard.aiCaptures.retry.retrying"
              : "dashboard.aiCaptures.retry.action",
          )}
        </button>
      )}

      {/* Announced rather than shown only as a disabled button. */}
      <p className="capture-retry__status" role="status">
        {isRetrying ? t("dashboard.aiCaptures.retry.retrying") : ""}
      </p>
    </section>
  );
}
