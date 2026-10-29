import { useRef, useState } from "react";

import { savingsPlansApi } from "../api/savingsPlansApi";
import { createIdempotentAttempt } from "../FinancialOperations/transactionHelpers";
import { classifyPlanWriteError } from "./smartPlanHelpers";

/*
 * One write on the goal's plan itself ("discontinue") with its
 * Idempotency-Key, like useInstallmentWrite: the same key while the payload
 * is the same (an identical retry after an unknown outcome), a new one once
 * it changes or after a rejection. One request at a time.
 *
 * `run(payload)` resolves with the response data, or null on failure, kept
 * in `failure` ({ error, kind }). A stale plan (409 version conflict / not
 * active, 404) or an unknown outcome calls `onOutdated()` so the page
 * fetches the plan again and the user reviews its current version.
 */
export function usePlanWrite(action, { goalId, onOutdated }) {
  const [attempt] = useState(() => createIdempotentAttempt(`savings-plan-${action}`));
  const pendingRef = useRef(false);
  const [isRunning, setIsRunning] = useState(false);
  const [failure, setFailure] = useState(null);

  const run = async (payload) => {
    if (pendingRef.current) return null;

    const idempotencyKey = attempt.keyFor({ goalId, ...payload });

    pendingRef.current = true;
    setIsRunning(true);
    setFailure(null);

    try {
      const response = await savingsPlansApi[action](goalId, payload, idempotencyKey);
      attempt.settle();
      return response?.data ?? {};
    } catch (error) {
      // 401: apiClient's session-expired flow takes over.
      if (error?.code === "UNAUTHENTICATED") return null;

      const kind = classifyPlanWriteError(error);
      if (kind !== "unknown") attempt.reset();

      setFailure({ error, kind });
      if (kind === "stale" || kind === "unknown") onOutdated();

      return null;
    } finally {
      pendingRef.current = false;
      setIsRunning(false);
    }
  };

  return { run, isRunning, failure };
}
