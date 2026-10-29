import { useRef, useState } from "react";

import { savingsPlansApi } from "../api/savingsPlansApi";
import { createIdempotentAttempt } from "../FinancialOperations/transactionHelpers";
import { classifyPlanWriteError } from "./smartPlanHelpers";

/*
 * One installment write ("postpone" | "skip") with its Idempotency-Key:
 * the same key while the payload is the same (an identical retry after an
 * unknown outcome), a new one once it changes or after a rejection. One
 * request at a time.
 *
 * `run(payload)` resolves with the response data, or null on failure, which
 * is kept in `failure` ({ error, kind }; see classifyPlanWriteError). When
 * the plan may have changed ("stale") or the outcome is unknown,
 * `onOutdated()` lets the page refetch the plan, so the next attempt is made
 * against current versions.
 */
export function useInstallmentWrite(action, { goalId, installmentId, onOutdated }) {
  const [attempt] = useState(() => createIdempotentAttempt(`savings-installment-${action}`));
  const pendingRef = useRef(false);
  const [isRunning, setIsRunning] = useState(false);
  const [failure, setFailure] = useState(null);

  const run = async (payload) => {
    if (pendingRef.current) return null;

    const idempotencyKey = attempt.keyFor({ goalId, installmentId, ...payload });

    pendingRef.current = true;
    setIsRunning(true);
    setFailure(null);

    try {
      const response = await savingsPlansApi[action](goalId, installmentId, payload, idempotencyKey);
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
