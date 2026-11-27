import { useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

import { PATH } from "../../routes/Path.js";
import { useLeaveGuard } from "../categories/useLeaveGuard.js";
import { useFormChoices } from "../forms/useFormChoices.js";
import { spendable } from "../forms/workflows.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { MOBILE_IMPORTS, backPathFrom } from "../navigation.js";
import MobileSheet from "../shell/MobileSheet.jsx";
import Chevron from "../ui/Chevron.jsx";
import { IMPORT_FIELDS, importFileKind, parseCsv, previewRows, suggestMapping } from "./importPreview.js";

const NEEDS = Object.freeze({ accounts: true });
const PREVIEW_ROWS = 10;

/*
 * A statement import, up to the point where it would be uploaded: choose the
 * account and the file, map its columns, and see how its rows read. A CSV file
 * is read here, on this device (importPreview.js); an Excel file is read by
 * SmartSpend after upload, so it gets no preview. Uploading is a write
 * (POST /imports) that Mobile does not make: the button is disabled and says
 * why. The file and the mapping live in this page only.
 */
export default function MobileImportNew() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const location = useLocation();
  const backTo = backPathFrom(location.state, MOBILE_IMPORTS);
  const choices = useFormChoices(NEEDS);
  const inputRef = useRef(null);
  const [accountId, setAccountId] = useState("");
  const [file, setFile] = useState(null); // { name, kind, parsed }
  const [error, setError] = useState(null);
  const [mapping, setMapping] = useState({});
  const guard = useLeaveGuard(file !== null || accountId !== "");
  const rows = useMemo(() => (file?.parsed ? previewRows(file.parsed, mapping) : []), [file, mapping]);
  const counts = rows.reduce((all, row) => ({ ...all, ok: all.ok + (row.problems.length === 0 ? 1 : 0), problems: all.problems + (row.problems.length ? 1 : 0) }), { ok: 0, problems: 0 });
  const accounts = choices.accounts.filter(spendable);

  const choose = async (event) => {
    const picked = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!picked) return;
    const kind = importFileKind(picked);
    if (!["csv", "xlsx"].includes(kind)) {
      setError(kind);
      setFile(null);
      return;
    }
    setError(null);
    if (kind === "xlsx") {
      setFile({ name: picked.name, kind, parsed: null });
      setMapping({});
      return;
    }
    try {
      const parsed = parseCsv(await picked.text());
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setError("noRows");
        setFile(null);
        return;
      }
      setFile({ name: picked.name, kind, parsed });
      setMapping(suggestMapping(parsed.headers));
    } catch {
      setError("unreadable");
      setFile(null);
    }
  };

  return (
    <section className="sm-page" data-sm-screen="import-new" data-sm-state={file ? "chosen" : "empty"}>
      <Link className="sm-link-row sm-back" to={backTo}>
        <Chevron back />
        <span>{t("importNew.back")}</span>
      </Link>
      <div className="sm-card">
        <h2 className="sm-card-title">{t("importNew.title")}</h2>
        <p className="sm-text sm-muted">{t("importNew.intro")}</p>
        <div className="sm-field">
          <label className="sm-label" htmlFor={`${ids}-account`}>{t("forms.fields.account_id")} <span className="sm-required">{t("forms.required")}</span></label>
          <select id={`${ids}-account`} className="sm-select" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            <option value="">{t("forms.choose")}</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{`${account.name ?? t("forms.unnamed")} · ${account.currency ?? "—"}`}</option>)}
          </select>
        </div>
        <p id={`${ids}-rules`} className="sm-text sm-muted sm-fine">{t("importNew.rules")}</p>
        <input ref={inputRef} className="sm-sr" type="file" accept=".csv,.xlsx" onChange={choose} aria-describedby={`${ids}-rules`} data-sm-input="statement" />
        <div className="sm-actions">
          <button type="button" className="sm-button" onClick={() => inputRef.current?.click()} data-sm-action="choose-file">{t(file ? "importNew.replace" : "importNew.choose")}</button>
          {file && <button type="button" className="sm-button sm-button-quiet" onClick={() => setFile(null)} data-sm-action="remove-file">{t("captures.remove")}</button>}
        </div>
        {error && <p className="sm-text sm-form-error" role="alert" data-sm-error={error}>{t(`importNew.error.${error}`)}</p>}
        {file && <p className="sm-text"><bdi dir="auto" className="sm-user-text">{file.name}</bdi></p>}
      </div>

      {file?.kind === "xlsx" && <p className="sm-card sm-text sm-muted" data-sm-note="no-preview">{t("importNew.excel")}</p>}

      {file?.parsed && (
        <section className="sm-card" aria-labelledby={`${ids}-map`} data-sm-section="mapping">
          <h2 id={`${ids}-map`} className="sm-card-title">{t("importNew.mapping")}</h2>
          <p className="sm-text sm-muted sm-fine">{t("importNew.mappingHint")}</p>
          <div className="sm-import-mapping">
            {IMPORT_FIELDS.map((field) => (
              <div key={field} className="sm-field">
                <label className="sm-label" htmlFor={`${ids}-f-${field}`}>{t(`importNew.fields.${field}`)}</label>
                <select id={`${ids}-f-${field}`} className="sm-select" value={mapping[field] ?? ""} onChange={(event) => setMapping((current) => ({ ...current, [field]: event.target.value }))} data-sm-map={field}>
                  <option value="">{t("importNew.unmapped")}</option>
                  {file.parsed.headers.map((header, index) => <option key={index} value={String(index)}>{`${index + 1}. ${header}`}</option>)}
                </select>
              </div>
            ))}
          </div>
        </section>
      )}

      {file?.parsed && (
        <section className="sm-card" aria-labelledby={`${ids}-preview`} data-sm-section="preview">
          <h2 id={`${ids}-preview`} className="sm-card-title">{t("importNew.preview")}</h2>
          <p className="sm-text" data-sm-counts={`${counts.ok}:${counts.problems}`}>{t("importNew.counts", { total: rows.length, ok: counts.ok, problems: counts.problems })}</p>
          {file.parsed.truncated && <p className="sm-text sm-muted sm-fine">{t("importNew.truncated")}</p>}
          <div className="sm-table-wrap">
            <table className="sm-table">
              <caption className="sm-sr">{t("importNew.previewCaption", { count: Math.min(PREVIEW_ROWS, rows.length) })}</caption>
              <thead><tr><th scope="col">{t("importNew.line")}</th><th scope="col">{t("importNew.fields.date")}</th><th scope="col">{t("importNew.fields.amount")}</th><th scope="col">{t("importNew.fields.description")}</th><th scope="col">{t("importNew.check")}</th></tr></thead>
              <tbody>
                {rows.slice(0, PREVIEW_ROWS).map((row) => (
                  <tr key={row.line} data-sm-row={row.line} data-sm-problems={row.problems.join(" ") || undefined}>
                    <th scope="row"><bdi dir="ltr">{row.line}</bdi></th>
                    <td><bdi dir="ltr">{row.date ?? "—"}</bdi></td>
                    <td><bdi dir="ltr">{row.amount ?? "—"}</bdi></td>
                    <td className="sm-import-desc"><bdi dir="auto">{row.description || "—"}</bdi></td>
                    <td>{row.problems.length ? row.problems.map((problem) => t(`importNew.problem.${problem}`)).join(", ") : t("importNew.looksRight")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="sm-text sm-muted sm-fine">{t("importNew.advisory")}</p>
        </section>
      )}

      <div className="sm-card" role="note" data-sm-note="write-closed" data-sm-write="import.upload">
        <h2 className="sm-card-title">{t("captures.nextTitle")}</h2>
        <p className="sm-text sm-muted">{t("importNew.next")}</p>
        <button type="button" className="sm-button" disabled data-sm-action="upload">{t("importNew.upload")}</button>
        <p className="sm-text sm-muted sm-fine">{t("importNew.uploadClosed")}</p>
        <Link className="sm-link-row" to={PATH.USER.IMPORTS}>
          <span>{t("importNew.full")}</span>
          <Chevron />
        </Link>
      </div>

      <MobileSheet open={guard.blocked} onClose={guard.stay} titleId={`${ids}-leave`} title={t("importNew.discardTitle")}>
        <p className="sm-text">{t("importNew.discardBody")}</p>
        <div className="sm-actions sm-leave-actions">
          <button type="button" className="sm-button" onClick={guard.stay} data-sm-action="stay">{t("forms.keepEditing")}</button>
          <button type="button" className="sm-button sm-button-quiet" onClick={guard.leave} data-sm-action="discard">{t("forms.discard")}</button>
        </div>
      </MobileSheet>
    </section>
  );
}
