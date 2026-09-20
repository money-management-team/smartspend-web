import { useEffect, useState } from "react";

import { ApiError } from "../api/apiClient";
import { importsApi } from "../api/importsApi";
import {
  FATAL_POLL_CODES,
  MAX_IMPORT_POLLS,
  getImportPollDelay,
  isImportInFlight,
  parseImportDetailsResponse,
} from "./importHelpers";

/*
 * Follows one import while the backend is still working on it. Confirmation
 * may answer 202 and finish asynchronously, so `validating`, `confirmed` and
 * `processing` are polled through GET /imports/{id} on a growing delay.
 *
 * One timer and one request at a time, never a second confirmation. Polling
 * stops on a final status (completed / failed / cancelled / reversed), on a
 * fatal error (404 / 403 / 401), after MAX_IMPORT_POLLS checks, and on
 * unmount. A completed import is never polled again.
 *
 * Returns { record, replace, isPolling, pollError, gaveUp, checkAgain }.
 */
export function useImportStatus(initialRecord) {
  const [record, setRecord] = useState(initialRecord);
  const [poll, setPoll] = useState({ count: 0, error: null, stopped: false });
  const importId = record?.id ?? null;
  const shouldPoll = importId != null && isImportInFlight(record) && !poll.stopped;

  useEffect(() => {
    if (!shouldPoll) return undefined;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      importsApi
        .get(importId, { signal: controller.signal })
        .then((response) => {
          const next = parseImportDetailsResponse(response)?.import;
          if (!next) throw new ApiError("", { code: "MALFORMED_RESPONSE" });

          setRecord(next);
          setPoll((current) => ({
            count: current.count + 1,
            error: null,
            stopped: current.count + 1 >= MAX_IMPORT_POLLS,
          }));
        })
        .catch((error) => {
          if (error.name === "AbortError" || controller.signal.aborted) return;

          setPoll((current) => ({
            count: current.count + 1,
            error,
            stopped: FATAL_POLL_CODES.includes(error.code) || current.count + 1 >= MAX_IMPORT_POLLS,
          }));
        });
    }, getImportPollDelay(poll.count));

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [importId, shouldPoll, poll.count]);

  return {
    record,
    // The import the backend returned from an action becomes the new state.
    replace: (next) => {
      if (next) setRecord(next);
    },
    isPolling: shouldPoll,
    pollError: poll.error,
    gaveUp: poll.stopped && isImportInFlight(record),
    // Restarts the checks after they stopped (limit or error).
    checkAgain: () => setPoll({ count: 0, error: null, stopped: false }),
  };
}
