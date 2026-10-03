# Statement import web integration

`Imports.jsx` implements the backend's eleven statement-import endpoints.
The user selects an owned account and CSV/XLSX file, uploads the file, maps
columns by numeric index, chooses default categories, validates rows and
reviews the paginated preview. Invalid or duplicate rows can be edited, and
rows can be ignored. Only valid rows post after explicit confirmation.

The confirm and reverse calls carry a stable `Idempotency-Key`. The key stays
in memory after an uncertain response so retrying the same action does not
post twice. A completed import can be reversed with a reason; that creates
opposing transactions on the backend. Confirmation returns HTTP 202 and the
page polls `GET /imports/{id}` while status is `confirmed` or `processing`.
The user must wait for `completed` before treating the import as successful.

Both Arabic and English labels cover the mapping fields, batch states and row
states. The shared API client handles token expiry and validation errors.

The backend requires a working queue worker for asynchronous posting. Staging
must set the web origin in `FRONTEND_URLS`; the web build must set
`VITE_API_BASE_URL` to the Laravel Cloud API URL including `/api`.
