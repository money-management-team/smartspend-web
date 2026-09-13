import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  LuArchive,
  LuArrowLeft,
  LuInfo,
  LuPencil,
  LuRefreshCw,
  LuX,
} from "react-icons/lu";

import Loading from "../../../../components/Loading/Loading";
import { useAuthContext } from "../../../../contexts/auth/useAuthContext";
import { PATH, getCategoryDetailsPath } from "../../../../routes/Path";
import { ApiError } from "../api/apiClient";
import { budgetsApi } from "../api/budgetsApi";
import { getDisplayLocale, isNegativeMoney } from "../Accounts/accountHelpers";
import { isActiveCategory } from "../Categories/categoryHelpers";
import BudgetForm from "../Budgets/components/BudgetForm/BudgetForm";
import ArchiveBudgetDialog from "../Budgets/components/ArchiveBudgetDialog/ArchiveBudgetDialog";
import BudgetProgressBar from "../Budgets/components/BudgetProgressBar/BudgetProgressBar";
import BudgetStatusBadge from "../Budgets/components/BudgetStatusBadge/BudgetStatusBadge";
import {
  BUDGET_PROGRESS_STATUSES,
  canManageBudget,
  formatPercentage,
  getBudgetErrorMessage,
  getBudgetProgress,
  getBudgetScope,
  getPeriodState,
  isArchivedBudget,
  isBudgetEntity,
  mergeBudget,
  toPeriodDate,
  withFreshProgress,
} from "../Budgets/budgetHelpers";
import { formatDate, formatDateTime, formatMoney } from "../utils/formatters";

import "./BudgetDetails.css";

/*
 * One budget (GET /budgets/{id}) with the progress the backend calculated.
 * "Refresh progress" calls GET /budgets/{id}/progress and replaces only the
 * progress. Edit (PATCH) returns the recalculated progress; Archive (DELETE)
 * keeps the page on the now read-only budget, since its history is kept.
 */
export default function BudgetDetails() {
  const { budgetId } = useParams();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { user, workspace } = useAuthContext();
  const locale = getDisplayLocale(i18n.language);
  const timeZone = user?.timezone ?? workspace?.timezone;
  // The list's filters and page, handed over by the card, for the back link.
  const [listSearch] = useState(() => location.state?.from ?? "");
  const listPath = `${PATH.USER.BUDGETS}${listSearch}`;

  // `key` ties a result to the request that produced it; while it doesn't
  // match the current request, the page is loading.
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${budgetId}:${reloadKey}`;
  const [result, setResult] = useState({ key: null, budget: null, error: null });
  const [isEditing, setIsEditing] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  // One-time success message ({ key, type, name }) for the current request.
  const [notice, setNotice] = useState({ key: null, type: null, name: "" });
  const [progressState, setProgressState] = useState({
    key: null,
    isRefreshing: false,
    error: null,
    refreshed: false,
  });
  const saveRequestRef = useRef(null);
  const progressControllerRef = useRef(null);
  // Set when a write learns the page is out of date (409: archived meanwhile);
  // the budget is refetched once the dialog showing the error is closed.
  const staleRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    budgetsApi
      .get(budgetId, { signal: controller.signal })
      .then((response) => {
        const budget = response.data?.budget;

        setResult(
          isBudgetEntity(budget)
            ? { key: requestKey, budget, error: null }
            : {
                key: requestKey,
                budget: null,
                error: new ApiError("", { code: "MALFORMED_RESPONSE" }),
              },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setResult({ key: requestKey, budget: null, error });
      });

    return () => controller.abort();
  }, [budgetId, requestKey]);

  // A progress refresh still running when the page goes away is dropped.
  useEffect(() => () => progressControllerRef.current?.abort(), []);

  const isLoading = result.key !== requestKey;
  const { budget, error } = isLoading ? { budget: null, error: null } : result;

  const reload = () => setReloadKey((key) => key + 1);

  // Once the budget is gone for this user (404), show the not-available state.
  const markUnavailable = (requestError) => {
    setIsEditing(false);
    setIsArchiveOpen(false);
    setResult({ key: requestKey, budget: null, error: requestError });
  };

  const handleWriteError = (requestError) => {
    if (requestError?.code === "NOT_FOUND") markUnavailable(requestError);
    if (requestError?.code === "CONFLICT") staleRef.current = true;
  };

  const closeDialogs = () => {
    setIsEditing(false);
    setIsArchiveOpen(false);

    if (staleRef.current) {
      staleRef.current = false;
      reload();
    }
  };

  // GET /budgets/{id}/progress: only the progress is replaced.
  const refreshProgress = async () => {
    if (progressControllerRef.current) return;

    const controller = new AbortController();
    const key = requestKey;
    progressControllerRef.current = controller;
    setProgressState({ key, isRefreshing: true, error: null, refreshed: false });

    try {
      const response = await budgetsApi.getProgress(budget.id, { signal: controller.signal });
      const progress = response.data?.progress;

      if (!progress || typeof progress !== "object") {
        throw new ApiError("", { code: "MALFORMED_RESPONSE" });
      }

      setResult((current) =>
        current.key === key && current.budget
          ? { ...current, budget: withFreshProgress(current.budget, progress) }
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

  const handleSave = async (values) => {
    if (saveRequestRef.current) return saveRequestRef.current;

    const saveRequest = (async () => {
      let response;

      try {
        response = await budgetsApi.update(budget.id, values);
      } catch (requestError) {
        handleWriteError(requestError);
        throw requestError;
      }

      const updatedBudget = response?.data?.budget;

      // The response carries the recalculated progress; without it, the
      // progress is fetched so no stale figures stay on screen.
      if (isBudgetEntity(updatedBudget, budget.id)) {
        setResult((current) => ({ ...current, budget: mergeBudget(current.budget, updatedBudget) }));
        if (!updatedBudget.progress) refreshProgress();
      } else {
        reload();
      }

      setIsEditing(false);
      setNotice({
        key: requestKey,
        type: "updateSuccess",
        name: updatedBudget?.name ?? values.name ?? budget.name,
      });
    })();

    saveRequestRef.current = saveRequest;

    try {
      return await saveRequest;
    } finally {
      saveRequestRef.current = null;
    }
  };

  // Called by ArchiveBudgetDialog; errors are shown inside the dialog.
  const handleArchive = async () => {
    let response;

    try {
      response = await budgetsApi.archive(budget.id);
    } catch (requestError) {
      handleWriteError(requestError);
      throw requestError;
    }

    const archivedBudget = response?.data?.budget;

    if (isBudgetEntity(archivedBudget, budget.id) && isArchivedBudget(archivedBudget)) {
      setResult((current) => ({ ...current, budget: mergeBudget(current.budget, archivedBudget) }));
    } else {
      reload();
    }

    setIsArchiveOpen(false);
    setNotice({ key: requestKey, type: "archiveSuccess", name: budget.name });
  };

  const backLink = (
    <Link className="budget-details__back" to={listPath}>
      <LuArrowLeft aria-hidden="true" />
      <span>{t("dashboard.budgets.details.back")}</span>
    </Link>
  );

  if (isLoading) {
    return (
      <div className="budget-details">
        {backLink}
        <Loading message={t("dashboard.budgets.details.loading")} />
      </div>
    );
  }

  if (error) {
    const isNotFound = error.code === "NOT_FOUND";

    return (
      <div className="budget-details">
        {backLink}

        <div className="budget-details__state" role="alert">
          <h1>
            {t(
              isNotFound
                ? "dashboard.budgets.details.notFoundTitle"
                : "dashboard.budgets.details.errorTitle",
            )}
          </h1>
          <p>{getBudgetErrorMessage(error, t)}</p>

          {!isNotFound && (
            <button type="button" onClick={reload}>
              {t("common.retry")}
            </button>
          )}
        </div>
      </div>
    );
  }

  const progress = getBudgetProgress(budget);
  const isArchived = isArchivedBudget(budget);
  const canManage = canManageBudget(budget);
  const scope = getBudgetScope(budget);
  const currency = budget.currency_code || progress?.currency_code;
  const periodState = getPeriodState(progress);
  const status = progress?.status;
  const percentage = formatPercentage(progress?.percentage_used, locale);
  const isOverspent = isNegativeMoney(progress?.remaining);
  const showProgressState = progressState.key === requestKey;
  const isRefreshing = showProgressState && progressState.isRefreshing;

  const money = (value) =>
    value == null || value === "" ? "—" : <bdi dir="ltr">{formatMoney(value, currency, locale)}</bdi>;
  const count = (value) =>
    value == null || value === "" ? "—" : new Intl.NumberFormat(locale).format(Number(value));
  const date = (value) => formatDate(toPeriodDate(value), locale);
  const periodText = (
    <>
      <bdi>{date(budget.period_start)}</bdi>
      {" – "}
      <bdi>{date(budget.period_end)}</bdi>
    </>
  );

  const category = budget.category;
  const categoryValue =
    category && typeof category === "object" ? (
      <span className="budget-details__category">
        {category.id != null ? (
          <Link to={getCategoryDetailsPath(category.id)}>
            <bdi>{category.name ?? `#${category.id}`}</bdi>
          </Link>
        ) : (
          <bdi>{category.name}</bdi>
        )}
        {!isActiveCategory(category) && (
          <small>{t("dashboard.categories.status.archived")}</small>
        )}
      </span>
    ) : null;

  const rows = [
    ["name", <bdi key="name">{budget.name}</bdi>],
    ["scope", t(`dashboard.budgets.scopes.${scope}`)],
    scope === "category" && ["category", categoryValue ?? "—"],
    ["amountLimit", money(budget.amount_limit)],
    ["currency", <bdi key="currency" dir="ltr">{currency}</bdi>],
    ["period", periodText],
    [
      "status",
      t(isArchived ? "dashboard.budgets.status.archived" : "dashboard.budgets.status.active"),
    ],
    budget.archived_at && ["archivedAt", formatDateTime(budget.archived_at, locale, timeZone)],
    budget.notes && [
      "notes",
      <span className="budget-details__notes" dir="auto" key="notes">
        {budget.notes}
      </span>,
    ],
    budget.created_at && ["createdAt", formatDateTime(budget.created_at, locale, timeZone)],
    budget.updated_at && ["updatedAt", formatDateTime(budget.updated_at, locale, timeZone)],
  ].filter(Boolean);

  const stats = progress
    ? [
        ["spent", money(progress.spent)],
        [
          "remaining",
          <span className={isOverspent ? "budget-details__negative" : undefined} key="remaining">
            {money(progress.remaining)}
          </span>,
        ],
        ["amountLimit", money(progress.amount_limit)],
        ["expensesCount", count(progress.expenses_count)],
        ["daysRemaining", count(progress.days_remaining)],
      ]
    : [];

  return (
    <div className="budget-details">
      {backLink}

      {notice.key === requestKey && (
        <div className="budget-details__notice" role="status">
          <p dir="auto">{t(`dashboard.budgets.${notice.type}`, { name: notice.name })}</p>
          <button
            type="button"
            onClick={() => setNotice({ key: null, type: null, name: "" })}
            aria-label={t("common.close")}
          >
            <LuX aria-hidden="true" />
          </button>
        </div>
      )}

      <header className="budget-details__header">
        <div className="budget-details__identity">
          <h1 dir="auto">{budget.name}</h1>

          <div className="budget-details__chips">
            <span className={`budget-details__chip budget-details__chip--${scope}`}>
              {t(`dashboard.budgets.scopes.${scope}`)}
            </span>
            {isArchived ? (
              <BudgetStatusBadge archived />
            ) : (
              <span className="budget-details__chip budget-details__chip--active">
                {t("dashboard.budgets.status.active")}
              </span>
            )}
            {periodState && (
              <span className="budget-details__chip">
                {t(`dashboard.budgets.periodState.${periodState}`)}
              </span>
            )}
          </div>
        </div>

        {canManage && (
          <div className="budget-details__actions">
            <button type="button" className="budget-details__action" onClick={() => setIsEditing(true)}>
              <LuPencil aria-hidden="true" />
              <span>{t("dashboard.budgets.edit")}</span>
            </button>
            <button
              type="button"
              className="budget-details__action budget-details__action--archive"
              onClick={() => setIsArchiveOpen(true)}
            >
              <LuArchive aria-hidden="true" />
              <span>{t("dashboard.budgets.archive")}</span>
            </button>
          </div>
        )}
      </header>

      {isArchived && (
        <p className="budget-details__note" role="note">
          <LuInfo aria-hidden="true" />
          <span>{t("dashboard.budgets.details.archivedNote")}</span>
        </p>
      )}

      <section className="budget-details__panel" aria-labelledby="budget-progress-title">
        <div className="budget-details__panel-head">
          <h2 id="budget-progress-title">{t("dashboard.budgets.details.progressTitle")}</h2>

          <button
            type="button"
            className="budget-details__refresh"
            onClick={refreshProgress}
            disabled={isRefreshing}
            aria-busy={isRefreshing || undefined}
          >
            <LuRefreshCw aria-hidden="true" />
            <span>
              {t(
                isRefreshing
                  ? "dashboard.budgets.details.refreshingProgress"
                  : "dashboard.budgets.details.refreshProgress",
              )}
            </span>
          </button>
        </div>

        {showProgressState && progressState.error && (
          <p className="budget-details__progress-error" role="alert">
            {getBudgetErrorMessage(progressState.error, t)}
          </p>
        )}
        {showProgressState && progressState.refreshed && (
          <p className="budget-details__progress-ok" role="status">
            {t("dashboard.budgets.details.progressRefreshed")}
          </p>
        )}

        {progress ? (
          <>
            <div className="budget-details__meter">
              <div className="budget-details__meter-copy">
                {status && <BudgetStatusBadge status={status} />}
                {BUDGET_PROGRESS_STATUSES.includes(status) && (
                  <p>{t(`dashboard.budgets.statusHints.${status}`)}</p>
                )}
              </div>
              <strong
                className={`budget-details__percent${isOverspent ? " budget-details__negative" : ""}`}
              >
                <bdi>{percentage}</bdi>
                <small>{t("dashboard.budgets.fields.percentageUsed")}</small>
              </strong>
            </div>

            <BudgetProgressBar
              percentage={progress.percentage_used}
              status={status}
              label={t("dashboard.budgets.fields.percentageUsed")}
              valueText={percentage}
              size="lg"
            />

            <dl className="budget-details__stats">
              {stats.map(([key, value]) => (
                <div className="budget-details__stat" key={key}>
                  <dt>{t(`dashboard.budgets.fields.${key}`)}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <p className="budget-details__empty">{t("dashboard.budgets.card.noProgress")}</p>
        )}
      </section>

      <section className="budget-details__panel" aria-labelledby="budget-details-title">
        <h2 id="budget-details-title">{t("dashboard.budgets.details.title")}</h2>

        <dl className="budget-details__list">
          {rows.map(([key, value]) => (
            <div className="budget-details__row" key={key}>
              <dt>{t(`dashboard.budgets.fields.${key}`)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {isEditing && canManage && (
        <BudgetForm budget={budget} onSave={handleSave} onClose={closeDialogs} />
      )}

      {isArchiveOpen && canManage && (
        <ArchiveBudgetDialog budget={budget} onConfirm={handleArchive} onClose={closeDialogs} />
      )}
    </div>
  );
}
