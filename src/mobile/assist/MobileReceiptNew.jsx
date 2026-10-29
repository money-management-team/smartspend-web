import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

import { PATH } from "../../routes/Path.js";
import { useLeaveGuard } from "../categories/useLeaveGuard.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { MOBILE_CAPTURES, backPathFrom } from "../navigation.js";
import MobileSheet from "../shell/MobileSheet.jsx";
import Chevron from "../ui/Chevron.jsx";
import { RECEIPT_TYPES, localUrl, receiptFileError, releaseUrl } from "./captureRules.js";

const sizeText = (bytes) => (bytes >= 1024 * 1024 ? `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/*
 * Choosing a receipt photo on Mobile. The file stays in this page: it is checked
 * (type and size, the full version's rules), shown, and can be replaced or
 * removed. Uploading it is a write (POST /ai/expense-captures) that Mobile does
 * not make, so the Upload button is disabled and says why. Nothing is stored;
 * leaving the page (asked first) forgets the file and its preview.
 */
export default function MobileReceiptNew() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const location = useLocation();
  const backTo = backPathFrom(location.state, MOBILE_CAPTURES);
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const guard = useLeaveGuard(file !== null);
  // A local address for the chosen photo (HEIC is not shown by most browsers), released when the file changes or the page closes.
  const preview = useMemo(() => (file && file.type.startsWith("image/") && file.type !== "image/heic" ? localUrl(file) : null), [file]);
  useEffect(() => () => releaseUrl(preview), [preview]);

  const choose = (event) => {
    const picked = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!picked) return;
    const problem = receiptFileError(picked);
    setError(problem);
    setFile(problem ? null : picked);
  };

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
        <input ref={inputRef} id={`${ids}-file`} className="sm-sr" type="file" accept={RECEIPT_TYPES.join(",")} onChange={choose} aria-describedby={`${ids}-rules`} data-sm-input="receipt" />
        <div className="sm-actions">
          <button type="button" className="sm-button" onClick={() => inputRef.current?.click()} data-sm-action="choose">{t(file ? "captures.replace" : "captures.choose")}</button>
          {file && <button type="button" className="sm-button sm-button-quiet" onClick={() => setFile(null)} data-sm-action="remove">{t("captures.remove")}</button>}
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
