import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  LuArrowLeft,
  LuClock,
  LuInfo,
  LuReceiptText,
  LuRefreshCw,
  LuTriangleAlert,
} from "react-icons/lu";

import Loading from "../../../../components/Loading/Loading";
import { PATH, getTransactionDetailsPath } from "../../../../routes/Path";
import { accountsApi } from "../api/accountsApi";
import { aiExpenseCapturesApi } from "../api/aiExpenseCapturesApi";
import { categoriesApi } from "../api/categoriesApi";
import { ApiError, getApiErrorMessage, getStoredWorkspace } from "../api/apiClient";
import {
  createIdempotentAttempt,
  translateEnum,
} from "../FinancialOperations/transactionHelpers";
import { getDisplayLocale } from "../Accounts/accountHelpers";
import { formatMoney } from "../utils/formatters";
import AiSuggestions from "../AiExpenseCaptures/components/AiSuggestions/AiSuggestions";
import CaptureConfirm from "../AiExpenseCaptures/components/CaptureConfirm/CaptureConfirm";
import CaptureDiscard from "../AiExpenseCaptures/components/CaptureDiscard/CaptureDiscard";
import CaptureRetry from "../AiExpenseCaptures/components/CaptureRetry/CaptureRetry";
import CaptureSource from "../AiExpenseCaptures/components/CaptureSource/CaptureSource";
import CaptureStatusBadge from "../AiExpenseCaptures/components/CaptureStatusBadge/CaptureStatusBadge";
import ReviewValues from "../AiExpenseCaptures/components/ReviewValues/ReviewValues";
import {
  CAPTURE_FATAL_POLL_CODES,
  MAX_CAPTURE_POLLS,
  buildCaptureConfirmPayload,
  buildCaptureUpdatePayload,
  canReviewCapture,
  captureHasTransaction,
  getCaptureSourceUrl,
  getCaptureStatus,
  getCaptureWarnings,
  getCapturePollDelay,
  getConfirmBlockers,
  getConfirmErrorKind,
  getConfirmFieldErrors,
  getConfirmedTransactionId,
  getEligibleAccounts,
  getReviewVersion,
  humanizeCaptureField,
  isCaptureDiscarded,
  isCaptureFormDirty,
  isCaptureInFlight,
  isCaptureProcessing,
  isLifecycleRejection,
  mergeCaptureUpdate,
  parseCaptureResponse,
  parseConfirmResponse,
  toCaptureFormValues,
  validateCaptureForm,
} from "../AiExpenseCaptures/captureHelpers";
import {
  AI_CAPTURE_STATUS,
  CONFIRM_ATTEMPT_PREFIX,
  DISCARD_ATTEMPT_PREFIX,
  RETRY_ATTEMPT_PREFIX,
} from "../AiExpenseCaptures/captureConstants";

import "./AiExpenseCaptureDetails.css";

// A poll that hasn't started. Kept out of the component so a re-render can
// compare against the same object.
const NO_POLL = { key: null, count: 0, error: null, stopped: false };

/*
 * One AI expense capture (GET /ai/expense-captures/{id}): what the AI read,
 * what the review draft currently says, and — once confirmed — the
 * transaction it created.
 *
 * The one write this page performs is PATCH /ai/expense-captures/{id}, which
 * saves the reviewed draft of a `ready_for_review` capture. It edits
 * `review_values` and nothing else: no transaction, no ledger entry, no
 * balance and no budget change, so nothing here refreshes a financial total.
 *
 * Retry (POST /ai/expense-captures/{id}/retry) asks the backend to run the
 * AI over a failed receipt again. It requeues processing and creates nothing.
 *
 * Confirm (POST /ai/expense-captures/{id}/confirm) is the one action here
 * that creates real financial state: the backend posts the expense, its
 * ledger entries, the balance change and any budget effect. None of that is
 * computed on this page — it sends the request and renders the answer.
 *
 * Discard (DELETE /ai/expense-captures/{id}) abandons the draft. It is the
 * opposite intent to Confirm and creates nothing: no transaction is deleted
 * or reversed, no balance and no budget move. `discarded` is a final state
 * and the record stays, readable and auditable.
 */
export default function AiExpenseCaptureDetails() {
  const { captureId } = useParams();
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const location = useLocation();

  // The list's filters and page, so Back returns to the same view.
  const [listSearch] = useState(() => location.state?.from ?? "");
  const listPath = `${PATH.USER.AI_EXPENSE_CAPTURES}${listSearch}`;

  /*
   * `key` ties a result to the request that produced it. While it doesn't
   * match the current request the page is loading, so another capture's
   * details are never shown under this id.
   */
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${captureId}:${reloadKey}`;
  const [result, setResult] = useState({
    key: null,
    capture: null,
    error: null,
    // The transaction Confirm returned, for showing it without another fetch.
    transaction: null,
  });

  /*
   * One Idempotency-Key per logical retry. Sprint 7 does not require one here
   * and retry creates nothing, so this is not a dependency — it just means a
   * retry pressed again after a timeout replays the original request instead
   * of queuing the capture a second time. The shared attempt helper, not a
   * second idempotency system.
   */
  const [retryAttempt] = useState(() => createIdempotentAttempt(RETRY_ATTEMPT_PREFIX));

  /*
   * One Idempotency-Key per logical confirmation, and this one is mandatory:
   * Confirm creates money. The shared attempt keeps the key across a timeout,
   * a dropped connection, a 5xx or a rate limit, so retrying the same intent
   * replays the original request instead of posting a second expense. It is
   * retired only on success or a definitive refusal, after which a genuinely
   * new confirmation gets a new key.
   */
  const [confirmAttempt] = useState(() => createIdempotentAttempt(CONFIRM_ATTEMPT_PREFIX));

  /*
   * One key per logical discard. Optional here, exactly as for retry — the
   * contract does not require one and discard creates nothing — but it makes
   * a retry after a timeout the same request rather than a second
   * destructive one.
   */
  const [discardAttempt] = useState(() => createIdempotentAttempt(DISCARD_ATTEMPT_PREFIX));

  /*
   * The reviewed draft the user is editing.
   *
   * It lives here rather than inside the form because Confirm has to save it
   * before it posts — the backend confirms the draft it already holds — and
   * then confirm against the `review_version` that save returned. A draft
   * hidden inside the form would be invisible to Confirm.
   *
   * Derived by key rather than reset in an effect: a new fetch reseeds from
   * the server's copy (which is what "Reload latest" means), while a PATCH,
   * which shares the key, leaves what the user typed alone.
   */
  const [draftState, setDraftState] = useState({ key: null, values: null });
  // Field errors the backend raised about the SAVED draft while confirming.
  const [confirmErrors, setConfirmErrors] = useState({});
  /*
   * One lock for every write this page can make — Save, Retry, Confirm and
   * Discard. Whichever is in flight holds it, and the others are disabled, so
   * two of them can never race over the same capture. One mechanism, not a
   * flag per action.
   */
  const [isActionBusy, setIsActionBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    aiExpenseCapturesApi
      .get(captureId, { signal: controller.signal })
      .then((response) => {
        const capture = parseCaptureResponse(response);

        setResult(
          capture
            ? { key: requestKey, capture, error: null, transaction: null }
            : {
                key: requestKey,
                capture: null,
                transaction: null,
                error: new ApiError("", { code: "MALFORMED_RESPONSE" }),
              },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setResult({ key: requestKey, capture: null, transaction: null, error });
      });

    return () => controller.abort();
  }, [captureId, requestKey]);

  /*
   * Accounts and categories for the review draft: a name for each id when the
   * capture is read-only, and the options themselves once it is editable.
   * These are the existing read-only lists — no new endpoint, and nothing
   * financial is touched by reading them.
   *
   * The filters are the ones those endpoints already document: the session's
   * workspace, and expense categories only, so an income category can never
   * be offered for an expense. Both lists return active records.
   */
  const [optionsKey, setOptionsKey] = useState(0);
  const [options, setOptions] = useState({
    key: null,
    accounts: [],
    categories: [],
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const workspaceId = getStoredWorkspace()?.id;

    Promise.all([
      accountsApi.list({ id_workspace: workspaceId }, { signal }),
      categoriesApi.list({ workspace_id: workspaceId, type: "expense" }, { signal }),
    ])
      .then(([accountsResponse, categoriesResponse]) => {
        setOptions({
          key: optionsKey,
          accounts: accountsResponse.data?.accounts ?? [],
          categories: categoriesResponse.data?.categories ?? [],
          error: null,
        });
      })
      .catch((error) => {
        if (error.name === "AbortError" || signal.aborted) return;
        // The ids stay correct without the lists; the form says so and offers
        // a retry rather than blocking the page.
        setOptions({ key: optionsKey, accounts: [], categories: [], error });
      });

    return () => controller.abort();
  }, [optionsKey]);

  /*
   * While the backend still owes a result the capture changes on its own, so
   * the page re-reads it on a growing delay — the same shape as the imports
   * poller (`useImportStatus`), not a new polling framework.
   *
   * One timer and one request at a time: the next check is scheduled only
   * when this effect re-runs with a higher count, so checks can never
   * overlap. It stops as soon as the status leaves the in-flight set
   * (`ready_for_review`, `failed`, `confirmed`, `discarded`), on a fatal
   * error, at MAX_CAPTURE_POLLS, and on unmount or a change of capture — the
   * cleanup clears the timer and aborts the request in flight.
   */
  const [poll, setPoll] = useState(NO_POLL);
  // Derived, not reset in an effect: a different fetch is a different poll,
  // and it starts from zero.
  const pollState = poll.key === requestKey ? poll : NO_POLL;
  const pollCapture = result.key === requestKey ? result.capture : null;
  const isPolling = isCaptureInFlight(pollCapture) && !pollState.stopped;

  useEffect(() => {
    if (!isPolling) return undefined;

    const controller = new AbortController();
    // Counts this check whether it succeeded or not, so a failing poll still
    // walks towards the limit instead of retrying forever at the same delay.
    const advance = (patch) =>
      setPoll((current) => {
        const count = (current.key === requestKey ? current.count : 0) + 1;
        return { key: requestKey, count, stopped: count >= MAX_CAPTURE_POLLS, ...patch(count) };
      });

    const timer = setTimeout(() => {
      aiExpenseCapturesApi
        .get(captureId, { signal: controller.signal })
        .then((response) => {
          const next = parseCaptureResponse(response);
          if (!next) throw new ApiError("", { code: "MALFORMED_RESPONSE" });

          /*
           * A full GET is the whole record, so it REPLACES the capture rather
           * than being merged into it. Reprocessing can change
           * `ai_suggested_values`, `warnings` and `review_values`, and
           * keeping the previous ones would show a result the backend has
           * already thrown away. (Only the partial PATCH and Retry responses
           * are merged.)
           */
          setResult((current) =>
            current.key === requestKey ? { ...current, capture: next } : current,
          );
          advance(() => ({ error: null }));
        })
        .catch((error) => {
          if (error.name === "AbortError" || controller.signal.aborted) return;

          advance((count) => ({
            error,
            stopped:
              CAPTURE_FATAL_POLL_CODES.includes(error.code) || count >= MAX_CAPTURE_POLLS,
          }));
        });
    }, getCapturePollDelay(pollState.count));

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [captureId, requestKey, isPolling, pollState.count]);

  const isLoading = result.key !== requestKey;
  const { capture, error } = isLoading ? { capture: null, error: null } : result;

  /*
   * Saves the reviewed draft. The payload is built by the form from the
   * fields that actually changed plus the newest `review_version` the
   * backend sent; nothing is added to it here.
   *
   * The response may be partial, so the returned fields are applied over the
   * capture instead of replacing it — `ai_suggested_values`, warnings and
   * every other GET-only field survive the save. `review_version` comes
   * back from the backend and is used as-is for the next save; it is never
   * incremented here.
   *
   * Errors are thrown on to the form, which owns the field errors, the
   * stale-version conflict and the retry.
   */
  const handleSave = async (payload) => {
    const response = await aiExpenseCapturesApi.update(capture.id, payload);
    const updated = parseCaptureResponse(response);

    // A capture that isn't the one just saved is a malformed answer, not
    // something to merge into this page.
    if (!updated || String(updated.id) !== String(capture.id)) {
      throw new ApiError("", { code: "MALFORMED_RESPONSE" });
    }

    const merged = mergeCaptureUpdate(capture, updated);

    setResult((current) =>
      current.key === requestKey ? { ...current, capture: merged } : current,
    );
    // The backend accepted the draft, so its complaints about it are stale.
    setConfirmErrors({});

    /*
     * Returned, not just stored: Confirm runs straight after this and needs
     * the NEW `review_version` now — a state update it cannot see yet.
     */
    return merged;
  };

  /*
   * Asks the backend to process this receipt again. It requeues AI work and
   * nothing else: no transaction, no ledger entry, no balance or budget
   * change, and no edit to the reviewed draft.
   *
   * The response may hold only `id` and `status`, so it is merged rather
   * than swapped in — `review_values`, `ai_suggested_values`,
   * `review_version`, warnings and source information all survive. The
   * status is applied exactly as it came: the frontend never advances the
   * lifecycle itself.
   *
   * Errors are thrown on to the button, which owns the in-flight guard and
   * the message.
   */
  const handleRetry = async () => {
    const idempotencyKey = retryAttempt.keyFor({ capture_id: capture.id });

    try {
      const response = await aiExpenseCapturesApi.retry(capture.id, { idempotencyKey });
      const updated = parseCaptureResponse(response);

      if (!updated || String(updated.id) !== String(capture.id)) {
        throw new ApiError("", { code: "MALFORMED_RESPONSE" });
      }

      retryAttempt.settle();

      setResult((current) =>
        current.key === requestKey
          ? { ...current, capture: mergeCaptureUpdate(current.capture, updated) }
          : current,
      );
      // A fresh requeue deserves fresh checks, even if an earlier run of them
      // had already given up.
      setPoll({ ...NO_POLL, key: requestKey });
    } catch (error) {
      retryAttempt.settle(error);

      /*
       * Retry sends no body, so a 422 can only mean the capture is no longer
       * `failed`. One GET to show where the lifecycle actually is — never
       * another POST, and never a stale screen left in place.
       */
      if (isLifecycleRejection(error)) setReloadKey((key) => key + 1);

      throw error;
    }
  };

  /*
   * Reads the capture again and replaces it with what the backend holds.
   *
   * This is a GET and only a GET: it answers "did that write actually land?"
   * without risking a second expense or a second discard. Shared by Confirm
   * and Discard rather than written twice. A full record replaces rather than
   * merges, so a capture the backend has since changed arrives complete.
   */
  const handleCheckStatus = async () => {
    const response = await aiExpenseCapturesApi.get(capture.id);
    const fresh = parseCaptureResponse(response);

    if (!fresh || String(fresh.id) !== String(capture.id)) {
      throw new ApiError("", { code: "MALFORMED_RESPONSE" });
    }

    // The write did land: that intent is over, so its key retires.
    if (captureHasTransaction(fresh)) confirmAttempt.settle();
    if (isCaptureDiscarded(fresh)) discardAttempt.settle();

    setResult((current) =>
      current.key === requestKey ? { ...current, capture: fresh } : current,
    );

    return fresh;
  };

  /*
   * Creates the expense. The only call on this page that moves money.
   *
   * Two steps, in this order and never the other way round:
   *
   * 1. Any unsaved edit is saved through the existing PATCH flow, because the
   *    backend confirms the draft it already holds. A stale
   *    `review_version` is never sent alongside unsaved edits — the version
   *    used is the one that save returned.
   * 2. Confirm carries `review_version` and nothing else. Every financial
   *    field comes from the saved draft, so no amount, account or currency is
   *    restated here.
   *
   * Nothing local is recalculated: no balance, no budget, no totals. The
   * backend returns the capture and the transaction it created, and that is
   * what the page shows.
   */
  const handleConfirm = async () => {
    let current = capture;

    // Reuses the save pipeline; PATCH logic is not duplicated here.
    const draftPayload = buildCaptureUpdatePayload(draft, capture);
    if (draftPayload) current = await handleSave(draftPayload);

    const body = buildCaptureConfirmPayload(current);
    // No usable version means nothing safe to confirm against.
    if (!body) throw new ApiError("", { code: "MALFORMED_RESPONSE" });

    // One key for this whole confirmation intent, kept across retries.
    const idempotencyKey = confirmAttempt.keyFor({ capture_id: capture.id });

    try {
      const response = await aiExpenseCapturesApi.confirm(capture.id, body, { idempotencyKey });
      const { capture: updated, transaction } = parseConfirmResponse(response);

      if (!updated || String(updated.id) !== String(capture.id)) {
        throw new ApiError("", { code: "MALFORMED_RESPONSE" });
      }

      confirmAttempt.settle();
      setConfirmErrors({});

      /*
       * The capture response may be partial, so it is merged: suggestions,
       * warnings and source information survive. A replay of the same key
       * returns the same transaction, which is a success like any other —
       * never a duplicate to reject.
       */
      setResult((c) =>
        c.key === requestKey
          ? {
              ...c,
              capture: mergeCaptureUpdate(current, updated),
              transaction: transaction ?? c.transaction,
            }
          : c,
      );
    } catch (error) {
      // Keeps the key for anything ambiguous; retires it on a definitive no.
      confirmAttempt.settle(error);

      const kind = getConfirmErrorKind(error);

      // The saved draft was refused: the messages belong on its fields.
      if (kind === "fields") setConfirmErrors(getConfirmFieldErrors(error));

      /*
       * A 422 naming nothing this page renders almost certainly means the
       * capture is no longer `ready_for_review`. One read to show where it
       * really is — never another POST. A stale `review_version` is
       * deliberately excluded: that one waits for the user to reload.
       */
      if (kind === "lifecycle") setReloadKey((key) => key + 1);

      throw error;
    }
  };

  /*
   * Abandons the draft.
   *
   * No body at all — the contract documents none, so no `reason`, no
   * `review_version` and no review values are sent. The draft is explicitly
   * NOT saved first: discarding is the opposite intent to confirming, and a
   * PATCH here would preserve values the user just said they do not want.
   *
   * Nothing financial happens, and nothing is deleted locally. The capture
   * moves to `discarded` and stays on screen with its suggestions, review
   * values and warnings — a final state, not a disappearance.
   */
  const handleDiscard = async () => {
    const idempotencyKey = discardAttempt.keyFor({ capture_id: capture.id });

    try {
      const response = await aiExpenseCapturesApi.discard(capture.id, { idempotencyKey });
      const updated = parseCaptureResponse(response);

      if (!updated || String(updated.id) !== String(capture.id)) {
        throw new ApiError("", { code: "MALFORMED_RESPONSE" });
      }

      discardAttempt.settle();

      /*
       * The response may hold only `id` and `status`, so it is merged:
       * everything the capture already carried survives and stays readable.
       */
      setResult((c) =>
        c.key === requestKey ? { ...c, capture: mergeCaptureUpdate(capture, updated) } : c,
      );
    } catch (error) {
      discardAttempt.settle(error);

      /*
       * DELETE sends no body, so a 422 can only mean the capture is no longer
       * discardable — most importantly, that it has been confirmed elsewhere.
       * One read to show the real state, never another DELETE. Nothing is
       * removed locally on a refusal: a failed discard can never take away a
       * `confirmed_transaction_id` or the transaction it points at.
       */
      if (isLifecycleRejection(error)) setReloadKey((key) => key + 1);

      throw error;
    }
  };

  const backLink = (
    <Link className="capture-details__back" to={listPath}>
      <LuArrowLeft aria-hidden="true" />
      <span>{t("dashboard.aiCaptures.details.back")}</span>
    </Link>
  );

  if (isLoading) {
    return (
      <div className="capture-details">
        {backLink}
        <Loading message={t("dashboard.aiCaptures.details.loading")} />
      </div>
    );
  }

  if (error) {
    // 401 never lands here: apiClient ends the session and AuthProvider
    // signs the user out.
    const isNotFound = error.code === "NOT_FOUND";
    const isForbidden = error.code === "FORBIDDEN";
    const titleKey = isNotFound ? "notFoundTitle" : isForbidden ? "forbiddenTitle" : "errorTitle";
    // A 403 or 404 won't change on a retry: only the transport errors will.
    const canRetry = !isNotFound && !isForbidden;

    return (
      <div className="capture-details">
        {backLink}

        <div className="capture-details__state" role="alert">
          <h1>{t(`dashboard.aiCaptures.details.${titleKey}`)}</h1>
          <p dir="auto">
            {isNotFound
              ? t("dashboard.aiCaptures.details.notFoundMessage")
              : isForbidden
                ? t("dashboard.aiCaptures.details.forbiddenMessage")
                : getApiErrorMessage(error, t)}
          </p>

          {canRetry && (
            <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
              {t("common.retry")}
            </button>
          )}
        </div>
      </div>
    );
  }

  const status = getCaptureStatus(capture);
  const reviewVersion = getReviewVersion(capture);

  /*
   * The draft values. Seeded from `review_values` — never from
   * `ai_suggested_values` — and kept across a save, reseeded on a reload.
   */
  const draft =
    draftState.key === requestKey && draftState.values
      ? draftState.values
      : toCaptureFormValues(capture);

  const handleDraftChange = (values) => {
    setDraftState({ key: requestKey, values });
    // The backend judged the draft as it was; a changed field is not that.
    setConfirmErrors({});
  };

  const eligibleAccounts = getEligibleAccounts(options.accounts);
  const draftAccount =
    eligibleAccounts.find((account) => String(account.id) === draft.account_id) ?? null;
  const isDraftDirty = isCaptureFormDirty(draft, capture);

  /*
   * What still stands between this draft and a real expense: fields an
   * expense cannot exist without, plus anything the form's own validation
   * rejects. Saving a draft and confirming an expense are different bars —
   * a draft may be incomplete, an expense may not.
   */
  const confirmBlockers = [
    ...new Set([
      ...getConfirmBlockers(draft),
      ...Object.keys(validateCaptureForm(draft, { t, account: draftAccount })),
    ]),
  ];
  const warnings = getCaptureWarnings(capture);
  const transactionId = getConfirmedTransactionId(capture);
  /*
   * The receipt's signed URL, when the response carries one. The `/source`
   * route can only be reached with a signature the backend produced, so with
   * no URL the section is not rendered at all — an unsigned request would be
   * refused, and a button that cannot work is worse than none.
   */
  const sourceUrl = getCaptureSourceUrl(capture);
  const sourceTypeKey = `dashboard.aiCaptures.sourceTypes.${capture.source_type}`;

  /*
   * One line explaining what this status means for the user. Which one is
   * shown comes from the shared lifecycle helpers, never from a status
   * comparison invented here.
   *
   * The in-flight statuses each get their own wording — waiting to be queued,
   * queued, actually being read — so a receipt that moves while the page is
   * open says what changed rather than holding one generic line.
   */
  const isInFlight = isCaptureProcessing(status);
  const note = isInFlight
    ? { key: status, Icon: LuClock, tone: "info" }
    : status === AI_CAPTURE_STATUS.FAILED
      ? { key: "failed", Icon: LuTriangleAlert, tone: "danger" }
      : status === AI_CAPTURE_STATUS.CONFIRMED
        ? { key: "confirmed", Icon: LuInfo, tone: "success" }
        : status === AI_CAPTURE_STATUS.DISCARDED
          ? { key: "discarded", Icon: LuInfo, tone: "muted" }
          : null;

  /*
   * The transaction Confirm returned, if this page is the one that created
   * it. A capture fetched later carries only `confirmed_transaction_id`, and
   * the link alone is then what is shown — nothing is invented to fill the
   * gap.
   */
  const transaction = result.transaction;
  const transactionFields = !transaction
    ? []
    : [
        transaction.type && [
          "type",
          <bdi key="type" dir="auto">
            {translateEnum(t, i18n, "dashboard.transactions.types", transaction.type)}
          </bdi>,
        ],
        transaction.status && [
          "status",
          <bdi key="tx-status" dir="auto">
            {translateEnum(t, i18n, "dashboard.transactions.statuses", transaction.status)}
          </bdi>,
        ],
        transaction.amount != null && [
          "amount",
          <bdi key="amount" dir="ltr">
            {formatMoney(transaction.amount, transaction.currency_code, locale)}
          </bdi>,
        ],
        transaction.source && [
          "source",
          <bdi key="source" dir="auto">{humanizeCaptureField(transaction.source)}</bdi>,
        ],
      ].filter(Boolean);

  const summary = [
    ["status", <CaptureStatusBadge key="status" status={status} />],
    capture.source_type && [
      "sourceType",
      <bdi key="source" dir="auto">
        {i18n.exists(sourceTypeKey) ? t(sourceTypeKey) : humanizeCaptureField(capture.source_type)}
      </bdi>,
    ],
    [
      "reviewVersion",
      // A missing version stays unavailable; it is never defaulted to 0.
      reviewVersion == null ? (
        <span key="version" className="capture-details__unavailable">
          {t("dashboard.aiCaptures.details.unavailable")}
        </span>
      ) : (
        <bdi key="version" dir="ltr">{reviewVersion}</bdi>
      ),
    ],
  ].filter(Boolean);

  return (
    <div className="capture-details">
      {backLink}

      <header className="capture-details__header">
        <span className="capture-details__icon" aria-hidden="true">
          <LuReceiptText />
        </span>

        <div className="capture-details__identity">
          <h1>{t("dashboard.aiCaptures.row.title", { id: capture.id })}</h1>
          <CaptureStatusBadge status={status} />
        </div>
      </header>

      {note && (
        <p
          className={`capture-details__note capture-details__note--${note.tone}`}
          /* While the backend is working the line changes on its own, so it is
             a live region; a settled status is just a note. */
          role={isInFlight ? "status" : "note"}
        >
          <note.Icon aria-hidden="true" />
          <span>{t(`dashboard.aiCaptures.details.notes.${note.key}`)}</span>
        </p>
      )}

      {/*
        * The checks stopped while the backend is still working. That says
        * nothing about the capture — its status is still whatever the backend
        * holds — so nothing is marked failed here; the user is simply given
        * the check back.
        */}
      {isInFlight && pollState.stopped && (
        <div className="capture-details__stalled" role="status">
          <p>{t("dashboard.aiCaptures.processing.stalled")}</p>

          <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
            <LuRefreshCw aria-hidden="true" />
            {t("dashboard.aiCaptures.processing.refresh")}
          </button>
        </div>
      )}

      {/* Renders only for a `failed` capture; the rule lives in the
          component's own `canRetryCapture` check, not in this page. */}
      <CaptureRetry
        status={status}
        onRetry={handleRetry}
        onRefreshStatus={() => setReloadKey((key) => key + 1)}
        isBusy={isActionBusy}
        onBusyChange={setIsActionBusy}
      />

      <section className="capture-details__panel" aria-labelledby="capture-summary-title">
        <h2 id="capture-summary-title">{t("dashboard.aiCaptures.details.summary.title")}</h2>

        <dl className="capture-details__list">
          {summary.map(([key, value]) => (
            <div className="capture-details__row" key={key}>
              <dt>{t(`dashboard.aiCaptures.details.summary.${key}`)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {sourceUrl && (
        <CaptureSource
          /* A refreshed signature is a different link: remount, so the blob
             of the previous one is revoked and nothing stale is shown. */
          key={sourceUrl}
          sourceUrl={sourceUrl}
          /* A fresh capture fetch is the only way to get a newly signed URL;
             the frontend can never re-sign an expired one. */
          onRefreshLink={() => setReloadKey((key) => key + 1)}
          isRefreshing={isLoading}
        />
      )}

      <AiSuggestions capture={capture} />

      {/* Renders only for a `ready_for_review` capture; the rule lives in
          the component's own `canConfirmCapture` check. */}
      <CaptureConfirm
        capture={capture}
        /* The reviewed draft, which is what will be recorded — never the AI's
           suggestions. */
        values={draft}
        accounts={options.accounts}
        categories={options.categories}
        blockers={confirmBlockers}
        isDraftDirty={isDraftDirty}
        onConfirm={handleConfirm}
        onCheckStatus={handleCheckStatus}
        onReloadLatest={() => setReloadKey((key) => key + 1)}
        isBusy={isActionBusy}
        onBusyChange={setIsActionBusy}
      />

      <ReviewValues
        /* A reloaded capture is a new draft: remount so the form's own state
           (touched fields, save errors) starts clean too. */
        key={requestKey}
        capture={capture}
        form={draft}
        onFormChange={handleDraftChange}
        externalErrors={confirmErrors}
        isLocked={isActionBusy}
        onBusyChange={setIsActionBusy}
        accounts={options.accounts}
        categories={options.categories}
        /* Only a capture the AI has finished with may be edited, and the rule
           comes from the shared helper rather than a status compared here. */
        isEditable={canReviewCapture(status)}
        isLoadingOptions={options.key !== optionsKey}
        optionsError={options.error}
        onRetryOptions={() => setOptionsKey((key) => key + 1)}
        onSave={handleSave}
        /* An explicit reload: the page refetches and the form is rebuilt from
           the server's draft, discarding unsaved edits. */
        onReloadLatest={() => setReloadKey((key) => key + 1)}
      />

      {/* Renders only for a discardable draft; the rule lives in the
          component's own `canDiscardCapture` check. Never for `confirmed`,
          so discarding can never reach a capture that holds money. */}
      <CaptureDiscard
        capture={capture}
        hasUnsavedChanges={isDraftDirty}
        isBusy={isActionBusy}
        onDiscard={handleDiscard}
        onCheckStatus={handleCheckStatus}
        onBusyChange={setIsActionBusy}
      />

      {/* Only rendered when the backend actually sent warnings. */}
      {warnings.length > 0 && (
        <section
          className="capture-details__panel capture-details__panel--warnings"
          aria-labelledby="capture-warnings-title"
        >
          <h2 id="capture-warnings-title">
            <LuTriangleAlert aria-hidden="true" />
            {t("dashboard.aiCaptures.details.warnings.title")}
          </h2>

          <ul className="capture-details__warnings">
            {warnings.map((warning) => (
              <li key={warning} dir="auto">{warning}</li>
            ))}
          </ul>
        </section>
      )}

      {/* The capture created a transaction: the one state where money exists. */}
      {captureHasTransaction(capture) && (
        <section className="capture-details__panel" aria-labelledby="capture-transaction-title">
          <h2 id="capture-transaction-title">
            {t("dashboard.aiCaptures.details.transaction.title")}
          </h2>

          {transactionId == null ? (
            <p className="capture-details__unavailable">
              {t("dashboard.aiCaptures.details.transaction.unavailable")}
            </p>
          ) : (
            <dl className="capture-details__list">
              <div className="capture-details__row">
                <dt>{t("dashboard.aiCaptures.details.transaction.id")}</dt>
                <dd>
                  <Link to={getTransactionDetailsPath(transactionId)}>
                    <bdi dir="ltr">#{transactionId}</bdi>
                  </Link>
                </dd>
              </div>

              {/*
                * Straight from the confirm response, when this page is the
                * one that created it. Values are shown exactly as the backend
                * sent them — nothing here recomputes a balance or a total.
                */}
              {transactionFields.map(([key, value]) => (
                <div className="capture-details__row" key={key}>
                  <dt>{t(`dashboard.aiCaptures.details.transaction.${key}`)}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      )}
    </div>
  );
}
