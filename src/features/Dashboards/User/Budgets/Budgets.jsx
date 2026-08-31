import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import BudgetsHeader from "./components/BudgetsHeader/BudgetsHeader";
import BudgetSummary from "./components/BudgetSummary/BudgetSummary";
import BudgetList from "./components/BudgetList/BudgetList";
import BudgetForm from "./components/BudgetForm/BudgetForm";
import { budgetsApi } from "../api/budgetsApi";
import { categoriesApi } from "../api/categoriesApi";
import { resolveWorkspaceId } from "../api/dashboardApi";
import { getApiErrorMessage } from "../api/apiClient";

import "./Budgets.css";
import Loading from "../../../../components/Loading/Loading";

export default function Budgets() {
  const { t } = useTranslation();
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [formState, setFormState] = useState(null);

  const loadBudgets = useCallback(async (signal) => {
    setIsLoading(true);
    setError("");

    try {
      const [budgetsResponse, categoriesResponse] = await Promise.all([
        budgetsApi.list({}, { signal }),
        categoriesApi.list({ type: "expense" }, { signal }),
      ]);

      setBudgets(budgetsResponse.data?.budgets?.data ?? []);
      setCategories(categoriesResponse.data?.categories ?? []);
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setError(getApiErrorMessage(requestError, t));
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    loadBudgets(controller.signal);
    return () => controller.abort();
  }, [loadBudgets]);

  const summary = useMemo(() => {
    const currency = budgets[0]?.currency_code ?? "ILS";
    const sameCurrencyBudgets = budgets.filter((budget) => budget.currency_code === currency);
    const limit = sameCurrencyBudgets.reduce((sum, budget) => sum + Number(budget.amount_limit || 0), 0);
    const spent = sameCurrencyBudgets.reduce((sum, budget) => sum + Number(budget.progress?.spent || 0), 0);

    return {
      currency,
      limit,
      spent,
      remaining: limit - spent,
    };
  }, [budgets]);

  const handleArchive = async (budget) => {
    if (!window.confirm(t("dashboard.budgets.confirmArchive", { name: budget.name }))) return;

    try {
      await budgetsApi.archive(budget.id);
      setBudgets((current) => current.filter((item) => item.id !== budget.id));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, t));
    }
  };

  const handleSave = async (payload) => {
    if (formState?.budget) {
      const response = await budgetsApi.update(formState.budget.id, payload);
      const updatedBudget = response.data?.budget;
      setBudgets((current) => current.map((budget) => budget.id === updatedBudget.id ? updatedBudget : budget));
    } else {
      const workspaceId = await resolveWorkspaceId();
      const response = await budgetsApi.create({ ...payload, workspace_id: workspaceId });
      const createdBudget = response.data?.budget;
      setBudgets((current) => [createdBudget, ...current]);
    }

    setFormState(null);
  };

  return (
    <div className="budgets-page">
      <BudgetsHeader onCreate={() => setFormState({ budget: null })} />

      <BudgetSummary summary={summary} />

      {isLoading && <Loading message={false} />}
      {!isLoading && error && (
        <div className="budgets-page__state budgets-page__state--error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => loadBudgets()}>{t("common.retry")}</button>
        </div>
      )}
      {!isLoading && !error && (
        <BudgetList
          budgets={budgets}
          onEdit={(budget) => setFormState({ budget })}
          onArchive={handleArchive}
        />
      )}

      {formState && (
        <BudgetForm
          budget={formState.budget}
          categories={categories}
          onSave={handleSave}
          onClose={() => setFormState(null)}
        />
      )}
    </div>
  );
}
