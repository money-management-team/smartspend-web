import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { LuX } from "react-icons/lu";

import { getBudgetDetailsPath } from "../../../../routes/Path";
import { ApiError, getStoredWorkspace } from "../api/apiClient";
import { budgetsApi } from "../api/budgetsApi";
import { categoriesApi } from "../api/categoriesApi";
import { resolveWorkspaceId } from "../api/dashboardApi";
import BudgetsHeader from "./components/BudgetsHeader/BudgetsHeader";
import BudgetSummary from "./components/BudgetSummary/BudgetSummary";
import BudgetFilters from "./components/BudgetFilters/BudgetFilters";
import BudgetList from "./components/BudgetList/BudgetList";
import BudgetForm from "./components/BudgetForm/BudgetForm";
import ArchiveBudgetDialog from "./components/ArchiveBudgetDialog/ArchiveBudgetDialog";
import {
  budgetFiltersToQuery,
  budgetFiltersToSearchParams,
  canManageBudget,
  getBudgetProgress,
  hasActiveBudgetFilters,
  isArchivedBudget,
  isBudgetEntity,
  mergeBudget,
  parseBudgetPage,
  readBudgetFilters,
} from "./budgetHelpers";

import "./Budgets.css";

const sameId = (left, right) => String(left) === String(right);

// Built from the live URL, not the last render: two quick filter changes must
// not overwrite each other.
const readCurrentFilters = () => readBudgetFilters(new URLSearchParams(window.location.search));

// Status counts for the summary, from the backend's own progress status.
function countBudgets(items) {
  const statuses = items
    .filter((budget) => !isArchivedBudget(budget))
    .map((budget) => getBudgetProgress(budget)?.status);

  return {
    active: statuses.length,
    onTrack: statuses.filter((status) => status === "safe").length,
    attention: statuses.filter((status) => status === "warning" || status === "near_limit").length,
    exceeded: statuses.filter((status) => status === "exceeded").length,
  };
}

/*
 * Budgets list (GET /budgets). Budgets are planning records: they never move
 * money, and their progress comes from the backend (derived from real expense
 * transactions), never from the client. Filters are applied by the backend.
 * Creating, editing and archiving happen in modals; after a create or an
 * archive the list is refetched instead of being patched locally.
 */
export default function Budgets() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  // Filters and page live in the URL, so the details page's back link (and
  // the browser's) return to the same view.
  const filters = useMemo(() => readBudgetFilters(searchParams), [searchParams]);
  const isFiltered = hasActiveBudgetFilters(filters);
  // The session workspace (the same one budgets are created in).
  const storedWorkspace = getStoredWorkspace();
  const workspaceId = storedWorkspace?.id ?? null;
  // Keyed by its serialized value: a URL change that doesn't change what is
  // sent (e.g. only one end of the period range picked so far) doesn't refetch.
  const queryKey = JSON.stringify(budgetFiltersToQuery(filters, workspaceId));
  const query = useMemo(() => JSON.parse(queryKey), [queryKey]);

  // `key` ties a result to the request that produced it; while it doesn't
  // match the current request (filters, page or retry changed), the list is
  // loading.
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${queryKey}#${reloadKey}`;
  const [result, setResult] = useState({ key: null, page: null, error: null });

  const [formState, setFormState] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  // One-time success message: { key, name, budgetId }, translated at render.
  const [notice, setNotice] = useState(null);
  const saveRequestRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();

    budgetsApi
      .list(query, { signal: controller.signal })
      .then((response) => {
        const parsed = parseBudgetPage(response);

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
  }, [query, requestKey]);

  const isLoading = result.key !== requestKey;
  const { page: listPage, error } = isLoading ? { page: null, error: null } : result;
  const items = listPage?.items ?? [];

  const reloadBudgets = () => setReloadKey((key) => key + 1);

  /* ---------- Expense categories (category filter options) ---------- */

  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const controller = new AbortController();

    // Same call as the budget form. A failure only leaves the category filter
    // with "All categories".
    categoriesApi
      .list({ workspace_id: workspaceId ?? undefined, type: "expense" }, { signal: controller.signal })
      .then((response) => {
        const list = response.data?.categories;
        setCategories(
          Array.isArray(list)
            ? list.filter((category) => category?.id != null && category.type === "expense")
            : [],
        );
      })
      .catch(() => {});

    return () => controller.abort();
  }, [workspaceId]);

  /* ---------- Filters ---------- */

  const updateFilters = (changes) => {
    const next = { ...readCurrentFilters(), ...changes, page: changes.page ?? 1 };

    // A general budget has no category.
    if (next.scope === "general") next.category_id = "";

    // Keep the period range valid (date_to ≥ date_from) instead of sending a 422.
    if (next.date_from && next.date_to && next.date_to < next.date_from) {
      if ("date_from" in changes) next.date_to = "";
      else next.date_from = "";
    }

    setSearchParams(budgetFiltersToSearchParams(next), { replace: true });
  };

  const clearFilters = () =>
    setSearchParams(budgetFiltersToSearchParams(readBudgetFilters(new URLSearchParams())), {
      replace: true,
    });

  const goToPage = (next) =>
    setSearchParams(budgetFiltersToSearchParams({ ...readCurrentFilters(), page: next }));

  const handleSave = async (values) => {
    if (saveRequestRef.current) return saveRequestRef.current;

    const budgetBeingEdited = formState?.budget;
    const saveRequest = (async () => {
      if (budgetBeingEdited) {
        let response;

        try {
          response = await budgetsApi.update(budgetBeingEdited.id, values);
        } catch (requestError) {
          // Gone, or archived meanwhile (409): the list is out of date.
          if (["NOT_FOUND", "CONFLICT"].includes(requestError?.code)) reloadBudgets();
          throw requestError;
        }

        const updatedBudget = response?.data?.budget;

        // The response carries the recalculated progress; without it, the
        // list is refetched so no stale figures stay on screen.
        if (isBudgetEntity(updatedBudget, budgetBeingEdited.id) && updatedBudget.progress) {
          setResult((current) => ({
            ...current,
            page: current.page && {
              ...current.page,
              items: current.page.items.map((budget) =>
                sameId(budget.id, updatedBudget.id) ? mergeBudget(budget, updatedBudget) : budget,
              ),
            },
          }));
        } else {
          reloadBudgets();
        }

        setNotice({
          key: "updateSuccess",
          name: updatedBudget?.name ?? values.name ?? budgetBeingEdited.name,
          budgetId: budgetBeingEdited.id,
        });
      } else {
        const workspaceId = await resolveWorkspaceId();
        const response = await budgetsApi.create({ ...values, workspace_id: workspaceId });
        const createdBudget = response?.data?.budget;

        setNotice({
          key: "createSuccess",
          name: createdBudget?.name ?? values.name,
          budgetId: isBudgetEntity(createdBudget) ? createdBudget.id : null,
        });
        // Its place in the list (and page) is the backend's to decide.
        reloadBudgets();
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

  // Called by ArchiveBudgetDialog; errors are shown inside the dialog.
  const handleArchive = async () => {
    const budget = archiveTarget;

    try {
      await budgetsApi.archive(budget.id);
    } catch (requestError) {
      // Gone, or already archived (409): the list is out of date.
      if (["NOT_FOUND", "CONFLICT"].includes(requestError?.code)) reloadBudgets();
      throw requestError;
    }

    setArchiveTarget(null);
    setNotice({ key: "archiveSuccess", name: budget.name, budgetId: budget.id });
    // Whether archived budgets stay listed is the backend's choice.
    reloadBudgets();
  };

  const openCreateForm = () => setFormState({ budget: null });

  const openEditForm = (budget) => {
    if (canManageBudget(budget)) setFormState({ budget });
  };

  const openArchiveDialog = (budget) => {
    if (canManageBudget(budget)) setArchiveTarget(budget);
  };

  return (
    <div className="budgets-page">
      <BudgetsHeader onCreate={openCreateForm} />

      {notice && (
        <div className="budgets-page__notice" role="status">
          <p dir="auto">
            {t(`dashboard.budgets.${notice.key}`, { name: notice.name })}
            {notice.budgetId != null && (
              <>
                {" "}
                <Link to={getBudgetDetailsPath(notice.budgetId)}>
                  {t("dashboard.budgets.viewBudget")}
                </Link>
              </>
            )}
          </p>
          <button type="button" onClick={() => setNotice(null)} aria-label={t("common.close")}>
            <LuX aria-hidden="true" />
          </button>
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <BudgetSummary counts={countBudgets(items)} isPartial={listPage.lastPage > 1} />
      )}

      <BudgetList
        listPage={listPage}
        isLoading={isLoading}
        error={error}
        filters={
          <BudgetFilters
            filters={filters}
            categories={categories}
            baseCurrency={storedWorkspace?.base_currency_code}
            onChange={updateFilters}
            onClear={clearFilters}
          />
        }
        isFiltered={isFiltered}
        onClearFilters={clearFilters}
        onRetry={reloadBudgets}
        onCreate={openCreateForm}
        onGoToPage={goToPage}
        onEdit={openEditForm}
        onArchive={openArchiveDialog}
      />

      {formState && (
        <BudgetForm
          budget={formState.budget}
          onSave={handleSave}
          onClose={() => setFormState(null)}
        />
      )}

      {archiveTarget && (
        <ArchiveBudgetDialog
          budget={archiveTarget}
          onConfirm={handleArchive}
          onClose={() => setArchiveTarget(null)}
        />
      )}
    </div>
  );
}
