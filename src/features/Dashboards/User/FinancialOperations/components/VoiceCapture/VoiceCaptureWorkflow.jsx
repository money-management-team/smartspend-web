import { recordingDraftId } from "../../../Experience/experienceData";
import PrivateMoney from "../../../Experience/PrivateMoney";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LuCheck, LuMic, LuRefreshCw, LuTriangleAlert } from "react-icons/lu";
import { getApiErrorMessage } from "../../../api/apiClient.js";
import { getAiInputLimitError } from "../../../api/aiInputQuotasApi.js";
import { getTransactionDetailsPath } from "../../../../../../routes/Path";
import {
  getVoiceCapabilities,
  getVoiceCaptureProgress,
} from "../../voiceCaptureContract.js";
import {
  createVoiceCaptureFlow,
  isVoiceDraftDirty,
  voiceReviewOptions,
  VOICE_REVIEW_FIELDS,
} from "../../voiceCaptureFlow.js";
import {
  getTransactionErrorMessage,
  isInsufficientBalanceError,
} from "../../transactionHelpers";
import VoiceCapture from "./VoiceCapture";
import "./VoiceCaptureWorkflow.css";

const P = "dashboard.financialOperations.voiceFlow";
const run = (promise) => {
  void promise.catch(() => {});
};
const ANALYSIS_STEPS = ["upload", "queue", "transcription", "extraction"];

function VoiceAnalysisLoading({ progress, t, stopped }) {
  return (
    <section
      className="voice-workflow__loading"
      aria-label={t(`${P}.progress.label`)}
    >
      <div className="voice-workflow__loading-orbit" aria-hidden="true">
        <span />
        <LuMic />
      </div>
      <div
        className="voice-workflow__loading-copy"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <p className="voice-workflow__loading-eyebrow">
          {t(`${P}.progress.eyebrow`)}
        </p>
        <h3>{t(`${P}.progress.phases.${progress.phase}.title`)}</h3>
        <p>{t(`${P}.progress.phases.${progress.phase}.hint`)}</p>
      </div>
      <ol
        className="voice-workflow__loading-steps"
        aria-label={t(`${P}.progress.stepsLabel`)}
      >
        {ANALYSIS_STEPS.map((step, index) => {
          const stepState =
            index < progress.stage
              ? "done"
              : index === progress.stage
                ? "current"
                : "waiting";
          return (
            <li
              key={step}
              data-state={stepState}
              aria-current={stepState === "current" ? "step" : undefined}
            >
              <span
                className="voice-workflow__loading-step-icon"
                aria-hidden="true"
              >
                {stepState === "done" ? <LuCheck /> : index + 1}
              </span>
              <span>
                {t(`${P}.progress.steps.${step}`)}
                <small>{t(`${P}.progress.stepStates.${stepState}`)}</small>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="voice-workflow__loading-assurance">
        {t(`${P}.progress.noFinancialEffect`)}
      </p>
      <p className="voice-workflow__loading-footnote">
        {t(`${P}.progress.${stopped ? "longWait" : "autoReview"}`)}
      </p>
    </section>
  );
}

export default function VoiceCaptureWorkflow({
  account,
  accounts,
  categories,
  quota,
  onRequireAccount,
  onSwitchToManual,
  workspaceId,
  initialCaptureId,
  initialCaptureWorkspace,
  onConfirmed,
  isLoadingOptions,
  optionsError,
  onRetryOptions,
}) {
  const { t, i18n } = useTranslation();
  const [flow] = useState(() =>
    createVoiceCaptureFlow({
      workspaceId: account?.workspace_id ?? workspaceId,
      preferredAccountId: account?.id,
      quotas: quota.store,
      onConfirmed,
    }),
  );
  const state = useSyncExternalStore(
    flow.subscribe,
    flow.getSnapshot,
    flow.getSnapshot,
  );
  const [confirmPreview, setConfirmPreview] = useState(false);
  const [discardPreview, setDiscardPreview] = useState(false);
  const accountId = account?.id;
  const linkedCaptureId = recordingDraftId(
    initialCaptureId,
    initialCaptureWorkspace,
    account?.workspace_id ?? workspaceId,
  );
  useEffect(() => {
    if ((accountId || workspaceId) && !linkedCaptureId) run(flow.loadHistory());
    const visibility = () => {
      if (document.hidden) flow.pause();
      else flow.resume();
    };
    document.addEventListener("visibilitychange", visibility);
    visibility();
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      flow.cancel();
    };
  }, [flow, accountId, workspaceId, linkedCaptureId]);
  useEffect(() => {
    if (linkedCaptureId) run(flow.open(Number(linkedCaptureId)));
  }, [flow, linkedCaptureId]);

  const capture = state.capture;
  const capabilities = getVoiceCapabilities(capture);
  const progress = getVoiceCaptureProgress(capture, state.busy);
  const busy = Boolean(state.busy);
  const dirty = isVoiceDraftDirty(state.draft, capture);
  const options = voiceReviewOptions(
    accounts,
    categories,
    capture?.workspace_id,
  );
  const selectedAccount = options.accounts.find(
    (item) => String(item.id) === state.draft?.account_id,
  );
  const selectedCategory = options.categories.find(
    (item) => String(item.id) === state.draft?.category_id,
  );
  const missingOption =
    !isLoadingOptions &&
    !optionsError &&
    Boolean(
      (state.draft?.account_id && !selectedAccount) ||
      (state.draft?.category_id && !selectedCategory),
    );
  const mismatch =
    selectedAccount &&
    state.draft?.currency_code &&
    selectedAccount.currency_code !== state.draft.currency_code.toUpperCase();
  const lockForm = busy || state.needsReload || Boolean(state.uncertain);
  const limit = getAiInputLimitError(state.error);
  const message = isInsufficientBalanceError(state.error)
    ? t(`${P}.insufficientBalance`)
    : limit
      ? t(
          `dashboard.financialOperations.aiInput.${limit.kind === "daily" ? "exhausted" : "minute"}`,
        )
      : state.error?.code === "VOICE_INPUT_INVALID"
        ? t(`${P}.validation`)
        : state.error
          ? state.uncertain === "confirm" ||
            state.error?.errors?.amount ||
            state.error?.errors?.account_id
            ? getTransactionErrorMessage(state.error, t)
            : getApiErrorMessage(state.error, t)
          : "";
  const change = (field, value) => {
    setConfirmPreview(false);
    setDiscardPreview(false);
    flow.setDraft(field, value);
  };
  const check = () => {
    if (dirty && !window.confirm(t(`${P}.reloadWarning`))) return;
    setConfirmPreview(false);
    run(flow.check());
  };
  const open = (id) => {
    if (dirty && !window.confirm(t(`${P}.reloadWarning`))) return;
    setConfirmPreview(false);
    setDiscardPreview(false);
    run(flow.open(id));
  };
  const historyTime = (value) => {
    try {
      return value && Number.isFinite(Date.parse(value))
        ? new Intl.DateTimeFormat(i18n.language === "ar" ? "ar-PS" : "en-US", {
            dateStyle: "short",
            timeStyle: "short",
          }).format(new Date(value))
        : "";
    } catch {
      return "";
    }
  };
  const fieldError = (field) =>
    state.error?.errors?.[field] ? (
      <small className="voice-workflow__field-error" role="alert">
        {t(`${P}.fieldInvalid`)}
      </small>
    ) : null;

  return (
    <div className="voice-workflow">
      {!capture && (
        <fieldset
          className="voice-workflow__recorder"
          hidden={Boolean(progress)}
          disabled={busy || Boolean(state.uncertain)}
        >
          <VoiceCapture
            account={account}
            onRequireAccount={onRequireAccount}
            onSwitchToManual={onSwitchToManual}
            disabled={
              busy || Boolean(state.uncertain) || !quota.store.canUse("voice")
            }
            onRecordingReady={(recording) => run(flow.upload(recording))}
          />
        </fieldset>
      )}
      {progress && (
        <VoiceAnalysisLoading
          progress={progress}
          t={t}
          stopped={state.pollStopped}
        />
      )}
      {message && (
        <div
          className="voice-workflow__notice voice-workflow__notice--error"
          role="alert"
        >
          <LuTriangleAlert aria-hidden="true" />
          {message}
        </div>
      )}
      {state.uncertain && (
        <section
          className="voice-workflow__notice voice-workflow__notice--warning"
          role="status"
        >
          <p>{t(`${P}.uncertain.${state.uncertain}`)}</p>
          <div className="voice-workflow__actions">
            {state.uncertain === "upload" && (
              <button
                disabled={busy}
                type="button"
                onClick={() => run(flow.replayUpload())}
              >
                {t(`${P}.replayUpload`)}
              </button>
            )}
            {state.uncertain === "confirm" && (
              <button
                disabled={busy}
                type="button"
                onClick={() => run(flow.confirm())}
              >
                {t(`${P}.replayConfirm`)}
              </button>
            )}
            {state.uncertain === "retry" && (
              <button
                disabled={busy}
                type="button"
                onClick={() => run(flow.retry())}
              >
                {t(`${P}.replayRetry`)}
              </button>
            )}
            {capture && (
              <button disabled={busy} type="button" onClick={check}>
                {t(`${P}.check`)}
              </button>
            )}
          </div>
        </section>
      )}
      {capture && (
        <section
          className="voice-workflow__review"
          aria-label={t(`${P}.reviewTitle`)}
          aria-busy={busy}
        >
          <header className="voice-workflow__header">
            <span className="voice-workflow__icon">
              <LuMic aria-hidden="true" />
            </span>
            <div>
              <h3>{t(`${P}.recording`, { id: capture.id })}</h3>
              <p role="status">{t(`${P}.statuses.${capture.status}`)}</p>
            </div>
            <button
              type="button"
              className="voice-workflow__button"
              disabled={busy}
              onClick={check}
            >
              <LuRefreshCw aria-hidden="true" />
              {t(`${P}.check`)}
            </button>
          </header>
          {state.pollStopped && (
            <p className="voice-workflow__notice">{t(`${P}.pollStopped`)}</p>
          )}
          {capture.transcript && !capabilities.isProcessing && (
            <section className="voice-workflow__transcript">
              <h4>{t(`${P}.transcript`)}</h4>
              <p dir="auto">
                <PrivateMoney>{capture.transcript}</PrivateMoney>
              </p>
            </section>
          )}
          {Array.isArray(capture.warnings) && capture.warnings.length > 0 && (
            <ul className="voice-workflow__warnings">
              {[...new Set(capture.warnings)].map((warning) => (
                <li key={warning}>
                  {t(`${P}.warnings.${warning}`, {
                    defaultValue: t(`${P}.warnings.unknown`),
                  })}
                </li>
              ))}
            </ul>
          )}
          {capture.status === "failed" && (
            <section className="voice-workflow__notice voice-workflow__notice--warning">
              <p>{t(`${P}.analysisFailed`)}</p>
              <div className="voice-workflow__actions">
                {capabilities.canRetry && (
                  <button
                    type="button"
                    disabled={
                      busy ||
                      !quota.store.canUse("voice") ||
                      Boolean(state.uncertain)
                    }
                    onClick={() => run(flow.retry())}
                  >
                    {t(`${P}.retry`)}
                  </button>
                )}
                {!capabilities.canRetry && <p>{t(`${P}.sourceUnavailable`)}</p>}
                <button type="button" onClick={onSwitchToManual}>
                  {t("dashboard.financialOperations.voice.fallback")}
                </button>
              </div>
            </section>
          )}
          {capabilities.canEdit && (
            <>
              <h4>{t(`${P}.reviewTitle`)}</h4>
              <p className="voice-workflow__hint">{t(`${P}.reviewHint`)}</p>
              {optionsError && (
                <div className="voice-workflow__notice voice-workflow__notice--error">
                  <p>{t(`${P}.optionsFailed`)}</p>
                  <button type="button" onClick={onRetryOptions}>
                    {t("common.retry")}
                  </button>
                </div>
              )}
              <form
                className="voice-workflow__form"
                onSubmit={(event) => {
                  event.preventDefault();
                  run(flow.save());
                }}
              >
                <fieldset disabled={lockForm}>
                  <label>
                    {t(`${P}.fields.account_id`)} *
                    <select
                      value={state.draft.account_id}
                      onChange={(e) => change("account_id", e.target.value)}
                    >
                      <option value="">{t(`${P}.choose`)}</option>
                      {options.accounts.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} — {item.currency_code}
                        </option>
                      ))}
                    </select>
                    {fieldError("account_id")}
                    {!isLoadingOptions &&
                      state.draft.account_id &&
                      !selectedAccount && (
                        <small className="voice-workflow__field-error">
                          {t(`${P}.fieldInvalid`)}
                        </small>
                      )}
                  </label>
                  <label>
                    {t(`${P}.fields.category_id`)} *
                    <select
                      value={state.draft.category_id}
                      onChange={(e) => change("category_id", e.target.value)}
                    >
                      <option value="">{t(`${P}.choose`)}</option>
                      {options.categories.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    {fieldError("category_id")}
                    {!isLoadingOptions &&
                      state.draft.category_id &&
                      !selectedCategory && (
                        <small className="voice-workflow__field-error">
                          {t(`${P}.fieldInvalid`)}
                        </small>
                      )}
                  </label>
                  {VOICE_REVIEW_FIELDS.filter(
                    (field) =>
                      !["account_id", "category_id", "description"].includes(
                        field,
                      ),
                  ).map((field) => (
                    <label key={field}>
                      {t(`${P}.fields.${field}`)}{" "}
                      {["amount", "currency_code", "transaction_date"].includes(
                        field,
                      )
                        ? "*"
                        : ""}
                      <input
                        value={state.draft[field]}
                        onChange={(e) => change(field, e.target.value)}
                        type={
                          field === "transaction_date"
                            ? "date"
                            : field === "transaction_time"
                              ? "time"
                              : "text"
                        }
                        step={field === "transaction_time" ? "1" : undefined}
                        inputMode={field === "amount" ? "decimal" : undefined}
                        maxLength={
                          field === "currency_code"
                            ? 3
                            : field === "merchant_name"
                              ? 191
                              : field === "reference_number"
                                ? 120
                                : undefined
                        }
                        dir={
                          [
                            "amount",
                            "currency_code",
                            "transaction_date",
                            "transaction_time",
                          ].includes(field)
                            ? "ltr"
                            : "auto"
                        }
                      />
                      {field === "transaction_time" && (
                        <small>{t(`${P}.timeHint`)}</small>
                      )}
                      {fieldError(field)}
                    </label>
                  ))}
                  <label className="voice-workflow__wide">
                    {t(`${P}.fields.description`)}
                    <textarea
                      maxLength={500}
                      rows={3}
                      value={state.draft.description}
                      onChange={(e) => change("description", e.target.value)}
                      dir="auto"
                    />
                    {fieldError("description")}
                  </label>
                </fieldset>
                {mismatch && (
                  <p className="voice-workflow__field-error" role="alert">
                    {t(`${P}.currencyMismatch`)}
                  </p>
                )}
                {state.needsReload && (
                  <p className="voice-workflow__notice voice-workflow__notice--warning">
                    {t(`${P}.needsReload`)}
                  </p>
                )}
                <div className="voice-workflow__actions">
                  <button
                    type="submit"
                    disabled={
                      lockForm ||
                      !dirty ||
                      isLoadingOptions ||
                      Boolean(optionsError) ||
                      missingOption ||
                      Boolean(mismatch)
                    }
                  >
                    {t(`${P}.${state.busy === "save" ? "saving" : "save"}`)}
                  </button>
                  <button
                    type="button"
                    className="voice-workflow__button--primary"
                    disabled={
                      busy ||
                      dirty ||
                      state.needsReload ||
                      Boolean(state.uncertain) ||
                      !capabilities.canConfirm ||
                      !selectedAccount ||
                      !selectedCategory ||
                      Boolean(mismatch) ||
                      isLoadingOptions ||
                      Boolean(optionsError)
                    }
                    onClick={() => setConfirmPreview(true)}
                  >
                    {t(`${P}.confirmReview`)}
                  </button>
                </div>
                {dirty && (
                  <p className="voice-workflow__hint">{t(`${P}.saveFirst`)}</p>
                )}
              </form>
            </>
          )}
          {confirmPreview && capabilities.canConfirm && !dirty && (
            <section
              className="voice-workflow__confirmation"
              aria-label={t(`${P}.finalConfirmation`)}
            >
              <h4>{t(`${P}.finalConfirmation`)}</h4>
              <p>{t(`${P}.finalHint`)}</p>
              <dl>
                {[
                  "account_id",
                  "category_id",
                  "amount",
                  "currency_code",
                  "transaction_date",
                  "transaction_time",
                ].map((field) => (
                  <div key={field}>
                    <dt>{t(`${P}.fields.${field}`)}</dt>
                    <dd>
                      <bdi dir="auto">
                        {field === "account_id"
                          ? (selectedAccount?.name ?? state.draft[field])
                          : field === "category_id"
                            ? (options.categories.find(
                                (item) =>
                                  String(item.id) === state.draft[field],
                              )?.name ?? state.draft[field])
                            : state.draft[field] || "—"}
                      </bdi>
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="voice-workflow__actions">
                <button
                  type="button"
                  className="voice-workflow__button--primary"
                  disabled={
                    busy ||
                    Boolean(state.uncertain) ||
                    !selectedAccount ||
                    !selectedCategory ||
                    isLoadingOptions ||
                    Boolean(optionsError) ||
                    Boolean(mismatch)
                  }
                  onClick={() => run(flow.confirm())}
                >
                  <LuCheck aria-hidden="true" />
                  {t(`${P}.confirm`)}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmPreview(false)}
                >
                  {t(`${P}.cancel`)}
                </button>
              </div>
            </section>
          )}
          {capture.status === "confirmed" && (
            <section className="voice-workflow__success" role="status">
              <LuCheck aria-hidden="true" />
              <h4>{t(`${P}.confirmed`)}</h4>
              <p>
                <bdi dir="ltr">
                  <PrivateMoney>
                    {capture.review_values.amount}{" "}
                    {capture.review_values.currency_code}
                  </PrivateMoney>
                </bdi>
              </p>
              <p>{t(`${P}.confirmedHint`)}</p>
              {capture.confirmed_transaction_id && (
                <Link
                  to={getTransactionDetailsPath(
                    capture.confirmed_transaction_id,
                  )}
                >
                  {t(`${P}.transaction`)}
                </Link>
              )}
            </section>
          )}
          {!capabilities.isProcessing && capture.ai_suggested_values && (
            <details className="voice-workflow__suggestions">
              <summary>{t(`${P}.suggestions`)}</summary>
              <dl>
                {Object.entries(capture.ai_suggested_values).map(
                  ([field, item]) => (
                    <div key={field}>
                      <dt>
                        {t(`${P}.fields.${field}`, {
                          defaultValue: t(`${P}.otherSuggestion`),
                        })}
                      </dt>
                      <dd>
                        <bdi dir="auto">
                          <PrivateMoney>
                            {typeof item?.value === "string" ? item.value : "—"}
                          </PrivateMoney>
                        </bdi>
                        {typeof item?.confidence === "number" &&
                          Number.isFinite(item.confidence) &&
                          item.confidence >= 0 &&
                          item.confidence <= 1 && (
                            <small>
                              {" "}
                              {t(`${P}.confidence`, {
                                value: Math.round(item.confidence * 100),
                              })}
                            </small>
                          )}
                      </dd>
                    </div>
                  ),
                )}
              </dl>
            </details>
          )}
          <div className="voice-workflow__actions voice-workflow__footer">
            {capabilities.canDiscard && capture.status !== "discarded" && (
              <button
                type="button"
                disabled={busy || Boolean(state.uncertain)}
                onClick={() => setDiscardPreview(true)}
              >
                {t(`${P}.discard`)}
              </button>
            )}
            <button
              type="button"
              disabled={busy || Boolean(state.uncertain)}
              onClick={() => {
                if (dirty && !window.confirm(t(`${P}.reloadWarning`))) return;
                if (flow.newRecording()) {
                  setConfirmPreview(false);
                  setDiscardPreview(false);
                  run(flow.loadHistory());
                }
              }}
            >
              {t(`${P}.newRecording`)}
            </button>
          </div>
          {discardPreview && (
            <section className="voice-workflow__confirmation">
              <p>{t(`${P}.discardHint`)}</p>
              <div className="voice-workflow__actions">
                <button
                  type="button"
                  disabled={busy || Boolean(state.uncertain)}
                  onClick={() => {
                    setDiscardPreview(false);
                    run(flow.discard());
                  }}
                >
                  {t(`${P}.discardConfirm`)}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setDiscardPreview(false)}
                >
                  {t(`${P}.cancel`)}
                </button>
              </div>
            </section>
          )}
        </section>
      )}
      {account && (
        <section className="voice-workflow__history">
          <header>
            <h4>{t(`${P}.history`)}</h4>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(flow.loadHistory(state.history?.page ?? 1))}
            >
              {t(`${P}.refreshHistory`)}
            </button>
          </header>
          <p className="voice-workflow__hint">{t(`${P}.historyHint`)}</p>
          {state.historyError && <p role="alert">{t(`${P}.historyFailed`)}</p>}
          {state.history?.items.length === 0 && <p>{t(`${P}.historyEmpty`)}</p>}
          {state.history?.items.map((item) => (
            <button
              type="button"
              className="voice-workflow__history-row"
              key={item.id}
              disabled={busy || state.uncertain === "confirm"}
              onClick={() => open(item.id)}
            >
              <span>{t(`${P}.recording`, { id: item.id })}</span>
              <span>{t(`${P}.statuses.${item.status}`)}</span>
              <time dateTime={item.timestamps?.created_at}>
                {historyTime(item.timestamps?.created_at)}
              </time>
              <bdi dir="ltr">
                <PrivateMoney>
                  {item.review_values.amount ?? "—"}{" "}
                  {item.review_values.currency_code ?? ""}
                </PrivateMoney>
              </bdi>
            </button>
          ))}
          {state.history && (
            <div className="voice-workflow__pagination">
              <button
                type="button"
                disabled={busy || state.history.page <= 1}
                onClick={() => run(flow.loadHistory(state.history.page - 1))}
              >
                {t(`${P}.previous`)}
              </button>
              <span>
                <bdi>
                  {state.history.page} / {state.history.lastPage}
                </bdi>
              </span>
              <button
                type="button"
                disabled={busy || state.history.page >= state.history.lastPage}
                onClick={() => run(flow.loadHistory(state.history.page + 1))}
              >
                {t(`${P}.next`)}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
