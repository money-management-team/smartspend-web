import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { PATH } from "../../routes/Path.js";
import { sessionWorkspace } from "../data/readApi.js";
import { isWriteOpen } from "../data/writeGate.js";
import { useLeaveGuard } from "../categories/useLeaveGuard.js";
import WriteOutcome from "../forms/WriteOutcome.jsx";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { MOBILE_CAPTURES, backPathFrom, captureDetailPath } from "../navigation.js";
import MobileSheet from "../shell/MobileSheet.jsx";
import Chevron from "../ui/Chevron.jsx";
import { useCaptureUpload } from "./useCaptureUpload.js";
import { RECEIPT_TYPES, localUrl, receiptFileError, releaseUrl } from "./captureRules.js";

const sizeText = (bytes) => (bytes >= 1024 * 1024 ? `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/*
 * Choosing a receipt photo on Mobile. The file stays in this page: it is checked
 * (type and size, the full version's rules), shown, and can be replaced or
 * removed.
 *
 * Uploading it is POST /ai/expense-captures (data/writeGate.js's
 * "receipt.upload"): closed while data/writeGate.js's APPROVED stays empty, in
 * which case the Upload button stays disabled and says so, exactly as before
 * this screen had any send code. Opened, it uploads once through
 * useCaptureUpload.js and goes straight to the capture's own page
 * (assist/MobileCaptures.jsx's MobileCaptureDetail) to be read and reviewed —
 * never recorded as an expense from here. Nothing typed or chosen is stored;
 * leaving the page (asked first) forgets the file and its preview.
 */
export default function MobileReceiptNew() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const location = useLocation();
  const navigate = useNavigate();
  const backTo = backPathFrom(location.state, MOBILE_CAPTURES);
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const open = isWriteOpen("receipt.upload");
  const send = useCaptureUpload("receipt.upload");
  const outcomeRef = useRef(null);
  const guard = useLeaveGuard(file !== null && send.phase !== "confirmed");
  // A local address for the chosen photo (HEIC is not shown by most browsers), released when the file changes or the page closes.
  const preview = useMemo(() => (file && file.type.startsWith("image/") && file.type !== "image/heic" ? localUrl(file) : null), [file]);
  useEffect(() => () => releaseUrl(preview), [preview]);

  useEffect(() => {
    if (send.phase === "confirmed" && send.capture?.id) {
      navigate(captureDetailPath("receipt", send.capture.id), { replace: true, state: { from: backTo } });
    }
  }, [send.phase, send.capture, navigate, backTo]);

  useEffect(() => {
    if (send.phase !== "idle" && send.phase !== "uploading" && send.phase !== "confirmed") outcomeRef.current?.focus();
  }, [send.phase]);

  const choose = (event) => {
    const picked = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!picked) return;
    send.reset();
    const problem = receiptFileError(picked);
    setError(problem);
    setFile(problem ? null : picked);
  };

  const remove = () => {
    send.reset();
    setFile(null);
    setError(null);
  };

  const uploadNow = () => {
    if (!file || send.uploading) return;
    send.upload(file, sessionWorkspace()?.id);
  };

  const settled = ["rejected", "unknown", "changed"].includes(send.phase);

  return (
    <section className="sm-page" data-sm-screen="receipt-new" data-sm-state={file ? "chosen" : error ? "rejected" : "empty"}>
      <Link className="sm-link-row sm-back" to={backTo}>
        <Chevron back />
        <span>{t("captures.back")}</span>
      </Link>
      <div className="sm-card">
        <h2 className="sm-card-title">{t("captures.receiptTitle")}</h2>
        <p className="sm-text sm-muted">{t("captures.receiptIntro")}</p>
        <p id={`${ids}-rules`} className="sm-text sm-muted sm-fine">{t("captures.receiptRules")}</p>
        <input ref={inputRef} id={`${ids}-file`} className="sm-sr" type="file" accept={RECEIPT_TYPES.join(",")} onChange={choose} aria-describedby={`${ids}-rules`} data-sm-input="receipt" disabled={send.uploading} />
        <div className="sm-actions">
          <button type="button" className="sm-button" onClick={() => inputRef.current?.click()} disabled={send.uploading} data-sm-action="choose">{t(file ? "captures.replace" : "captures.choose")}</button>
          {file && <button type="button" className="sm-button sm-button-quiet" onClick={remove} disabled={send.uploading} data-sm-action="remove">{t("captures.remove")}</button>}
        </div>
        {error && <p className="sm-text sm-form-error" role="alert" data-sm-error={error}>{t(`captures.fileError.${error}`)}</p>}
      </div>

      {file && (
        <div className="sm-card" data-sm-file="chosen">
          <h2 className="sm-card-title">{t("captures.chosen")}</h2>
          {preview ? <img className="sm-receipt-preview" src={preview} alt={t("captures.previewAlt")} /> : <p className="sm-text sm-muted">{t("captures.noPreview")}</p>}
          <p className="sm-text"><bdi dir="auto" className="sm-user-text">{file.name}</bdi> · <bdi dir="ltr">{sizeText(file.size)}</bdi></p>
        </div>
      )}

      {!open && (
        <div className="sm-card" role="note" data-sm-note="write-closed" data-sm-write="receipt.upload">
          <h2 className="sm-card-title">{t("captures.nextTitle")}</h2>
          <p className="sm-text sm-muted">{t("captures.receiptNext")}</p>
          <button type="button" className="sm-button" disabled data-sm-action="upload">{t("captures.upload")}</button>
          <p className="sm-text sm-muted sm-fine">{t("captures.uploadClosed")}</p>
          <Link className="sm-link-row" to={PATH.USER.AI_EXPENSE_CAPTURES}>
            <span>{t("captures.uploadFull")}</span>
            <Chevron />
          </Link>
        </div>
      )}

      {open && !settled && (
        <div className="sm-card" data-sm-write="receipt.upload">
          <h2 className="sm-card-title">{t("captures.nextTitle")}</h2>
          <p className="sm-text sm-muted">{t("captures.receiptNextOpen")}</p>
          <div className="sm-actions">
            <button type="button" className="sm-button" onClick={uploadNow} disabled={!file || Boolean(error) || send.uploading} aria-busy={send.uploading ? "true" : undefined} data-sm-action="upload" data-sm-open="true">
              {send.uploading ? t("captures.uploading") : t("captures.upload")}
            </button>
            {send.uploading && (
              <button type="button" className="sm-button sm-button-quiet" onClick={send.cancel} data-sm-action="cancel-upload">{t("captures.uploadCancel")}</button>
            )}
          </div>
        </div>
      )}

      {open && settled && (
        <>
          <WriteOutcome outcome={send} outcomeRef={outcomeRef} backTo={MOBILE_CAPTURES} t={t} />
          {send.phase === "unknown" && (
            <div className="sm-actions sm-form-actions">
              <button type="button" className="sm-button" onClick={send.retry} data-sm-action="retry-upload">{t("captures.uploadRetry")}</button>
            </div>
          )}
        </>
      )}

      <MobileSheet open={guard.blocked} onClose={guard.stay} titleId={`${ids}-leave`} title={t("captures.discardFileTitle")}>
        <p className="sm-text">{t("captures.discardFileBody")}</p>
        <div className="sm-actions sm-leave-actions">
          <button type="button" className="sm-button" onClick={guard.stay} data-sm-action="stay">{t("forms.keepEditing")}</button>
          <button type="button" className="sm-button sm-button-quiet" onClick={guard.leave} data-sm-action="discard">{t("forms.discard")}</button>
        </div>
      </MobileSheet>
    </section>
  );
}
