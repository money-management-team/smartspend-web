# Statement imports — step-by-step flow

Every step sends one request and replaces the shown import with the one the backend returns. No step advances the wizard on its own; `getImportStep(record)` in `importHelpers.js` derives the step from the record each render.

## 1. Upload — `POST /imports`

`multipart/form-data`, built as a real `FormData` in `importsApi.upload` and handed to `fetch` untouched, so the browser writes the `Content-Type` with its boundary. `apiRequest` detects a `FormData` body and skips its JSON `Content-Type` for exactly this reason.

Fields: `workspace_id` (from `resolveWorkspaceId()`), `file`, `has_header` (`"1"` / `"0"`, the values Laravel's `boolean` rule accepts), `date_order`, `decimal_separator`. Upload timeout is 120 s.

Response: `data.import` + `data.suggested_mapping` (`{ field: column index }`), parsed by `parseUploadResponse`.

Only `.csv` and `.xlsx` can be chosen (`validateImportFile`); the backend still has the final word. **Uploading is not a money-moving write and carries no `Idempotency-Key`.**

### Parsing options

`date_order` and `decimal_separator` are sent from `DATE_ORDER_OPTIONS` / `DECIMAL_SEPARATOR_OPTIONS` in `importHelpers.js`. Both currently hold only `"auto"`, the sole value the API contract confirms, so `UploadStatement` renders no select for them — a guessed enum would be rejected as a 422 or, worse, parse the statement wrongly. Each select appears by itself as soon as its list holds more than one value; adding a backend-confirmed value to the list is the only change needed.

## 2. Mapping — `POST /imports/{id}/mapping`

Body: `mapping` (`{ field: zero-based column index }`), `account_id`, `default_expense_category_id`, `default_income_category_id`.

The form is prefilled from the saved mapping, or from the upload's `suggested_mapping`. Accounts and categories come from the existing `accountsApi` / `categoriesApi` — archived accounts are filtered out, and the expense default only offers expense categories.

`validateMappingForm` checks for a date column, an amount source (one signed column, or debit and credit), and an account before sending. The backend validates again and its 422 field messages are split back onto the form by `splitMappingErrors`.

## 3. Validate — `POST /imports/{id}/validate`

No body. The backend rebuilds and classifies every row and returns `data.import` with the counts `total`, `valid`, `invalid`, `duplicate`, `ignored`, `imported`, `failed` (`COUNT_KEYS`).

**Validation posts nothing.** It only classifies rows.

## 4. Review — `GET /imports/{id}/preview`

Query: `per_page`, `page`. `data.rows` is a Laravel paginator, so the rows are in `data.rows.data`; `parsePreviewResponse` reads it through the shared `parsePage` helper. `data.import` refreshes the counts on every page.

Each row shows its status, the parsed values, the backend's errors (by `code`, keeping its message), duplicate information, and the original file cells — which are displayed exactly as uploaded and never edited.

### Correcting a row — `PATCH /imports/{id}/rows/{rowId}`

Only the fields the user changed are sent, restricted to `ROW_FIELDS` (`transaction_date`, `transaction_type`, `amount`, `description`, `category_id`). `raw`, `status`, `errors` and `currency` are never sent: the backend keeps the original cells and revalidates the row itself. Amounts go through `toMoneyString`.

The response `data.row` and `data.import` replace the row and the counts.

### Ignoring a row — `POST /imports/{id}/rows/{rowId}/ignore`

No body. The row **stays in the list** with `status: "ignored"` and a note explaining that it will be left out; it is never removed locally, so the review stays a faithful audit of the file. The returned `data.row` and `data.import` are the source of truth, exactly as for a correction.

## 5. Confirm — `POST /imports/{id}/confirm`

See [business-rules.md](business-rules.md) and [idempotency.md](idempotency.md). In short: a required `Idempotency-Key`, no body, an answer that may be `202`, and an outcome screen that polls rather than assuming completion.

## 6. Outcome

`ImportOutcome` shows one of five faces — processing, completed, failed, cancelled, reversed — and polls `GET /imports/{id}` through `useImportStatus` while the status is `validating`, `confirmed` or `processing`. A completed import offers Reverse; a cancelled or reversed one is read-only.

## Resume after a reload

The import id lives in the URL as `?import={id}`. On mount, or whenever the URL id differs from the loaded import, `Import.jsx` reads the import back through **`GET /imports/{id}`** — the canonical state endpoint, which also returns `suggested_mapping` while the file is still unmapped.

The wizard therefore resumes at the step the backend's status implies:

| Status | Resumes at |
|---|---|
| `mapping_required`, or no mapping | Mapping |
| mapped but not validated since | Validate |
| `ready_for_review`, `partially_valid` | Review |
| `confirmed`, `processing`, `validating` | Outcome, polling |
| `completed` | Outcome, with Reverse |
| `failed`, `cancelled`, `reversed` | Outcome, read-only |

Refreshing the browser never loses the workflow, and no step depends on React state created during the upload.

## History — `GET /imports`

`ImportHistory` sends `workspace_id`, `status`, `account_id`, `per_page`, `page`. `data.imports` is a Laravel paginator read through `parseImportsPage`; the rows are in `data.imports.data` and paging is the backend's, never a client-side slice.

Each row offers only the action its status allows, from `getImportNextAction`: Continue, Validate, Review, View status, or View details. Every action opens the wizard at `?import={id}`, which resumes from the backend state as above.
