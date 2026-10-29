import { useEffect, useRef, useState } from "react";
import { LuCamera, LuSparkles } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { getAiExpenseCapturePath } from "../../../../../../routes/Path";
import { ApiError, createIdempotencyKey, getApiErrorMessage } from "../../../api/apiClient";
import { aiExpenseCapturesApi } from "../../../api/aiExpenseCapturesApi";
import { getAiInputLimitError } from "../../../api/aiInputQuotasApi.js";
import { CAPTURE_UPLOAD_MAX_BYTES } from "../../../AiExpenseCaptures/captureConstants";
import { getCaptureUploadError, isMissingUploadRoute, parseCaptureResponse } from "../../../AiExpenseCaptures/captureHelpers";
import { isVoiceOutcomeUncertain } from "../../voiceCaptureFlow.js";
import "./ReceiptCapture.css";

const MAX_MB = Math.round(CAPTURE_UPLOAD_MAX_BYTES / (1024 * 1024));
const P = "dashboard.financialOperations.scan";
/** Receipt admission shares the daily allowance store, while review/confirmation stay unchanged. */
export default function ReceiptCapture({ account, onRequireAccount, quota, onSwitchToManual }) {
  const { t } = useTranslation(); const navigate = useNavigate();
  const inputRef = useRef(null), pendingRef = useRef(null), intentRef = useRef(null);
  const [file, setFile] = useState(null), [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null), [fileError, setFileError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  useEffect(() => () => pendingRef.current?.abort(), []);
  const pick = () => { if (!isUploading && !uncertain && quota.store.canUse("receipt")) inputRef.current?.click(); };
  const handleChange = (event) => {
    const [selected] = event.target.files ?? []; if (!selected || pendingRef.current || uncertain) return;
    setFile(selected); setError(null); setFileError(getCaptureUploadError(selected) ?? ""); intentRef.current = null;
  };
  const analyze = async () => {
    if (pendingRef.current || (!uncertain && !quota.store.canUse("receipt"))) return;
    if (!(onRequireAccount ? onRequireAccount() : Boolean(account))) return;
    if (!file) { pick(); return; }
    const invalid = getCaptureUploadError(file); if (invalid) { setFileError(invalid); return; }
    if (!Number.isSafeInteger(Number(account?.workspace_id)) || Number(account.workspace_id) < 1) { setError(new ApiError("", { code: "WORKSPACE_UNAVAILABLE" })); return; }
    if (!intentRef.current) intentRef.current = { file, workspaceId: Number(account.workspace_id), idempotencyKey: createIdempotencyKey("receipt-upload") };
    const intent = intentRef.current, controller = new AbortController(); pendingRef.current = controller;
    setIsUploading(true); setError(null);
    try {
      const response = await aiExpenseCapturesApi.create(intent.file, { workspaceId: intent.workspaceId, idempotencyKey: intent.idempotencyKey, signal: controller.signal });
      if (controller.signal.aborted) return;
      const capture = parseCaptureResponse(response);
      if (!capture || String(capture.workspace_id) !== String(intent.workspaceId)) throw new ApiError("", { code: "MALFORMED_RESPONSE" });
      quota.store.applyResponse(response); void quota.store.refresh(); intentRef.current = null; setUncertain(false);
      navigate(getAiExpenseCapturePath(capture.id));
    } catch (requestError) {
      if (controller.signal.aborted) return;
      quota.store.handleError(requestError); void quota.store.refresh();
      const unknown = isVoiceOutcomeUncertain(requestError); setUncertain(unknown);
      if (!unknown) intentRef.current = null;
      if (requestError?.code !== "UNAUTHENTICATED") setError(requestError);
    } finally {
      if (pendingRef.current === controller) { pendingRef.current = null; if (!controller.signal.aborted) setIsUploading(false); }
    }
  };
  const limit = getAiInputLimitError(error);
  return (
    <div className="capture-panel receipt-capture">
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleChange} aria-hidden="true" tabIndex={-1} />
      <div className={`receipt-capture__surface${file ? " receipt-capture__surface--filled" : ""}`}>
        <span className="receipt-capture__visual" aria-hidden="true"><LuCamera /></span>
        <div className="receipt-capture__copy"><span className="capture-panel__kicker">{t(`${P}.kicker`)}</span><h3 dir="auto">{file ? file.name : t(`${P}.title`)}</h3><p>{t(`${P}.description`)}</p></div>
        <button type="button" className="capture-action capture-action--soft" onClick={pick} disabled={isUploading || uncertain || !quota.store.canUse("receipt")}>{t(`${P}.choose`)}</button>
      </div>
      {fileError && <p className="receipt-capture__error" role="alert">{t(`${P}.validation.${fileError}`, { max: MAX_MB })}</p>}
      {error && <div className="capture-notice" role="alert"><p dir="auto">{limit ? t(`dashboard.financialOperations.aiInput.${limit.kind === "daily" ? "exhausted" : "minute"}`) : isMissingUploadRoute(error) ? t(`${P}.unavailable`) : `${t(`${P}.failed`)} ${getApiErrorMessage(error, t)}`}</p>
        {uncertain && <p>{t("dashboard.financialOperations.voiceFlow.receiptUncertain")}</p>}
        <button type="button" onClick={onSwitchToManual}>{t("dashboard.financialOperations.voice.fallback")}</button>
      </div>}
      <button type="button" className="capture-action receipt-capture__analyze" onClick={() => void analyze()} disabled={isUploading || Boolean(fileError) || !uncertain && !quota.store.canUse("receipt")} aria-busy={isUploading}>
        {t(isUploading ? `${P}.uploading` : uncertain ? "dashboard.financialOperations.voiceFlow.replayUpload" : `${P}.analyze`)}<LuSparkles aria-hidden="true" />
      </button>
      <p className="receipt-capture__status" role="status">{isUploading ? t(`${P}.uploading`) : ""}</p>
    </div>
  );
}
