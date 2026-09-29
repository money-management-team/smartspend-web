import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import {
  LuArchive,
  LuArrowLeft,
  LuCircleCheck,
  LuInfo,
  LuPause,
  LuPencil,
  LuPlay,
  LuSkipForward,
  LuX,
} from "react-icons/lu";

import Loading from "../../../../components/Loading/Loading";
import { useAuthContext } from "../../../../contexts/auth/useAuthContext";
import {
  PATH,
  getAccountDetailsPath,
  getCategoryDetailsPath,
  getTransactionDetailsPath,
} from "../../../../routes/Path";
import { ApiError } from "../api/apiClient";
import { recurringTransactionsApi } from "../api/recurringTransactionsApi";
import { getDisplayLocale } from "../Accounts/accountHelpers";
import { translateEnum } from "../FinancialOperations/transactionHelpers";
import RecurringActionDialog from "../Recurring/components/RecurringActionDialog/RecurringActionDialog";
import RecurringBadge from "../Recurring/components/RecurringBadge/RecurringBadge";
import RecurringForm from "../Recurring/components/RecurringForm/RecurringForm";
import RecurringOccurrences from "../Recurring/components/RecurringOccurrences/RecurringOccurrences";
import {
  getRecurringErrorMessage,
  getRuleActions,
  getRuleCurrency,
  getRuleStatus,
  getRuleType,
  getSchedule,
  isOverdueOccurrence,
  isRuleEntity,
  mergeRule,
  toDateOnly,
} from "../Recurring/recurringHelpers";
import { formatDate, formatDateTime, formatMoney } from "../utils/formatters";

import "./RecurringDetails.css";

// Request of each dialog action. Only "confirm" moves money.
const ACTION_REQUESTS = {
  pause: (ruleId) => recurringTransactionsApi.pause(ruleId),
  resume: (ruleId) => recurringTransactionsApi.resume(ruleId),
  archive: (ruleId) => recurringTransactionsApi.archive(ruleId),
  confirm: (ruleId) => recurringTransactionsApi.confirmNext(ruleId),
  skip: (ruleId, reason) => recurringTransactionsApi.skipNext(ruleId, reason),
};

/*
 * One recurring rule (GET /recurring-transactions/{id}) with its schedule,
 * next occurrence and occurrence history. Every write returns the rule in its
 * new state (`data.recurring_transaction`), which replaces what is shown; the
 * rule is then read again (for the recalculated schedule) and so is the
 * history. Next due dates, statuses and balances are never computed here.
 * Archiving keeps the page on the now read-only rule.
 */
export default function RecurringDetails() {
  const { recurringTransactionId } = useParams();
  const { t, i18n } = useTranslation();
  const { user, workspace } = useAuthContext();
  const locale = getDisplayLocale(i18n.language);
  const timeZone = user?.timezone ?? workspace?.timezone;

  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${recurringTransactionId}:${reloadKey}`;
  const [result, setResult] = useState({ key: null, rule: null, error: null });
  // "edit" | "pause" | "resume" | "archive" | "confirm" | "skip"
  const [dialog, setDialog] = useState(null);
  // One-time message: { key, type, name, transactionId } for the current request.
  const [notice, setNotice] = useState({ key: null, type: null, name: "", transactionId: null });
  // Bumped after every action, so the history is read again.
  const [historyKey, setHistoryKey] = useState(0);
  const saveRequestRef = useRef(null);
  const refreshControllerRef = useRef(null);
  // Set when an action failed in a way that may leave the page out of date.
  const staleRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    recurringTransactionsApi
      .get(recurringTransactionId, { signal: controller.signal })
      .then((response) => {
        const rule = response?.data?.recurring_transaction;
        setResult(
          isRuleEntity(rule)
            ? { key: requestKey, rule, error: null }
            : { key: requestKey, rule: null, error: new ApiError("", { code: "MALFORMED_RESPONSE" }) },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setResult({ key: requestKey, rule: null, error });
      });

    return () => controller.abort();
  }, [recurringTransactionId, requestKey]);

  useEffect(() => () => refreshControllerRef.current?.abort(), []);

  const isLoading = result.key !== requestKey;
  const { rule, error } = isLoading ? { rule: null, error: null } : result;

  const reload = () => setReloadKey((key) => key + 1);

  // Reads the rule again without leaving the page (after a write, for the
  // schedule the backend recalculated). A failure keeps what is shown.
  const refreshRule = () => {
    refreshControllerRef.current?.abort();
    const controller = new AbortController();
    const key = requestKey;
    refreshControllerRef.current = controller;

    recurringTransactionsApi
      .get(recurringTransactionId, { signal: controller.signal })
      .then((response) => {
        const fresh = response?.data?.recurring_transaction;
        if (!isRuleEntity(fresh, recurringTransactionId)) return;
        setResult((current) =>
          current.key === key && current.rule ? { ...current, rule: mergeRule(current.rule, fresh) } : current,
        );
      })
      .catch(() => {
        // The rule the write returned is still shown.
      })
      .finally(() => {
        if (refreshControllerRef.current === controller) refreshControllerRef.current = null;
      });
  };

  // Shows the rule a write returned, then refreshes it and the history.
  const applyRule = (nextRule) => {
    if (isRuleEntity(nextRule, recurringTransactionId)) {
      setResult((current) => ({ ...current, rule: mergeRule(current.rule, nextRule) }));
      refreshRule();
    } else {
      reload();
    }
    setHistoryKey((key) => key + 1);
  };

  const showNotice = (type, name, transactionId = null) =>
    setNotice({ key: requestKey, type, name, transactionId });

  const closeDialog = () => {
    setDialog(null);

    if (staleRef.current) {
      staleRef.current = false;
      reload();
    }
  };

  /* ---------- Edit ---------- */

  const handleSave = async (payload) => {
    if (saveRequestRef.current) return saveRequestRef.current;

    const saveRequest = (async () => {
      let response;

      try {
        response = await recurringTransactionsApi.update(rule.id, payload);
      } catch (requestError) {
        if (["NOT_FOUND", "CONFLICT"].includes(requestError?.code)) staleRef.current = true;
        throw requestError;
      }

      const updated = response?.data?.recurring_transaction;
      applyRule(updated);
      setDialog(null);
      showNotice("updateSuccess", updated?.name ?? payload.name ?? rule.name);
    })();

    saveRequestRef.current = saveRequest;

    try {
      return await saveRequest;
    } finally {
      saveRequestRef.current = null;
    }
  };

  /* ---------- Actions ---------- */

  // Called by RecurringActionDialog; errors are shown inside the dialog.
  const handleAction = async (reason) => {
    const action = dialog;
    const response = await ACTION_REQUESTS[action](rule.id, reason);

    staleRef.current = false;
    applyRule(response?.data?.recurring_transaction);
    setDialog(null);
    showNotice(
      `${action}Success`,
      response?.data?.recurring_transaction?.name ?? rule.name,
      action === "confirm" ? (response?.data?.occurrence?.transaction_id ?? null) : null,
    );
  };

  /* ---------- Render ---------- */

  const backLink = (
    <Link className="recurring-details__back" to={PATH.USER.RECURRING}>
      <LuArrowLeft aria-hidden="true" />
      <span>{t("dashboard.recurring.details.back")}</span>
    </Link>
  );

  if (isLoading) {
    return (
      <div className="recurring-details">
        {backLink}
        <Loading message={t("dashboard.recurring.details.loading")} />
      </div>
    );
  }

  if (error) {
    const isNotFound = error.code === "NOT_FOUND";

    return (
      <div className="recurring-details">
        {backLink}
        <div className="recurring-details__state" role="alert">
          <h1>
            {t(isNotFound ? "dashboard.recurring.details.notFoundTitle" : "dashboard.recurring.details.errorTitle")}
          </h1>
          <p>{getRecurringErrorMessage(error, t)}</p>
          {!isNotFound && (
            <button type="button" onClick={reload}>
              {t("common.retry")}
            </button>
          )}
        </div>
      </div>
    );
  }

  const status = getRuleStatus(rule);
  const type = getRuleType(rule);
  const actions = getRuleActions(rule);
  const currency = getRuleCurrency(rule);
  const { known: scheduleKnown, next, openCount } = getSchedule(rule);
  const interval = Number(rule.interval) || 1;

  const money = (value, valueCurrency = currency) =>
    value == null || value === "" ? "—" : <bdi dir="ltr">{formatMoney(value, valueCurrency || undefined, locale)}</bdi>;
  const date = (value) => (value ? <bdi>{formatDate(toDateOnly(value) || value, locale)}</bdi> : "—");
  const dateTime = (value) => (value ? <bdi>{formatDateTime(value, locale, timeZone)}</bdi> : "—");
  const linked = (entity, fallbackId, getPath) => {
    const id = entity?.id ?? fallbackId;
    const name = entity?.name ?? (id != null ? `#${id}` : null);
    if (name == null) return "—";
    return id != null ? (
      <Link to={getPath(id)}>
        <bdi>{name}</bdi>
      </Link>
    ) : (
      <bdi>{name}</bdi>
    );
  };

  const frequencyLabel = ["weekly", "monthly", "yearly"].includes(rule.frequency)
    ? t(`dashboard.recurring.every.${rule.frequency}`, { count: interval })
    : translateEnum(t, i18n, "dashboard.recurring.frequencies", rule.frequency) || "—";

  const rows = [
    ["name", <bdi key="name">{rule.name}</bdi>],
    ["type", translateEnum(t, i18n, "dashboard.recurring.types", rule.type) || "—"],
    ["amount", money(rule.amount)],
    ["currency", <bdi key="currency" dir="ltr">{currency || "—"}</bdi>],
    ["account", linked(rule.account, rule.account_id, getAccountDetailsPath)],
    ["category", linked(rule.category, rule.category_id, getCategoryDetailsPath)],
    ["frequency", frequencyLabel],
    rule.anchor_day != null && ["anchorDay", <bdi key="anchor">{rule.anchor_day}</bdi>],
    ["startDate", date(rule.start_date)],
    ["endDate", rule.end_date ? date(rule.end_date) : t("dashboard.recurring.details.noEndDate")],
    [
      "maxOccurrences",
      rule.max_occurrences != null ? <bdi key="max">{rule.max_occurrences}</bdi> : t("dashboard.recurring.details.unlimited"),
    ],
    ["processingMode", translateEnum(t, i18n, "dashboard.recurring.processingModes", rule.processing_mode) || "—"],
    ["status", translateEnum(t, i18n, "dashboard.recurring.statuses", rule.status) || "—"],
    ["nextDueDate", status === "archived" || status === "completed" ? "—" : date(rule.next_due_date)],
    ["lastProcessedAt", dateTime(rule.last_processed_at)],
    rule.owner && ["owner", <bdi key="owner">{rule.owner.name ?? `#${rule.owner.id}`}</bdi>],
    rule.description && [
      "description",
      <span className="recurring-details__notes" dir="auto" key="description">
        {rule.description}
      </span>,
    ],
    rule.notes && [
      "notes",
      <span className="recurring-details__notes" dir="auto" key="notes">
        {rule.notes}
      </span>,
    ],
    rule.archived_at && ["archivedAt", dateTime(rule.archived_at)],
    rule.created_at && ["createdAt", dateTime(rule.created_at)],
    rule.updated_at && ["updatedAt", dateTime(rule.updated_at)],
  ].filter(Boolean);

  const noteKey =
    status === "archived"
      ? "archivedNote"
      : status === "paused"
        ? "pausedNote"
        : status === "completed"
          ? "completedNote"
          : status === "active"
            ? rule.processing_mode === "automatic"
              ? "automaticNote"
              : "manualNote"
            : null;

  return (
    <div className="recurring-details">
      {backLink}

      {notice.key === requestKey && (
        <div className="recurring-details__notice" role="status">
          <p dir="auto">
            {t(`dashboard.recurring.notices.${notice.type}`, { name: notice.name })}
            {notice.transactionId != null && (
              <>
                {" "}
                <Link to={getTransactionDetailsPath(notice.transactionId)}>
                  {t("dashboard.recurring.notices.viewTransaction")}
                </Link>
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => setNotice({ key: null, type: null, name: "", transactionId: null })}
            aria-label={t("common.close")}
          >
            <LuX aria-hidden="true" />
          </button>
        </div>
      )}

      <header className="recurring-details__header">
        <div className="recurring-details__identity">
          <h1 dir="auto">{rule.name}</h1>
          <div className="recurring-details__chips">
            <span className={`recurring-details__type recurring-details__type--${type}`}>
              {translateEnum(t, i18n, "dashboard.recurring.types", rule.type)}
            </span>
            <RecurringBadge kind="status" value={rule.status} />
            <RecurringBadge kind="mode" value={rule.processing_mode} />
            <strong className={`recurring-details__amount recurring-details__amount--${type}`}>
              {type === "income" ? "+" : type === "expense" ? "-" : ""}
              {money(rule.amount)}
            </strong>
          </div>
        </div>

        <div className="recurring-details__actions">
          {actions.canEdit && (
            <button type="button" className="recurring-details__action" onClick={() => setDialog("edit")}>
              <LuPencil aria-hidden="true" />
              <span>{t("dashboard.recurring.actions.edit")}</span>
            </button>
          )}
          {actions.canPause && (
            <button type="button" className="recurring-details__action" onClick={() => setDialog("pause")}>
              <LuPause aria-hidden="true" />
              <span>{t("dashboard.recurring.actions.pause")}</span>
            </button>
          )}
          {actions.canResume && (
            <button type="button" className="recurring-details__action" onClick={() => setDialog("resume")}>
              <LuPlay aria-hidden="true" />
              <span>{t("dashboard.recurring.actions.resume")}</span>
            </button>
          )}
          {actions.canArchive && (
            <button
              type="button"
              className="recurring-details__action recurring-details__action--archive"
              onClick={() => setDialog("archive")}
            >
              <LuArchive aria-hidden="true" />
              <span>{t("dashboard.recurring.actions.archive")}</span>
            </button>
          )}
        </div>
      </header>

      {noteKey && (
        <p className={`recurring-details__note recurring-details__note--${status}`} role="note">
          <LuInfo aria-hidden="true" />
          <span>{t(`dashboard.recurring.details.${noteKey}`)}</span>
        </p>
      )}

      <section className="recurring-details__panel" aria-labelledby="recurring-next-title">
        <div className="recurring-details__panel-head">
          <h2 id="recurring-next-title">{t("dashboard.recurring.nextOccurrence.title")}</h2>
          {openCount != null && (
            <span className="recurring-details__open-count">
              {t("dashboard.recurring.nextOccurrence.openCount", { count: openCount })}
            </span>
          )}
        </div>

        {next ? (
          <dl className="recurring-details__stats">
            <div className="recurring-details__stat">
              <dt>{t("dashboard.recurring.fields.dueDate")}</dt>
              <dd>
                {date(next.due_date)}
                {isOverdueOccurrence(next) && <RecurringBadge kind="overdue" />}
              </dd>
            </div>
            <div className="recurring-details__stat">
              <dt>{t("dashboard.recurring.fields.status")}</dt>
              <dd>
                <RecurringBadge kind="occurrence" value={next.status} />
              </dd>
            </div>
            <div className="recurring-details__stat">
              <dt>{t("dashboard.recurring.fields.amount")}</dt>
              <dd>{money(next.amount ?? rule.amount, next.currency_code || currency)}</dd>
            </div>
            {next.attempts != null && (
              <div className="recurring-details__stat">
                <dt>{t("dashboard.recurring.fields.attempts")}</dt>
                <dd>
                  <bdi>{next.attempts}</bdi>
                </dd>
              </div>
            )}
            {next.failure_reason && (
              <div className="recurring-details__stat recurring-details__stat--wide">
                <dt>{t("dashboard.recurring.fields.failureReason")}</dt>
                <dd dir="auto">{next.failure_reason}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="recurring-details__empty">
            {t(
              scheduleKnown
                ? "dashboard.recurring.nextOccurrence.none"
                : "dashboard.recurring.nextOccurrence.unknown",
            )}
          </p>
        )}

        {(actions.canConfirm || actions.canSkip) && (
          <div className="recurring-details__occurrence-actions">
            {actions.canConfirm && (
              <button
                type="button"
                className="recurring-details__action recurring-details__action--primary"
                onClick={() => setDialog("confirm")}
              >
                <LuCircleCheck aria-hidden="true" />
                <span>
                  {t(
                    type === "income"
                      ? "dashboard.recurring.actions.confirmIncome"
                      : "dashboard.recurring.actions.confirmExpense",
                  )}
                </span>
              </button>
            )}
            {actions.canSkip && (
              <button type="button" className="recurring-details__action" onClick={() => setDialog("skip")}>
                <LuSkipForward aria-hidden="true" />
                <span>{t("dashboard.recurring.actions.skip")}</span>
              </button>
            )}
            <small>{t("dashboard.recurring.nextOccurrence.actionsHint")}</small>
          </div>
        )}
      </section>

      <section className="recurring-details__panel" aria-labelledby="recurring-details-title">
        <h2 id="recurring-details-title">{t("dashboard.recurring.details.title")}</h2>
        <dl className="recurring-details__list">
          {rows.map(([key, value]) => (
            <div className="recurring-details__row" key={key}>
              <dt>{t(`dashboard.recurring.fields.${key}`)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <RecurringOccurrences
        ruleId={rule.id}
        currency={currency}
        refreshKey={historyKey}
        timeZone={timeZone}
      />

      {dialog === "edit" && <RecurringForm rule={rule} onSave={handleSave} onClose={closeDialog} />}

      {dialog && dialog !== "edit" && (
        <RecurringActionDialog
          action={dialog}
          rule={rule}
          onConfirm={handleAction}
          onClose={closeDialog}
          onOutdated={() => {
            staleRef.current = true;
          }}
        />
      )}
    </div>
  );
}
