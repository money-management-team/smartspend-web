/* The row preview of an import: the page size and the row statuses it can be narrowed to. Pure constants, shared by the read, the model and the screen. */
export const IMPORT_ROWS_PER_PAGE = 10;
// The backend's ImportRowStatus values (GET /imports/{id}/preview?status=).
export const IMPORT_ROW_STATUSES = Object.freeze(["pending", "valid", "invalid", "duplicate", "ignored", "imported", "failed", "reversed"]);
export const IMPORT_ROW_TABS = Object.freeze(["all", ...IMPORT_ROW_STATUSES]);
// The import statuses whose rows the full version previews (Imports.jsx): checked, posted, failed or reversed. Before that there are no rows to show.
export const IMPORT_ROWS_STATUSES = Object.freeze(["ready_for_review", "partially_valid", "completed", "failed", "reversed"]);
