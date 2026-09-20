# Statement imports — overview

The import wizard (`/dashboard/import`, `PATH.USER.IMPORT`) turns a bank statement file into real transactions. The import history (`/dashboard/import/history`, `PATH.USER.IMPORT_HISTORY`) lists every import in the workspace. Both sit under `RequireAuth` → `DashboardLayout` and both are linked from the sidebar.

The backend parses the file, classifies every row, owns every status and count, and posts the transactions. The frontend never parses a statement, never decides whether a row is valid, and never adjusts a balance itself.

## The workflow

```
Upload → Map columns → Validate → Review (fix / ignore rows) → Confirm
                                                                  ↓
                                              Confirmed / Processing (polled)
                                                                  ↓
                                                      Completed → Reverse → Reversed
                                                      Failed

Before confirmation, at any step:  Cancel → Cancelled
```

Only **Confirm** and **Reverse** move money. Everything before confirmation is reversible by simply cancelling, because nothing has been posted yet.

## Endpoints

| Step | Endpoint | Module function |
|---|---|---|
| Upload | `POST /imports` | `importsApi.upload` |
| Mapping | `POST /imports/{id}/mapping` | `importsApi.saveMapping` |
| Validate | `POST /imports/{id}/validate` | `importsApi.validate` |
| Preview rows | `GET /imports/{id}/preview` | `importsApi.preview` |
| Correct a row | `PATCH /imports/{id}/rows/{rowId}` | `importsApi.updateRow` |
| Ignore a row | `POST /imports/{id}/rows/{rowId}/ignore` | `importsApi.ignoreRow` |
| Confirm | `POST /imports/{id}/confirm` | `importsApi.confirm` |
| Reverse | `POST /imports/{id}/reverse` | `importsApi.reverse` |
| Cancel | `POST /imports/{id}/cancel` | `importsApi.cancel` |
| History | `GET /imports` | `importsApi.list` |
| Details / resume / poll | `GET /imports/{id}` | `importsApi.get` |

All of them live in one module, `src/features/Dashboards/User/api/importsApi.js`, on top of `apiRequest`.

## Screen layout

1. **Header** — title and a link to the import history.
2. **Stepper** (`ImportSteps`) — upload, map, validate, review, confirm. The current step is derived from the backend record by `getImportStep`, never from a local flag.
3. **Summary card** (`ImportSummary`) — file, account, status badge, counts, timestamps, and the context actions (change mapping, cancel, start over).
4. **Step panel** — one of `UploadStatement`, `ImportMapping`, `ImportValidate`, `ImportPreview`, `ImportConfirm`, or `ImportOutcome`.

## Files

| Path | Responsibility |
|---|---|
| `Import/Import.jsx` | Wizard shell, step routing, resume-after-reload |
| `Import/importHelpers.js` | State machine, parsers, error wording, poll timing |
| `Import/useImportStatus.js` | Polls `GET /imports/{id}` while an import is in flight |
| `Import/components/UploadStatement/` | Step 1 |
| `Import/components/ImportMapping/` | Step 2 |
| `Import/components/ImportValidate/` | Step 3 |
| `Import/components/ImportPreview/` + `ImportRowCard/` + `ImportRowEditor/` | Step 4, row corrections and ignore |
| `Import/components/ImportConfirm/` | Step 5, the money-moving confirmation |
| `Import/components/ImportOutcome/` | Processing / completed / failed / cancelled / reversed |
| `Import/components/ImportReverse/` | Reversal, with its required reason |
| `Import/components/ImportCancel/` | Cancel before confirmation |
| `ImportHistory/` | `GET /imports` list page and its rows |

See [flow.md](flow.md) for the step-by-step contract, [business-rules.md](business-rules.md) for the financial rules, [idempotency.md](idempotency.md) for confirm and reverse safety, and [edge-cases.md](edge-cases.md) for error behaviour.
