import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { LuArrowRight, LuColumns3, LuHistory, LuRotateCcw, LuX } from "react-icons/lu";

import Loading from "../../../../components/Loading/Loading";
import { PATH } from "../../../../routes/Path";
import { ApiError } from "../api/apiClient";
import { importsApi } from "../api/importsApi";
import ImportCancel from "./components/ImportCancel/ImportCancel";
import ImportConfirm from "./components/ImportConfirm/ImportConfirm";
import ImportMapping from "./components/ImportMapping/ImportMapping";
import ImportOutcome from "./components/ImportOutcome/ImportOutcome";
import ImportPreview from "./components/ImportPreview/ImportPreview";
import ImportSteps from "./components/ImportSteps/ImportSteps";
import ImportSummary from "./components/ImportSummary/ImportSummary";
import ImportValidate from "./components/ImportValidate/ImportValidate";
import UploadStatement from "./components/UploadStatement/UploadStatement";
import {
  canCancelImport,
  canConfirmImport,
  canEditImport,
  getImportErrorMessage,
  getImportStep,
  isImportFinal,
  isImportPosted,
  parseImportDetailsResponse,
} from "./importHelpers";

import "./Import.css";

/*
 * Statement import wizard: upload → map columns → validate → review & fix
 * rows → confirm → outcome.
 *
 * Every step is decided from the backend import (`status`, `mapping`,
 * `mapped_at`, `validated_at`, `is_editable`) through the helpers in
 * importHelpers, never from a local flag, and every response's import
 * replaces the one shown. Confirming posts the reviewed rows as real
 * transactions; from then on ImportOutcome follows the backend.
 *
 * The import id is kept in the URL (`?import=`). After a reload the import is
 * read back through GET /imports/{id} — the canonical state endpoint, which
 * also returns the suggested mapping while the file is still unmapped — so a
 * refresh resumes at the right step instead of losing the workflow.
 */
export default function Import() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlImportId = searchParams.get("import");
  const [session, setSession] = useState({ import: null, suggestedMapping: null, notice: null });
  const [isEditingMapping, setIsEditingMapping] = useState(false);
  // Set once the user leaves Review for the confirmation step.
  const [isConfirming, setIsConfirming] = useState(false);
  const currentImport = session.import;

  /* ---------- Resume after a reload (GET /imports/{id}) ---------- */

  const needsResume = urlImportId != null && String(currentImport?.id ?? "") !== urlImportId;
  const [resumeReloadKey, setResumeReloadKey] = useState(0);
  const resumeKey = `${urlImportId}:${resumeReloadKey}`;
  const [resume, setResume] = useState({ key: null, error: null });

  useEffect(() => {
    if (!needsResume) return undefined;

    const controller = new AbortController();

    importsApi
      .get(urlImportId, { signal: controller.signal })
      .then((response) => {
        const parsed = parseImportDetailsResponse(response);
        if (!parsed) throw new ApiError("", { code: "MALFORMED_RESPONSE" });

        setSession({ import: parsed.import, suggestedMapping: parsed.suggestedMapping, notice: null });
        setIsConfirming(false);
        setResume({ key: resumeKey, error: null });
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setResume({ key: resumeKey, error });
      });

    return () => controller.abort();
  }, [needsResume, urlImportId, resumeKey]);

  const isResuming = needsResume && resume.key !== resumeKey;
  const resumeError = needsResume && resume.key === resumeKey ? resume.error : null;

  /* ---------- Transitions (the backend's import is the new state) ---------- */

  const backendStep = currentImport ? getImportStep(currentImport) : "upload";
  const step = !currentImport
    ? "upload"
    : isEditingMapping
      ? "map"
      : isConfirming && backendStep === "review"
        ? "confirm"
        : backendStep;
  const editable = canEditImport(currentImport);

  const startOver = () => {
    setSession({ import: null, suggestedMapping: null, notice: null });
    setIsEditingMapping(false);
    setIsConfirming(false);
    setSearchParams(new URLSearchParams());
  };

  const handleUploaded = ({ import: record, suggestedMapping }) => {
    setSession({ import: record, suggestedMapping, notice: "uploaded" });
    setIsEditingMapping(false);
    setIsConfirming(false);
    setSearchParams(new URLSearchParams({ import: String(record.id) }));
  };

  const handleMappingSaved = (record) => {
    setSession((current) => ({ ...current, import: record, notice: "mappingSaved" }));
    setIsEditingMapping(false);
  };

  const handleValidated = (record) => {
    setSession((current) => ({ ...current, import: record, notice: "validated" }));
  };

  // Used by the preview, the outcome poll and every lifecycle action.
  const handleImportChange = useCallback((record) => {
    setSession((current) =>
      current.import && record && String(current.import.id) === String(record.id)
        ? { ...current, import: record }
        : current,
    );
  }, []);

  // Confirmation answered (200 or 202): the outcome screen takes over and
  // polls until the backend says the import is final.
  const handleConfirmed = (record) => {
    setSession((current) => ({ ...current, import: record, notice: "confirmed" }));
    setIsConfirming(false);
  };

  const handleCancelled = (record) => {
    setSession((current) => ({ ...current, import: record, notice: "cancelled" }));
    setIsConfirming(false);
  };

  return (
    <div className="import-page">
      <header className="import-page__header">
        <div>
          <h1>{t("dashboard.importPage.title")}</h1>
          <p>{t("dashboard.importPage.subtitle")}</p>
        </div>
        <Link to={PATH.USER.IMPORT_HISTORY} className="import-page__history-link">
          <LuHistory aria-hidden="true" />
          <span>{t("dashboard.importPage.history.title")}</span>
        </Link>
      </header>

      <ImportSteps current={step} />

      {isResuming && <Loading message={t("dashboard.importPage.resume.loading")} />}

      {resumeError && (
        <div className="import-page__state" role="alert">
          <p>{getImportErrorMessage(resumeError, t, "resume")}</p>
          <div className="import-page__state-actions">
            <button type="button" onClick={() => setResumeReloadKey((key) => key + 1)}>
              {t("common.retry")}
            </button>
            <button type="button" className="import-page__secondary" onClick={startOver}>
              {t("dashboard.importPage.actions.startOver")}
            </button>
          </div>
        </div>
      )}

      {!needsResume && !currentImport && <UploadStatement onUploaded={handleUploaded} />}

      {!needsResume && currentImport && (
        <>
          <ImportSummary
            importRecord={currentImport}
            actions={
              <>
                {editable && !isEditingMapping && step !== "map" && (
                  <button type="button" className="import-page__action" onClick={() => setIsEditingMapping(true)}>
                    <LuColumns3 aria-hidden="true" />
                    {t("dashboard.importPage.actions.changeMapping")}
                  </button>
                )}
                {/*
                 * Cancel only before anything was posted; a confirmed import
                 * is undone with Reverse instead, from the outcome screen.
                 * The two are never offered together.
                 */}
                {canCancelImport(currentImport) && (
                  <ImportCancel importRecord={currentImport} onCancelled={handleCancelled} />
                )}
                <button type="button" className="import-page__action" onClick={startOver}>
                  <LuRotateCcw aria-hidden="true" />
                  {t("dashboard.importPage.actions.startOver")}
                </button>
              </>
            }
          />

          {session.notice && (
            <div className="import-page__notice" role="status">
              <p>{t(`dashboard.importPage.notices.${session.notice}`)}</p>
              <button
                type="button"
                onClick={() => setSession((current) => ({ ...current, notice: null }))}
                aria-label={t("common.close")}
              >
                <LuX aria-hidden="true" />
              </button>
            </div>
          )}

          {step === "map" && (
            <ImportMapping
              key={`${currentImport.id}:${currentImport.mapped_at ?? "new"}`}
              importRecord={currentImport}
              suggestedMapping={session.suggestedMapping}
              onSaved={handleMappingSaved}
              onCancel={isEditingMapping ? () => setIsEditingMapping(false) : null}
            />
          )}

          {step === "validate" && <ImportValidate importRecord={currentImport} onValidated={handleValidated} />}

          {step === "review" && (
            <>
              <ImportPreview
                key={`${currentImport.id}:${currentImport.validated_at ?? ""}`}
                importRecord={currentImport}
                onImportChange={handleImportChange}
              />

              <div className="import-page__advance">
                {canConfirmImport(currentImport) ? (
                  <>
                    <p>{t("dashboard.importPage.review.readyHint")}</p>
                    <button type="button" className="import-page__primary" onClick={() => setIsConfirming(true)}>
                      {t("dashboard.importPage.review.continue")}
                      <LuArrowRight aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  <p>{t("dashboard.importPage.review.nothingToImport")}</p>
                )}
              </div>
            </>
          )}

          {step === "confirm" && !isImportPosted(currentImport) && !isImportFinal(currentImport) && (
            <ImportConfirm
              importRecord={currentImport}
              onConfirmed={handleConfirmed}
              onBack={() => setIsConfirming(false)}
            />
          )}

          {step === "confirm" && (isImportPosted(currentImport) || isImportFinal(currentImport)) && (
            <ImportOutcome
              key={currentImport.id}
              importRecord={currentImport}
              onImportChange={handleImportChange}
            />
          )}
        </>
      )}
    </div>
  );
}
