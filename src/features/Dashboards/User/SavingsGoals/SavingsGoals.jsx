import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { LuChevronLeft, LuChevronRight, LuX } from "react-icons/lu";

import Loading from "../../../../components/Loading/Loading";
import { getSavingsGoalDetailsPath } from "../../../../routes/Path";
import { ApiError } from "../api/apiClient";
import { resolveWorkspaceId } from "../api/dashboardApi";
import { savingsGoalsApi } from "../api/savingsGoalsApi";
import GoalActionDialog from "./components/GoalActionDialog/GoalActionDialog";
import GoalMovementForm from "./components/GoalMovementForm/GoalMovementForm";
import SavingsGoalCard from "./components/SavingsGoalCard/SavingsGoalCard";
import SavingsGoalFilters from "./components/SavingsGoalFilters/SavingsGoalFilters";
import SavingsGoalForm from "./components/SavingsGoalForm/SavingsGoalForm";
import SavingsGoalsHeader from "./components/SavingsGoalsHeader/SavingsGoalsHeader";
import {
  getCurrencyOptions,
  getGoalActions,
  getGoalErrorMessage,
  goalFiltersToQuery,
  goalFiltersToSearchParams,
  hasActiveGoalFilters,
  isGoalEntity,
  mergeGoal,
  parsePage,
  readGoalFilters,
} from "./savingsGoalHelpers";

import "./SavingsGoals.css";

const sameId = (left, right) => String(left) === String(right);

/*
 * Savings goals list (GET /savings-goals, paginated, filtered by lifecycle
 * status, progress status and currency). Creating, editing, contributing and
 * archiving happen in modals. The backend ledger is the source of truth: after
 * money moves (or a goal is created/archived) the list is refetched instead of
 * being patched locally.
 */
export default function SavingsGoals() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readGoalFilters(searchParams);
  // Only the filters and page identify a request (not `?new=1`).
  const filterKey = goalFiltersToSearchParams(filters).toString();

  // `?new=1` (the dashboard's "New goal" action) opens the form once; the flag
  // is then dropped so a reload doesn't reopen it.
  const [formState, setFormState] = useState(() =>
    searchParams.has("new") ? { goal: null } : null,
  );

  useEffect(() => {
    if (searchParams.has("new")) {
      setSearchParams(goalFiltersToSearchParams(readGoalFilters(searchParams)), { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // `key` ties a result to the request that produced it; while it doesn't
  // match the current request (filters, page or retry changed), the list is
  // loading.
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${filterKey}:${reloadKey}`;
  const [result, setResult] = useState({ key: null, page: null, error: null });

  const [movementGoal, setMovementGoal] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  // One-time success message: { key, name, goalId }, translated at render.
  const [notice, setNotice] = useState(null);
  const saveRequestRef = useRef(null);
  // Set when a money movement failed in a way that may leave the list out of
  // date; the list is refetched when the form closes.
  const staleRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const query = goalFiltersToQuery(readGoalFilters(new URLSearchParams(filterKey)));

    savingsGoalsApi
      .list(query, { signal: controller.signal })
      .then((response) => {
        const parsed = parsePage(response, "savings_goals");

        setResult(
          parsed
            ? { key: requestKey, page: parsed, error: null }
            : {
                key: requestKey,
                page: null,
                error: new ApiError("", { code: "MALFORMED_RESPONSE" }),
              },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setResult({ key: requestKey, page: null, error });
      });

    return () => controller.abort();
  }, [filterKey, requestKey]);

  const isLoading = result.key !== requestKey;
  const { page: listPage, error } = isLoading ? { page: null, error: null } : result;
  const items = listPage?.items ?? [];
  const isFiltered = hasActiveGoalFilters(filters);

  const reloadGoals = () => setReloadKey((key) => key + 1);

  const updateFilters = (changes) =>
    setSearchParams(goalFiltersToSearchParams({ ...filters, ...changes, page: 1 }));

  const clearFilters = () => setSearchParams(new URLSearchParams());

  const goToPage = (page) => setSearchParams(goalFiltersToSearchParams({ ...filters, page }));

  /* ---------- Create / edit ---------- */

  const handleSave = async (values) => {
    if (saveRequestRef.current) return saveRequestRef.current;

    const goalBeingEdited = formState?.goal;
    const saveRequest = (async () => {
      if (goalBeingEdited) {
        let response;

        try {
          response = await savingsGoalsApi.update(goalBeingEdited.id, values);
        } catch (requestError) {
          // Gone, or archived meanwhile (409): the list is out of date.
          if (["NOT_FOUND", "CONFLICT"].includes(requestError?.code)) reloadGoals();
          throw requestError;
        }

        const updatedGoal = response?.data?.savings_goal;

        // A new target can change the lifecycle status (achieved ↔ active),
        // which the filters may depend on: the card is replaced with the
        // backend's goal only while no filter could hide it.
        if (isGoalEntity(updatedGoal, goalBeingEdited.id) && updatedGoal.progress && !isFiltered) {
          setResult((current) => ({
            ...current,
            page: current.page && {
              ...current.page,
              items: current.page.items.map((goal) =>
                sameId(goal.id, updatedGoal.id) ? mergeGoal(goal, updatedGoal) : goal,
              ),
            },
          }));
        } else {
          reloadGoals();
        }

        setNotice({
          key: "updateSuccess",
          name: updatedGoal?.name ?? values.name ?? goalBeingEdited.name,
          goalId: goalBeingEdited.id,
        });
      } else {
        const workspaceId = await resolveWorkspaceId();
        const response = await savingsGoalsApi.create({ ...values, workspace_id: workspaceId });
        const createdGoal = response?.data?.savings_goal;

        setNotice({
          key: "createSuccess",
          name: createdGoal?.name ?? values.name,
          goalId: isGoalEntity(createdGoal) ? createdGoal.id : null,
        });
        // Its place in the list (and page) is the backend's to decide.
        reloadGoals();
      }

      setFormState(null);
    })();

    saveRequestRef.current = saveRequest;

    try {
      return await saveRequest;
    } finally {
      if (saveRequestRef.current === saveRequest) {
        saveRequestRef.current = null;
      }
    }
  };

  /* ---------- Contribution ---------- */

  // The response carries the goal with its recalculated progress; the list
  // is refetched because the new state can move the goal across filters.
  const handleMovementCompleted = (data) => {
    const goal = movementGoal;
    setMovementGoal(null);
    staleRef.current = false;
    setNotice({
      key: "contributionSuccess",
      name: data?.savings_goal?.name ?? goal.name,
      goalId: goal.id,
    });
    reloadGoals();
  };

  const closeMovementForm = () => {
    setMovementGoal(null);

    if (staleRef.current) {
      staleRef.current = false;
      reloadGoals();
    }
  };

  /* ---------- Archive ---------- */

  // Called by GoalActionDialog; errors are shown inside the dialog.
  const handleArchive = async () => {
    const goal = archiveTarget;

    try {
      await savingsGoalsApi.archive(goal.id);
    } catch (requestError) {
      // Gone, already archived or still holding money (409): the list is
      // refetched so the card shows the real state.
      if (["NOT_FOUND", "CONFLICT"].includes(requestError?.code)) reloadGoals();
      throw requestError;
    }

    setArchiveTarget(null);
    setNotice({ key: "archiveSuccess", name: goal.name, goalId: goal.id });
    // Whether archived goals stay listed is the backend's choice.
    reloadGoals();
  };

  /* ---------- Render ---------- */

  const openCreateForm = () => setFormState({ goal: null });

  const openEditForm = (goal) => {
    if (getGoalActions(goal).canEdit) setFormState({ goal });
  };

  const openContribution = (goal) => {
    if (getGoalActions(goal).canContribute) setMovementGoal(goal);
  };

  const openArchiveDialog = (goal) => {
    if (getGoalActions(goal).canArchive) setArchiveTarget(goal);
  };

  return (
    <div className="savings-goals-page">
      <SavingsGoalsHeader onNewGoal={openCreateForm} />

      {notice && (
        <div className="savings-goals-page__notice" role="status">
          <p dir="auto">
            {t(`dashboard.savingsGoals.notices.${notice.key}`, { name: notice.name })}
            {notice.goalId != null && (
              <>
                {" "}
                <Link to={getSavingsGoalDetailsPath(notice.goalId)}>
                  {t("dashboard.savingsGoals.notices.viewGoal")}
                </Link>
              </>
            )}
          </p>
          <button type="button" onClick={() => setNotice(null)} aria-label={t("common.close")}>
            <LuX aria-hidden="true" />
          </button>
        </div>
      )}

      <SavingsGoalFilters
        filters={filters}
        currencies={getCurrencyOptions(filters.currency_code)}
        onChange={updateFilters}
        onClear={clearFilters}
        disabled={isLoading}
      />

      {isLoading && <Loading message={t("dashboard.savingsGoals.states.loading")} />}

      {!isLoading && error && (
        <div className="savings-goals-page__state savings-goals-page__state--error" role="alert">
          <p>{getGoalErrorMessage(error, t)}</p>
          <button type="button" onClick={reloadGoals}>
            {t("common.retry")}
          </button>
        </div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <div className="savings-goals-page__state">
          {listPage && listPage.total > 0 && listPage.page > 1 ? (
            <>
              <p>{t("dashboard.savingsGoals.states.emptyPage")}</p>
              <button type="button" onClick={() => goToPage(1)}>
                {t("dashboard.transactions.pagination.first")}
              </button>
            </>
          ) : isFiltered ? (
            <>
              <p>{t("dashboard.savingsGoals.states.emptyFiltered")}</p>
              <button type="button" onClick={clearFilters}>
                {t("dashboard.savingsGoals.filters.clear")}
              </button>
            </>
          ) : (
            <>
              <p>{t("dashboard.savingsGoals.states.empty")}</p>
              <button type="button" onClick={openCreateForm}>
                {t("dashboard.savingsGoals.newGoal")}
              </button>
            </>
          )}
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <section className="savings-goals-page__grid" aria-label={t("dashboard.savingsGoals.title")}>
          {items.map((goal) => (
            <SavingsGoalCard
              key={goal.id}
              goal={goal}
              onContribute={() => openContribution(goal)}
              onEdit={() => openEditForm(goal)}
              onArchive={() => openArchiveDialog(goal)}
            />
          ))}
        </section>
      )}

      {!isLoading && !error && listPage && listPage.lastPage > 1 && (
        <footer className="savings-goals-page__pagination">
          <span>
            {t("dashboard.transactions.pagination.summary", {
              from: listPage.from,
              to: listPage.to,
              total: listPage.total,
            })}
          </span>

          <div className="savings-goals-page__pages">
            <button
              type="button"
              onClick={() => goToPage(listPage.page - 1)}
              disabled={listPage.page <= 1}
              aria-label={t("dashboard.transactions.pagination.previous")}
            >
              <LuChevronLeft aria-hidden="true" />
            </button>
            <span aria-live="polite">
              {t("dashboard.transactions.pagination.page", {
                page: listPage.page,
                lastPage: listPage.lastPage,
              })}
            </span>
            <button
              type="button"
              onClick={() => goToPage(listPage.page + 1)}
              disabled={listPage.page >= listPage.lastPage}
              aria-label={t("dashboard.transactions.pagination.next")}
            >
              <LuChevronRight aria-hidden="true" />
            </button>
          </div>
        </footer>
      )}

      {formState && (
        <SavingsGoalForm goal={formState.goal} onSave={handleSave} onClose={() => setFormState(null)} />
      )}

      {movementGoal && (
        <GoalMovementForm
          type="contribution"
          goal={movementGoal}
          onCompleted={handleMovementCompleted}
          onOutdated={() => {
            staleRef.current = true;
          }}
          onClose={closeMovementForm}
        />
      )}

      {archiveTarget && (
        <GoalActionDialog
          action="archive"
          goal={archiveTarget}
          onConfirm={handleArchive}
          onClose={() => setArchiveTarget(null)}
          withdrawPath={getSavingsGoalDetailsPath(archiveTarget.id)}
        />
      )}
    </div>
  );
}
