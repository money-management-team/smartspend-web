import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LuCompass, LuCheck } from "react-icons/lu";
import {
  PATH,
  getNewOperationPath,
  getNewSavingsGoalPath,
} from "../../../../routes/Path";
import { useAuthContext } from "../../../../contexts/auth/useAuthContext";
import { accountsApi } from "../api/accountsApi";
import { dashboardApi } from "../api/dashboardApi";
import { budgetsApi } from "../api/budgetsApi";
import { savingsGoalsApi } from "../api/savingsGoalsApi";
import { useExperience } from "./useExperience";
import { hasWorkspaceTransactions } from "./experienceData";

const STEPS = ["account", "transaction", "budget", "goal"];
const PATHS = [
  PATH.USER.ACCOUNTS,
  getNewOperationPath("expense"),
  PATH.USER.BUDGETS,
  getNewSavingsGoalPath(),
];
export default function GettingStarted() {
  const { t } = useTranslation("experience"),
    { workspace } = useAuthContext(),
    { update } = useExperience();
  const [refresh, setRefresh] = useState(0),
    [result, setResult] = useState({ key: null, states: {} });
  const key = `${workspace?.id}:${refresh}`;
  useEffect(() => {
    if (!workspace?.id) return undefined;
    const controller = new AbortController();
    Promise.allSettled([
      accountsApi
        .list({ workspace_id: workspace.id }, { signal: controller.signal })
        .then((response) => {
          const rows = response.data?.accounts;
          if (!Array.isArray(rows)) throw new Error("Invalid accounts");
          return rows.some(
            (row) =>
              String(row.workspace_id) === String(workspace.id) &&
              row.status === "active" &&
              !row.savings_goal,
          );
        }),
      dashboardApi
        .get(
          { period: "all", workspace_id: workspace.id },
          { signal: controller.signal },
        )
        .then((response) => hasWorkspaceTransactions(response, workspace.id)),
      budgetsApi
        .list(
          { workspace_id: workspace.id, per_page: 1, page: 1 },
          { signal: controller.signal },
        )
        .then((response) => {
          const total = response.data?.budgets?.total;
          if (!Number.isSafeInteger(total)) throw new Error("Invalid budgets");
          return total > 0;
        }),
      savingsGoalsApi
        .list(
          { workspace_id: workspace.id, per_page: 1, page: 1 },
          { signal: controller.signal },
        )
        .then((response) => {
          const total = response.data?.savings_goals?.total;
          if (!Number.isSafeInteger(total)) throw new Error("Invalid goals");
          return total > 0;
        }),
    ]).then((values) => {
      if (!controller.signal.aborted)
        setResult({
          key,
          states: Object.fromEntries(
            values.map((value, index) => [
              STEPS[index],
              value.status === "fulfilled" ? value.value : null,
            ]),
          ),
        });
    });
    return () => controller.abort();
  }, [key, workspace?.id]);
  const busy = result.key !== key,
    states = busy ? {} : result.states,
    complete = STEPS.every((step) => states[step] === true);
  return (
    <div className="exp-page">
      <header className="exp-hero">
        <div>
          <span className="exp-kicker">SMARTSPEND · FIRST STEPS</span>
          <h1>{t("guide")}</h1>
          <p>{t("guideHint")}</p>
        </div>
        <span className="exp-hero-icon">
          <LuCompass aria-hidden="true" />
        </span>
      </header>
      <div className="exp-toolbar">
        <p className="exp-muted">{t("readOnly")}</p>
        <button
          className="exp-button exp-button--subtle"
          type="button"
          disabled={busy && Boolean(workspace?.id)}
          onClick={() => setRefresh((value) => value + 1)}
        >
          {t("refresh")}
        </button>
      </div>
      {busy && (
        <p className="exp-muted" role="status">
          {t(workspace?.id ? "loading" : "guideUnknown")}
        </p>
      )}
      <div className="exp-grid">
        {STEPS.map((step, index) => (
          <article className="exp-card" key={step}>
            <header className="exp-toolbar">
              <span className="exp-step-number">
                {states[step] === true ? (
                  <LuCheck aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              <h2>{t(`guideStep.${step}`)}</h2>
            </header>
            <p className="exp-muted">{t(`guideText.${step}`)}</p>
            <p
              className={`exp-badge${states[step] === null ? " exp-badge--warning" : ""}`}
            >
              {t(
                states[step] === true
                  ? "completed"
                  : states[step] === null
                    ? "guideUnknown"
                    : "pending",
              )}
            </p>
            <div style={{ marginTop: 18 }}>
              <Link className="exp-button exp-button--subtle" to={PATHS[index]}>
                {t(states[step] === true ? "open" : "next")}
              </Link>
            </div>
          </article>
        ))}
      </div>
      {complete && (
        <p className="exp-success" role="status">
          {t("guideDone")}
        </p>
      )}
      <div className="exp-toolbar">
        <button
          className="exp-button exp-button--subtle"
          type="button"
          onClick={() => update({ guideDismissed: true })}
        >
          {t("dismiss")}
        </button>
        <Link className="exp-button" to={PATH.USER.DASHBOARD}>
          {t("open")}
        </Link>
      </div>
    </div>
  );
}
