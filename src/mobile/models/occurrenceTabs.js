/* A rule's occurrence history: the page size and the statuses it can be narrowed to. Pure constants, shared by the read, the model and the screen. */
export const OCCURRENCES_PER_PAGE = 10;
// The backend's OccurrenceStatus values (GET /recurring-transactions/{id}/occurrences?occurrence_status=).
export const OCCURRENCE_STATUSES = Object.freeze(["scheduled", "due", "posted", "skipped", "failed", "cancelled"]);
export const OCCURRENCE_TABS = Object.freeze(["all", ...OCCURRENCE_STATUSES]);
