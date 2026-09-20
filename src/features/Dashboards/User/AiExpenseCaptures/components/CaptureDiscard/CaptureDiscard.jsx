import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuTrash2, LuTriangleAlert } from "react-icons/lu";

import { getApiErrorMessage } from "../../../api/apiClient";
import {
  canDiscardCapture,
  getCaptureStatus,
  isCaptureDiscarded,
  isUncertainOutcome,
} from "../../captureHelpers";

// The same modal shell the other dashboard dialogs use.
import "../../../Accounts/components/AccountForm/AccountForm.css";
import "./CaptureDiscard.css";

/*
 * DELETE /ai/expense-captures/{id} — the user abandons an AI draft.
 *
 * This is not a financial action. It creates nothing and undoes nothing: no
 * transaction is deleted or reversed, no ledger entry is removed, no balance
 * and no budget change. There is nothing to undo, because a capture creates
 * none of that until it is confirmed.
 *
 * Which is exactly why a `confirmed` capture can never reach this component:
 * `canDiscardCapture` covers `uploaded`, `queued`, `ready_for_review` and
 * `failed` only. `processing` is excluded too — the backend is mid-flight,
 * and the UI waits rather than racing it.
 *
 * Unsaved review edits are deliberately NOT saved first. Discard and Confirm
 * have opposite intent, and saving a draft the user is abandoning would be
 * the wrong reading of the click.
 *
 * `onDiscard()` performs the request and throws on failure;
 * `onCheckStatus()` re-reads the capture, which is the only safe answer to an
 * outcome nobody knows.
 */
export default function CaptureDiscard({
  capture,
  hasUnsavedChanges = false,
  isBusy = false,
  onDiscard,
  onCheckStatus,
  onBusyChange,
}) {
  const { t } = useTranslation();

  const [isOpen, setIsOpen] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState(null);
  /*
   * The outcome is genuinely unknown: the request never came back, so the
   * capture may or may not have been discarded. Nothing here says it failed.
   */
  const [isUncertain, setIsUncertain] = useState(false);
  // Synchronous guard: a double click fires twice before React re-renders.
  const pendingRef = useRef(false);

  const status = getCaptureStatus(capture);

  if (!canDiscardCapture(status)) return null;

  const close = () => {
    if (pendingRef.current) return;
    setIsOpen(false);
    setError(null);
    setIsUncertain(false);
  };

  const discard = async () => {
    if (pendingRef.current) return;

    pendingRef.current = true;
    setIsDiscarding(true);
    onBusyChange?.(true);
    setError(null);

    try {
      await onDiscard();
      // The capture is discarded now, so this whole section unmounts.
      setIsUncertain(false);
      setIsOpen(false);
    } catch (requestError) {
      // 401 is the global session-expired flow; nothing to show here.
      if (requestError?.code === "UNAUTHENTICATED") return;

      setError(requestError);

      /*
       * A timeout, a dropped connection or a 5xx leaves the outcome in doubt.
       * One read — never another DELETE — to find out what the backend holds.
       * If that read is inconclusive the uncertain state stays on screen with
       * the check offered manually.
       */
      if (isUncertainOutcome(requestError)) {
        setIsUncertain(true);
        const fresh = await onCheckStatus().catch(() => null);
        if (fresh && isCaptureDiscarded(fresh)) setIsUncertain(false);
      }
    } finally {
      pendingRef.current = false;
      setIsDiscarding(false);
      onBusyChange?.(false);
    }
  };

  const checkStatus = async () => {
    if (pendingRef.current || isChecking) return;

    setIsChecking(true);

    try {
      // A read, and only a read. It can never discard anything.
      const fresh = await onCheckStatus();
      if (fresh && isCaptureDiscarded(fresh)) setIsUncertain(false);
    } catch {
      // The capture stays as it was; the uncertain state remains honest.
    } finally {
      setIsChecking(false);
    }
  };

  const isForbidden = error?.code === "FORBIDDEN";
  const isNotFound = error?.code === "NOT_FOUND";
  /*
   * A 422 on a request with no body can only be about the capture's own
   * state. The page answers it with one read and re-renders the real status,
   * so this dialog is on its way out; the message explains why.
   */
  const isLifecycle = error?.code === "VALIDATION_ERROR";

  const errorMessage = isForbidden
    ? t("dashboard.aiCaptures.details.forbiddenMessage")
    : isNotFound
      ? t("dashboard.aiCaptures.details.notFoundMessage")
      : isLifecycle
        ? t("dashboard.aiCaptures.discard.lifecycle")
        : `${t("dashboard.aiCaptures.discard.failed")} ${getApiErrorMessage(error, t)}`;

  return (
    <section className="capture-discard" aria-labelledby="capture-discard-title">
      <header className="capture-discard__header">
        <h2 id="capture-discard-title">{t("dashboard.aiCaptures.discard.title")}</h2>
        <p>{t("dashboard.aiCaptures.discard.description")}</p>
      </header>

      <button
        type="button"
        className="capture-discard__open"
        onClick={() => setIsOpen(true)}
        disabled={isBusy || isDiscarding}
      >
        <LuTrash2 aria-hidden="true" />
        {t("dashboard.aiCaptures.discard.open")}
      </button>

      {isOpen && (
        <div
          className="account-form-modal"
          role="presentation"
          onMouseDown={close}
          onKeyDown={(event) => event.key === "Escape" && close()}
        >
          <section
            className="account-form-modal__dialog capture-discard__dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="capture-discard-dialog-title"
            aria-describedby="capture-discard-dialog-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <h2 id="capture-discard-dialog-title">
                {t("dashboard.aiCaptures.discard.dialogTitle")}
              </h2>
              <button
                type="button"
                onClick={close}
                disabled={isDiscarding}
                aria-label={t("common.close")}
              >
                ×
              </button>
            </header>

            <div id="capture-discard-dialog-description" className="capture-discard__body">
              <p>{t("dashboard.aiCaptures.discard.question")}</p>

              <ul>
                <li>{t("dashboard.aiCaptures.discard.effects.draft")}</li>
                <li>{t("dashboard.aiCaptures.discard.effects.noExpense")}</li>
                {/*
                  * Defensive clarity. The button cannot appear on a confirmed
                  * capture, so this can never be the thing that happens — it
                  * is said anyway, because "discard" must not be read as
                  * "delete my expense".
                  */}
                <li>{t("dashboard.aiCaptures.discard.effects.keepsTransactions")}</li>
                <li>{t("dashboard.aiCaptures.discard.effects.auditable")}</li>
              </ul>

              {/*
                * Said plainly rather than quietly saved: discarding is the
                * opposite intent to confirming, so nothing is PATCHed first.
                */}
              {hasUnsavedChanges && (
                <p className="capture-discard__note" role="note">
                  {t("dashboard.aiCaptures.discard.unsaved")}
                </p>
              )}
            </div>

            {isUncertain && (
              <div className="capture-discard__uncertain" role="alert">
                <p>
                  <LuTriangleAlert aria-hidden="true" />
                  <span>{t("dashboard.aiCaptures.discard.uncertainTitle")}</span>
                </p>
                <p>{t("dashboard.aiCaptures.discard.uncertainBody")}</p>
              </div>
            )}

            {error && !isUncertain && (
              <div className="capture-discard__error" role="alert">
                <p dir="auto">{errorMessage}</p>
              </div>
            )}

            <footer className="capture-discard__actions">
              {/* After an unknown outcome the only safe step is a read. */}
              {isUncertain && (
                <button
                  type="button"
                  className="capture-discard__check"
                  onClick={checkStatus}
                  disabled={isChecking || isDiscarding}
                >
                  {t(
                    isChecking
                      ? "dashboard.aiCaptures.discard.checking"
                      : "dashboard.aiCaptures.discard.checkStatus",
                  )}
                </button>
              )}

              {/*
                * Nothing retries by itself, and a refusal that will not change
                * offers no button at all.
                */}
              {!isForbidden && !isNotFound && !isLifecycle && (
                <button
                  type="button"
                  className="capture-discard__submit"
                  onClick={discard}
                  disabled={isDiscarding || isChecking}
                  aria-busy={isDiscarding}
                >
                  <LuTrash2 aria-hidden="true" />
                  {t(
                    isDiscarding
                      ? "dashboard.aiCaptures.discard.discarding"
                      : isUncertain || error
                        ? "dashboard.aiCaptures.discard.retry"
                        : "dashboard.aiCaptures.discard.submit",
                  )}
                </button>
              )}

              <button
                type="button"
                className="capture-discard__cancel"
                onClick={close}
                disabled={isDiscarding}
              >
                {t("common.cancel")}
              </button>
            </footer>

            {/* Announced rather than conveyed by a disabled button alone. */}
            <p className="capture-discard__status" role="status">
              {isDiscarding
                ? t("dashboard.aiCaptures.discard.discarding")
                : isChecking
                  ? t("dashboard.aiCaptures.discard.checking")
                  : ""}
            </p>
          </section>
        </div>
      )}
    </section>
  );
}
