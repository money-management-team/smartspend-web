import { useEffect, useState } from "react";

import { canHaveActivePlan, loadPlanSummaries } from "./smartSavings";

/*
 * Plan summaries for the goals on the current list page, keyed by goal id.
 * `requestKey` is the list request that produced `goals` (null while it
 * loads): every new list result looks the plans up again, so a summary is
 * never older than the goals beside it. Goals still being looked up read
 * `{ state: "loading" }`; goals that can't have a plan have no entry.
 */
export function useGoalPlanSummaries(goals, { enabled, requestKey }) {
  const goalIds =
    enabled && requestKey ? goals.filter(canHaveActivePlan).map((goal) => String(goal.id)) : [];
  const lookupKey = goalIds.length > 0 ? `${requestKey}#${goalIds.join(",")}` : null;
  const [result, setResult] = useState({ key: null, summaries: {} });

  useEffect(() => {
    if (!lookupKey) return undefined;

    const controller = new AbortController();
    const ids = lookupKey.slice(lookupKey.lastIndexOf("#") + 1).split(",");

    loadPlanSummaries(ids, {
      signal: controller.signal,
      onResult: (goalId, summary) =>
        setResult((current) => ({
          key: lookupKey,
          summaries: {
            ...(current.key === lookupKey ? current.summaries : {}),
            [goalId]: summary,
          },
        })),
    }).catch(() => {
      // Only an abort rejects (lookup failures are per-goal results), and an
      // aborted lookup belongs to a list that is no longer shown.
    });

    return () => controller.abort();
  }, [lookupKey]);

  if (!lookupKey) return {};

  const summaries = result.key === lookupKey ? result.summaries : {};

  return Object.fromEntries(goalIds.map((id) => [id, summaries[id] ?? { state: "loading" }]));
}
