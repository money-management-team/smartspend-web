import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import SavingsGoalsHeader from "./components/SavingsGoalsHeader/SavingsGoalsHeader";
import SavingsGoalCard from "./components/SavingsGoalCard/SavingsGoalCard";
import SavingsGoalForm from "./components/SavingsGoalForm/SavingsGoalForm";
import ContributionForm from "./components/ContributionForm/ContributionForm";
import { savingsGoalsApi } from "../api/savingsGoalsApi";
import { accountsApi } from "../api/accountsApi";
import { resolveWorkspaceId } from "../api/dashboardApi";
import { getApiErrorMessage } from "../api/apiClient";

import "./SavingsGoals.css";
import Loading from "../../../../components/Loading/Loading";

export default function SavingsGoals() {
  const { t } = useTranslation();
  const [goals, setGoals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [formState, setFormState] = useState(null);
  const [contributionGoal, setContributionGoal] = useState(null);

  const loadGoals = useCallback(async (signal) => {
    setIsLoading(true);
    setError("");

    try {
      const [goalsResponse, accountsResponse] = await Promise.all([
        savingsGoalsApi.list({}, { signal }),
        accountsApi.list({}, { signal }),
      ]);

      setGoals(goalsResponse.data?.savings_goals?.data ?? []);
      setAccounts(accountsResponse.data?.accounts ?? []);
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
    loadGoals(controller.signal);
    return () => controller.abort();
  }, [loadGoals]);

  const handleSave = async (payload) => {
    if (formState?.goal) {
      const response = await savingsGoalsApi.update(formState.goal.id, payload);
      const updatedGoal = response.data?.savings_goal;
      if (updatedGoal) {
        setGoals((current) => current.map((goal) => goal.id === updatedGoal.id ? updatedGoal : goal));
      } else {
        await loadGoals();
      }
    } else {
      const workspaceId = await resolveWorkspaceId();
      const response = await savingsGoalsApi.create({ ...payload, workspace_id: workspaceId });
      setGoals((current) => [response.data.savings_goal, ...current]);
    }

    setFormState(null);
  };

  const handleArchive = async (goal) => {
    if (!window.confirm(t("dashboard.savingsGoals.confirmArchive", { name: goal.name }))) return;

    try {
      await savingsGoalsApi.archive(goal.id);
      setGoals((current) => current.filter((item) => item.id !== goal.id));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, t));
    }
  };

  const handleContribution = async (payload, idempotencyKey) => {
    await savingsGoalsApi.contribute(contributionGoal.id, payload, idempotencyKey);
    setContributionGoal(null);
    await loadGoals();
  };

  const contributionAccounts = contributionGoal
    ? accounts.filter(
        (account) =>
          account.id !== contributionGoal.account?.id &&
          account.currency_code === contributionGoal.currency_code,
      )
    : [];

  return (
    <div className="savings-goals-page">
      <SavingsGoalsHeader onNewGoal={() => setFormState({ goal: null })} />

      {isLoading && <Loading message={false} />}
      {!isLoading && error && (
        <div className="savings-goals-page__state savings-goals-page__state--error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => loadGoals()}>{t("common.retry")}</button>
        </div>
      )}

      {!isLoading && !error && (
        <section className="savings-goals-page__grid">
          {goals.length === 0 && <p className="savings-goals-page__empty">{t("dashboard.savingsGoals.states.empty")}</p>}
          {goals.map((goal) => (
            <SavingsGoalCard
              key={goal.id}
              goal={goal}
              onAddFunds={() => setContributionGoal(goal)}
              onEdit={() => setFormState({ goal })}
              onArchive={() => handleArchive(goal)}
            />
          ))}
        </section>
      )}

      {formState && (
        <SavingsGoalForm goal={formState.goal} onSave={handleSave} onClose={() => setFormState(null)} />
      )}

      {contributionGoal && (
        <ContributionForm
          goal={contributionGoal}
          accounts={contributionAccounts}
          onSave={handleContribution}
          onClose={() => setContributionGoal(null)}
        />
      )}
    </div>
  );
}
