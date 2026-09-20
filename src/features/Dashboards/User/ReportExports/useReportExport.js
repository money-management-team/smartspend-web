import { useEffect, useState } from "react";

import { ApiError } from "../api/apiClient";
import { reportExportsApi } from "../api/reportExportsApi";
import {
  FATAL_POLL_CODES,
  MAX_POLLS,
  getPollDelay,
  isActiveExport,
  parseExport,
} from "./reportExportHelpers";

/*
 * One export and its status polling. While the export is queued or
 * processing, GET /report-exports/{id} is called on a growing delay (one
 * timer, one request at a time, never regenerating the export). Polling stops
 * on a final status (completed / failed / expired / cancelled), on a fatal
 * error (404 / 403 / 401), after MAX_POLLS checks, and on unmount.
 *
 * Mount one instance per export (key it by id) so an export never has two
 * timers.
 *
 * Returns { record, replace, isPolling, pollError, gaveUp, checkAgain }.
 */
export function useReportExport(initialRecord) {
  const [record, setRecord] = useState(initialRecord);
  const [poll, setPoll] = useState({ count: 0, error: null, stopped: false });
  const exportId = record?.id ?? null;
  const shouldPoll = exportId != null && isActiveExport(record) && !poll.stopped;

  useEffect(() => {
    if (!shouldPoll) return undefined;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      reportExportsApi
        .get(exportId, { signal: controller.signal })
        .then((response) => {
          const next = parseExport(response);
          if (!next) throw new ApiError("", { code: "MALFORMED_RESPONSE" });

          setRecord(next);
          setPoll((current) => ({ count: current.count + 1, error: null, stopped: current.count + 1 >= MAX_POLLS }));
        })
        .catch((error) => {
          if (error.name === "AbortError" || controller.signal.aborted) return;

          setPoll((current) => ({
            count: current.count + 1,
            error,
            stopped: FATAL_POLL_CODES.includes(error.code) || current.count + 1 >= MAX_POLLS,
          }));
        });
    }, getPollDelay(poll.count));

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [exportId, shouldPoll, poll.count]);

  return {
    record,
    // The backend's answer to an action (e.g. DELETE) becomes the record.
    replace: (next) => {
      if (next) setRecord(next);
    },
    isPolling: shouldPoll,
    pollError: poll.error,
    gaveUp: poll.stopped && isActiveExport(record),
    // Restarts the checks after they stopped (limit or error).
    checkAgain: () => setPoll({ count: 0, error: null, stopped: false }),
  };
}
