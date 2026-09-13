import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import {
  LuArchive,
  LuArrowLeft,
  LuInfo,
  LuMinus,
  LuPause,
  LuPencil,
  LuPlay,
  LuPlus,
  LuRefreshCw,
  LuX,
} from "react-icons/lu";

import Loading from "../../../../components/Loading/Loading";
import { useAuthContext } from "../../../../contexts/auth/useAuthContext";
import { PATH, getAccountDetailsPath } from "../../../../routes/Path";
import { ApiError } from "../api/apiClient";
import { savingsGoalsApi } from "../api/savingsGoalsApi";
import { getDisplayLocale } from "../Accounts/accountHelpers";
import { formatPercentage } from "../Budgets/budgetHelpers";
import { translateEnum } from "../FinancialOperations/transactionHelpers";
import { UNKNOWN_OUTCOME_CODES } from "../Transfers/transferHelpers";
import GoalActionDialog from "../SavingsGoals/components/GoalActionDialog/GoalActionDialog";
import GoalActivity from "../SavingsGoals/components/GoalActivity/GoalActivity";
import GoalMovementForm from "../SavingsGoals/components/GoalMovementForm/GoalMovementForm";
import GoalProgressBar from "../SavingsGoals/components/GoalProgressBar/GoalProgressBar";
import GoalStatusBadge from "../SavingsGoals/components/GoalStatusBadge/GoalStatusBadge";
import SavingsGoalForm from "../SavingsGoals/components/SavingsGoalForm/SavingsGoalForm";
import {
  GOAL_PROGRESS_STATUSES,
  getGoalActions,
  getGoalCurrency,
  getGoalErrorMessage,
  getGoalProgress,
  getGoalStatus,
  isGoalEntity,
  mergeGoal,
  toDateOnly,
  withFreshProgress,
} from "../SavingsGoals/savingsGoalHelpers";
import { formatDate, formatDateTime, formatMoney } from "../utils/formatters";

import "./SavingsGoalDetails.css";

const STALE_CODES = ["CONFLICT", "FORBIDDEN", ...UNKNOWN_OUTCOME_CODES];

// Lifecycle actions and the request each one sends.
const LIFECYCLE_REQUESTS = {
  pause: (goalId) => savingsGoalsApi.pause(goalId),
  resume: (goalId) => savingsGoalsApi.resume(goalId),
  archive: (goalId) => savingsGoalsApi.archive(goalId),
};

/*
 * One savings goal (GET /savings-goals/{id}) with the progress the backend
 * calculated from its savings account's ledger balance. Every write returns
 * the goal in its new state (`data.savings_goal`), which replaces what is
 * shown: saved amount, progress and lifecycle status are never calculated
 * here. "Refresh progress" calls GET …/progress and replaces only the
 * progress. Archiving keeps the page on the now read-only goal, since its
 * account and history are kept.
 */
export default function SavingsGoalDetails() {
  const { savingsGoalId } = useParams();
  const { t, i18n } = useTranslation();
  const { user, workspace } = useAuthContext();
  const locale = getDisplayLocale(i18n.language);
  const timeZone = user?.timezone ?? workspace?.timezone;

  // `key` ties a result to the request that produced it; while it doesn't
  // match the current request, the page is loading.
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${savingsGoalId}:${reloadKey}`;
  const [result, setResult] = useState({ key: null, goal: null, error: null });
  // "edit" | "contribution" | "withdrawal" | "pause" | "resume" | "archive"
  const [dialog, setDialog] = useState(null);
  // One-time success message ({ key, type, name, status }) for the current request.
  const [notice, setNotice] = useState({ key: null, type: null, name: "", status: null });
  const [progressState, setProgressState] = useState({
    key: null,
    isRefreshing: false,
    error: null,
    refreshed: false,
  });
  // Bumped after money moves, so the activity refetches.
  const [activityKey, setActivityKey] = useState(0);
  const saveRequestRef = useRef(null);
  const progressControllerRef = useRef(null);
  // Set when a write learns the page may be out of date (409, unknown
  // outcome…); the goal is refetched once the dialog showing the error closes.
  const staleRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    savingsGoalsApi
      .get(savingsGoalId, { signal: controller.signal })
      .then((response) => {
        const goal = response.data?.savings_goal;

        setResult(
          isGoalEntity(goal)
            ? { key: requestKey, goal, error: null }
            : {
                key: requestKey,
                goal: null,
                error: new ApiError("", { code: "MALFORMED_RESPONSE" }),
              },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setResult({ key: requestKey, goal: null, error });
      });

    return () => controller.abort();
  }, [savingsGoalId, requestKey]);

  // A progress refresh still running when the page goes away is dropped.
  useEffect(() => () => progressControllerRef.current?.abort(), []);

  const isLoading = result.key !== requestKey;
  const { goal, error } = isLoading ? { goal: null, error: null } : result;

  const reload = () => setReloadKey((key) => key + 1);

  // Once the goal is gone for this user (404), show the not-available state.
  const markUnavailable = (requestError) => {
    setDialog(null);
    setResult({ key: requestKey, goal: null, error: requestError });
  };

  // Edit / pause / resume / archive: a 404 means the goal is gone; a 409, 403
  // or an unknown outcome means the page may no longer show its real state.
  const handleWriteError = (requestError) => {
    if (requestError?.code === "NOT_FOUND") markUnavailable(requestError);
    else if (STALE_CODES.includes(requestError?.code)) staleRef.current = true;
  };

  // A failed contribution/withdrawal (even a 404, which may be about the
  // selected account rather than the goal) refetches the goal on close.
  const markStale = () => {
    staleRef.current = true;
  };

  const closeDialog = () => {
    setDialog(null);

    if (staleRef.current) {
      staleRef.current = false;
      reload();
    }
  };

  const showNotice = (type, name, status = null) =>
    setNotice({ key: requestKey, type, name, status });

  // GET /savings-goals/{id}/progress: only the progress is replaced.
  const refreshProgress = async () => {
    if (progressControllerRef.current) return;

    const controller = new AbortController();
    const key = requestKey;
    progressControllerRef.current = controller;
    setProgressState({ key, isRefreshing: true, error: null, refreshed: false });

    try {
      const response = await savingsGoalsApi.getProgress(savingsGoalId, { signal: controller.signal });
      const progress = response.data?.progress;

      if (!progress || typeof progress !== "object") {
        throw new ApiError("", { code: "MALFORMED_RESPONSE" });
      }

      setResult((current) =>
        current.key === key && current.goal
          ? { ...current, goal: withFreshProgress(current.goal, progress) }
          : current,
      );
      setProgressState({ key, isRefreshing: false, error: null, refreshed: true });
    } catch (requestError) {
      if (requestError.name === "AbortError" || controller.signal.aborted) return;

      if (requestError?.code === "NOT_FOUND") {
        markUnavailable(requestError);
        return;
      }

      setProgressState({ key, isRefreshing: false, error: requestError, refreshed: false });
    } finally {
      if (progressControllerRef.current === controller) progressControllerRef.current = null;
    }
  };

  // Shows the goal a write returned. Without its progress, the progress is
  // fetched; without a usable goal, everything is refetched. Nothing is
  // patched by hand.
  const applyGoal = (nextGoal) => {
    if (!isGoalEntity(nextGoal, savingsGoalId)) {
      reload();
      return;
    }

    setResult((current) => ({ ...current, goal: mergeGoal(current.goal, nextGoal) }));
    if (!nextGoal.progress) refreshProgress();
  };

  /* ---------- Edit ---------- */

  const handleSave = async (values) => {
    if (saveRequestRef.current) return saveRequestRef.current;

    const saveRequest = (async () => {
      let response;

      try {
        response = await savingsGoalsApi.update(goal.id, values);
      } catch (requestError) {
        handleWriteError(requestError);
        throw requestError;
      }

      const updatedGoal = response?.data?.savings_goal;
      // A new target can flip the status (achieved ↔ active): the backend's
      // goal is shown as is.
      applyGoal(updatedGoal);
      setDialog(null);
      showNotice("updateSuccess", updatedGoal?.name ?? values.name ?? goal.name);
    })();

    saveRequestRef.current = saveRequest;

    try {
      return await saveRequest;
    } finally {
      saveRequestRef.current = null;
    }
  };

  /* ---------- Contribution / withdrawal ---------- */

  // The response carries the goal after the money moved (progress and
  // status recalculated by the backend); the activity is refetched.
  const handleMovementCompleted = (type, data) => {
    staleRef.current = false;
    applyGoal(data?.savings_goal);
    setActivityKey((key) => key + 1);
    setDialog(null);
    showNotice(`${type}Success`, data?.savings_goal?.name ?? goal.name);
  };

  /* ---------- Pause / resume / archive ---------- */

  // Called by GoalActionDialog; errors are shown inside the dialog.
  const handleLifecycle = async (action) => {
    let response;

    try {
      response = await LIFECYCLE_REQUESTS[action](goal.id);
    } catch (requestError) {
      handleWriteError(requestError);
      throw requestError;
    }

    const nextGoal = response?.data?.savings_goal;
    // Resume may return "active" or "achieved": whatever the backend says.
    applyGoal(nextGoal);
    setDialog(null);
    showNotice(`${action}Success`, nextGoal?.name ?? goal.name, nextGoal?.status ?? null);
  };

  /* ---------- Render ---------- */

  const backLink = (
    <Link className="savings-goal-details__back" to={PATH.USER.SAVINGS_GOALS}>
      <LuArrowLeft aria-hidden="true" />
      <span>{t("dashboard.savingsGoals.details.back")}</span>
    </Link>
  );

  if (isLoading) {
    return (
      <div className="savings-goal-details">
        {backLink}
        <Loading message={t("dashboard.savingsGoals.details.loading")} />
      </div>
    );
  }

  if (error) {
    const isNotFound = error.code === "NOT_FOUND";

    return (
      <div className="savings-goal-details">
        {backLink}

        <div className="savings-goal-details__state" role="alert">
          <h1>
            {t(
              isNotFound
                ? "dashboard.savingsGoals.details.notFoundTitle"
                : "dashboard.savingsGoals.details.errorTitle",
            )}
          </h1>
          <p>{getGoalErrorMessage(error, t)}</p>

          {!isNotFound && (
            <button type="button" onClick={reload}>
              {t("common.retry")}
            </button>
          )}
        </div>
      </div>
    );
  }

  const progress = getGoalProgress(goal);
  const status = getGoalStatus(goal);
  const actions = getGoalActions(goal);
  const currency = getGoalCurrency(goal);
  const progressStatus = progress?.status;
  const percentage = formatPercentage(progress?.percentage_funded, locale);
  const deadlinePassed =
    progress?.deadline_passed === true && status !== "achieved" && status !== "archived";
  const showProgressState = progressState.key === requestKey;
  const isRefreshing = showProgressState && progressState.isRefreshing;

  const money = (value) =>
    value == null || value === "" ? "—" : <bdi dir="ltr">{formatMoney(value, currency, locale)}</bdi>;
  const count = (value) =>
    value == null || value === "" ? "—" : <bdi>{new Intl.NumberFormat(locale).format(Number(value))}</bdi>;
  const dateTime = (value) => <bdi>{formatDateTime(value, locale, timeZone)}</bdi>;

  const account = goal.account && typeof goal.account === "object" ? goal.account : null;
  const accountValue = account ? (
    <span className="savings-goal-details__account">
      {account.id != null ? (
        <Link to={getAccountDetailsPath(account.id)}>
          <bdi>{account.name ?? `#${account.id}`}</bdi>
        </Link>
      ) : (
        <bdi>{account.name}</bdi>
      )}
      <small>{t("dashboard.savingsGoals.details.accountHint")}</small>
    </span>
  ) : null;

  const daysRemaining = deadlinePassed
    ? t("dashboard.savingsGoals.deadlinePassed")
    : count(progress?.days_remaining);

  const rows = [
    ["name", <bdi key="name">{goal.name}</bdi>],
    ["targetAmount", money(goal.target_amount)],
    ["currency", <bdi key="currency" dir="ltr">{currency}</bdi>],
    [
      "targetDate",
      goal.target_date
        ? <bdi key="date">{formatDate(toDateOnly(goal.target_date), locale)}</bdi>
        : t("dashboard.savingsGoals.details.noTargetDate"),
    ],
    ["status", translateEnum(t, i18n, "dashboard.savingsGoals.status", goal.status) || "—"],
    progressStatus && [
      "progressStatus",
      translateEnum(t, i18n, "dashboard.savingsGoals.progressStatus", progressStatus),
    ],
    ["savingsAccount", accountValue ?? "—"],
    goal.achieved_at && ["achievedAt", dateTime(goal.achieved_at)],
    goal.archived_at && ["archivedAt", dateTime(goal.archived_at)],
    goal.notes && [
      "notes",
      <span className="savings-goal-details__notes" dir="auto" key="notes">
        {goal.notes}
      </span>,
    ],
    goal.created_at && ["createdAt", dateTime(goal.created_at)],
    goal.updated_at && ["updatedAt", dateTime(goal.updated_at)],
  ].filter(Boolean);

  const stats = progress
    ? [
        ["savedAmount", money(progress.saved_amount)],
        ["remainingAmount", money(progress.remaining_amount)],
        ["targetAmount", money(progress.target_amount)],
        ["contributionsCount", count(progress.contributions_count)],
        ["daysRemaining", daysRemaining],
      ]
    : [];

  const noteKey =
    status === "archived"
      ? "archivedNote"
      : status === "paused"
        ? "pausedNote"
        : status === "achieved"
          ? "achievedNote"
          : deadlinePassed
            ? "deadlineNote"
            : null;

  return (
    <div className="savings-goal-details">
      {backLink}

      {notice.key === requestKey && (
        <div className="savings-goal-details__notice" role="status">
          <p dir="auto">
            {t(`dashboard.savingsGoals.notices.${notice.type}`, {
              name: notice.name,
              status: translateEnum(t, i18n, "dashboard.savingsGoals.status", notice.status),
            })}
          </p>
          <button
            type="button"
            onClick={() => setNotice({ key: null, type: null, name: "", status: null })}
            aria-label={t("common.close")}
          >
            <LuX aria-hidden="true" />
          </button>
        </div>
      )}

      <header className="savings-goal-details__header">
        <div className="savings-goal-details__identity">
          <h1 dir="auto">{goal.name}</h1>

          <div className="savings-goal-details__chips">
            <GoalStatusBadge kind="lifecycle" status={goal.status} />
            {progressStatus && progressStatus !== goal.status && (
              <GoalStatusBadge kind="progress" status={progressStatus} />
            )}
            {deadlinePassed && (
              <span className="savings-goal-details__chip savings-goal-details__chip--danger">
                {t("dashboard.savingsGoals.deadlinePassed")}
              </span>
            )}
            <span className="savings-goal-details__chip">
              <bdi dir="ltr">{currency}</bdi>
            </span>
          </div>
        </div>

        <div className="savings-goal-details__actions">
          {actions.canContribute && (
            <button
              type="button"
              className="savings-goal-details__action savings-goal-details__action--primary"
              onClick={() => setDialog("contribution")}
            >
              <LuPlus aria-hidden="true" />
              <span>{t("dashboard.savingsGoals.actions.contribute")}</span>
            </button>
          )}
          {actions.canWithdraw && (
            <button type="button" className="savings-goal-details__action" onClick={() => setDialog("withdrawal")}>
              <LuMinus aria-hidden="true" />
              <span>{t("dashboard.savingsGoals.actions.withdraw")}</span>
            </button>
          )}
          {actions.canPause && (
            <button type="button" className="savings-goal-details__action" onClick={() => setDialog("pause")}>
              <LuPause aria-hidden="true" />
              <span>{t("dashboard.savingsGoals.actions.pause")}</span>
            </button>
          )}
          {actions.canResume && (
            <button type="button" className="savings-goal-details__action" onClick={() => setDialog("resume")}>
              <LuPlay aria-hidden="true" />
              <span>{t("dashboard.savingsGoals.actions.resume")}</span>
            </button>
          )}
          {actions.canEdit && (
            <button type="button" className="savings-goal-details__action" onClick={() => setDialog("edit")}>
              <LuPencil aria-hidden="true" />
              <span>{t("dashboard.savingsGoals.actions.edit")}</span>
            </button>
          )}
          {actions.canArchive && (
            <button
              type="button"
              className="savings-goal-details__action savings-goal-details__action--archive"
              onClick={() => setDialog("archive")}
            >
              <LuArchive aria-hidden="true" />
              <span>{t("dashboard.savingsGoals.actions.archive")}</span>
            </button>
          )}
        </div>
      </header>

      {noteKey && (
        <p className={`savings-goal-details__note savings-goal-details__note--${status}`} role="note">
          <LuInfo aria-hidden="true" />
          <span>{t(`dashboard.savingsGoals.details.${noteKey}`)}</span>
        </p>
      )}

      <section className="savings-goal-details__panel" aria-labelledby="savings-goal-progress-title">
        <div className="savings-goal-details__panel-head">
          <h2 id="savings-goal-progress-title">{t("dashboard.savingsGoals.details.progressTitle")}</h2>

          <button
            type="button"
            className="savings-goal-details__refresh"
            onClick={refreshProgress}
            disabled={isRefreshing}
            aria-busy={isRefreshing || undefined}
          >
            <LuRefreshCw aria-hidden="true" />
            <span>
              {t(
                isRefreshing
                  ? "dashboard.savingsGoals.details.refreshingProgress"
                  : "dashboard.savingsGoals.details.refreshProgress",
              )}
            </span>
          </button>
        </div>

        {showProgressState && progressState.error && (
          <p className="savings-goal-details__progress-error" role="alert">
            {getGoalErrorMessage(progressState.error, t)}
          </p>
        )}
        {showProgressState && progressState.refreshed && (
          <p className="savings-goal-details__progress-ok" role="status">
            {t("dashboard.savingsGoals.details.progressRefreshed")}
          </p>
        )}

        {progress ? (
          <>
            <div className="savings-goal-details__meter">
              <div className="savings-goal-details__meter-copy">
                {progressStatus && <GoalStatusBadge kind="progress" status={progressStatus} />}
                {GOAL_PROGRESS_STATUSES.includes(progressStatus) && (
                  <p>{t(`dashboard.savingsGoals.progressHints.${progressStatus}`)}</p>
                )}
              </div>
              <strong className="savings-goal-details__percent">
                <bdi>{percentage}</bdi>
                <small>{t("dashboard.savingsGoals.fields.percentageFunded")}</small>
              </strong>
            </div>

            <GoalProgressBar
              percentage={progress.percentage_funded}
              status={progressStatus}
              label={t("dashboard.savingsGoals.fields.percentageFunded")}
              valueText={percentage}
              size="lg"
            />

            <dl className="savings-goal-details__stats">
              {stats.map(([key, value]) => (
                <div className="savings-goal-details__stat" key={key}>
                  <dt>{t(`dashboard.savingsGoals.fields.${key}`)}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <p className="savings-goal-details__empty">{t("dashboard.savingsGoals.details.noProgress")}</p>
        )}
      </section>

      <GoalActivity goalId={goal.id} currency={currency} refreshKey={activityKey} />

      <section className="savings-goal-details__panel" aria-labelledby="savings-goal-details-title">
        <h2 id="savings-goal-details-title">{t("dashboard.savingsGoals.details.title")}</h2>

        <dl className="savings-goal-details__list">
          {rows.map(([key, value]) => (
            <div className="savings-goal-details__row" key={key}>
              <dt>{t(`dashboard.savingsGoals.fields.${key}`)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {dialog === "edit" && actions.canEdit && (
        <SavingsGoalForm goal={goal} onSave={handleSave} onClose={closeDialog} />
      )}

      {(dialog === "contribution" && actions.canContribute) ||
      (dialog === "withdrawal" && actions.canWithdraw) ? (
        <GoalMovementForm
          type={dialog}
          goal={goal}
          onCompleted={(data) => handleMovementCompleted(dialog, data)}
          onOutdated={markStale}
          onClose={closeDialog}
        />
      ) : null}

      {["pause", "resume", "archive"].includes(dialog) &&
        (dialog === "pause" ? actions.canPause : dialog === "resume" ? actions.canResume : actions.canArchive) && (
          <GoalActionDialog
            action={dialog}
            goal={goal}
            onConfirm={() => handleLifecycle(dialog)}
            onClose={closeDialog}
            onWithdraw={actions.canWithdraw ? () => setDialog("withdrawal") : undefined}
          />
        )}
    </div>
  );
}
