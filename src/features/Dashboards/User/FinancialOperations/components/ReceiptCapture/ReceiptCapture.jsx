import { useRef, useState } from "react";
import { LuCamera, LuSparkles } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { getAiExpenseCapturePath } from "../../../../../../routes/Path";
import { ApiError, getApiErrorMessage } from "../../../api/apiClient";
import { aiExpenseCapturesApi } from "../../../api/aiExpenseCapturesApi";
import {
  CAPTURE_UPLOAD_MAX_BYTES,
  UPLOAD_ATTEMPT_PREFIX,
} from "../../../AiExpenseCaptures/captureConstants";
import {
  getCaptureUploadError,
  getUploadFingerprint,
  isMissingUploadRoute,
  parseCaptureResponse,
} from "../../../AiExpenseCaptures/captureHelpers";
import { createIdempotentAttempt } from "../../transactionHelpers";

import "./ReceiptCapture.css";

const MAX_MB = Math.round(CAPTURE_UPLOAD_MAX_BYTES / (1024 * 1024));

/*
 * Receipt capture: the entry point to the AI expense captures feature.
 *
 * Picking an image and pressing Analyze uploads it, which creates a capture
 * the backend's AI then reads. **Nothing is recorded by this**: the receipt
 * becomes a draft, and the expense exists only once the user reviews it and
 * confirms it on the capture's own page — which is where this navigates to.
 *
 * ⚠ The create endpoint is not part of the documented Sprint 7 contract; its
 * path, field name and response shape are assumptions held in
 * `captureConstants`. If the route isn't there the upload answers 404/405 and
 * this says the service isn't available, rather than blaming the file.
 */
export default function ReceiptCapture({ onSwitchToManual }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  // A local validation key, kept apart from a backend failure.
  const [fileError, setFileError] = useState("");
  /*
   * Synchronous guard: a double click fires twice before React re-renders,
   * and two uploads would be two captures of the same receipt.
   */
  const pendingRef = useRef(false);
  /*
   * One key per chosen file, so retrying after a timeout replays that upload
   * instead of creating a second capture. A different file is a new upload.
   */
  const [attempt] = useState(() => createIdempotentAttempt(UPLOAD_ATTEMPT_PREFIX));

  const pick = () => {
    if (isUploading) return;
    inputRef.current?.click();
  };

  const handleChange = (event) => {
    const [selected] = event.target.files ?? [];
    if (!selected) return;

    setFile(selected);
    setError(null);
    setFileError(getCaptureUploadError(selected) ?? "");
  };

  const analyze = async () => {
    if (pendingRef.current) return;

    if (!file) {
      inputRef.current?.click();
      return;
    }

    const invalid = getCaptureUploadError(file);
    if (invalid) {
      setFileError(invalid);
      return;
    }

    pendingRef.current = true;
    setIsUploading(true);
    setError(null);

    try {
      const response = await aiExpenseCapturesApi.create(file, {
        idempotencyKey: attempt.keyFor(getUploadFingerprint(file)),
      });
      const capture = parseCaptureResponse(response);

      if (!capture) throw new ApiError("", { code: "MALFORMED_RESPONSE" });

      attempt.settle();
      /*
       * Straight to the capture's own page: the status the backend gave is
       * shown there, and its poller follows the receipt through processing to
       * `ready_for_review` on its own. No status is assumed here.
       */
      navigate(getAiExpenseCapturePath(capture.id));
    } catch (requestError) {
      attempt.settle(requestError);
      // 401 is the global session-expired flow; nothing to show here.
      if (requestError?.code !== "UNAUTHENTICATED") setError(requestError);
    } finally {
      pendingRef.current = false;
      setIsUploading(false);
    }
  };

  const isUnavailable = isMissingUploadRoute(error);

  return (
    <div className="capture-panel receipt-capture">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      <div
        className={
          file ? "receipt-capture__surface receipt-capture__surface--filled" : "receipt-capture__surface"
        }
      >
        <span className="receipt-capture__visual" aria-hidden="true">
          <LuCamera />
        </span>

        <div className="receipt-capture__copy">
          <span className="capture-panel__kicker">
            {t("dashboard.financialOperations.scan.kicker")}
          </span>

          <h3 dir="auto">
            {file ? file.name : t("dashboard.financialOperations.scan.title")}
          </h3>

          <p>{t("dashboard.financialOperations.scan.description")}</p>
        </div>

        <button
          type="button"
          className="capture-action capture-action--soft"
          onClick={pick}
          disabled={isUploading}
        >
          {t("dashboard.financialOperations.scan.choose")}
        </button>
      </div>

      {fileError && (
        <p className="receipt-capture__error" role="alert">
          {t(`dashboard.financialOperations.scan.validation.${fileError}`, { max: MAX_MB })}
        </p>
      )}

      {error && (
        <div className="capture-notice" role="alert">
          <p dir="auto">
            {isUnavailable
              ? t("dashboard.financialOperations.scan.unavailable")
              : `${t("dashboard.financialOperations.scan.failed")} ${getApiErrorMessage(error, t)}`}
          </p>

          {/* Manual entry is always one click away, whatever went wrong. */}
          <button type="button" onClick={onSwitchToManual}>
            {t("dashboard.financialOperations.voice.fallback")}
          </button>
        </div>
      )}

      <button
        type="button"
        className="capture-action receipt-capture__analyze"
        onClick={analyze}
        disabled={isUploading || Boolean(fileError)}
        aria-busy={isUploading}
      >
        {t(
          isUploading
            ? "dashboard.financialOperations.scan.uploading"
            : "dashboard.financialOperations.scan.analyze",
        )}
        <LuSparkles aria-hidden="true" />
      </button>

      {/* Announced rather than conveyed by a disabled button alone. */}
      <p className="receipt-capture__status" role="status">
        {isUploading ? t("dashboard.financialOperations.scan.uploading") : ""}
      </p>
    </div>
  );
}
