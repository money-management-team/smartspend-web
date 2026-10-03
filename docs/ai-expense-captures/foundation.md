# AI Expense Captures — Foundation (Task 1)

What the audit found, what Task 1 created, and what is deliberately still missing.

> **Corrected in Task 2.** Task 1 had `isCaptureVersionConflict` identify a stale `review_version` by a **409**. The API contract rejects it as a **422** instead, so the helper now looks for `VALIDATION_ERROR` *and* an actual `review_version` signal (the `errors.review_version` key, otherwise the message wording). A blanket 422 is still an ordinary validation error. See [review-model.md](review-model.md).

## Audit result

**No Sprint 7 code existed.** A repository-wide search for `expense-captures`, `ai/expense-captures`, `ai_suggested_values`, `review_values`, `review_version`, `confirmed_transaction_id`, `receipt_ocr`, `OCR` and related terms found no pages, components, API wrappers, routes, constants, hooks, services, mock data or documentation for this feature.

Two adjacent findings mattered:

- **`ready_for_review` already exists** as an *Imports* status (`importHelpers.js`, `dashboard.importPage.statuses.*`). Same words, unrelated lifecycle. The two vocabularies stay separate — no shared constants, translation keys or badge component.
- **`FinancialOperations/components/ReceiptCapture/`** is a local-only placeholder that says receipt scanning is not connected to the server. It is the natural entry point to this feature later; it was not changed.

## Reused, not rebuilt

| Need | Existing infrastructure |
| --- | --- |
| HTTP, envelope, `ApiError` codes, 401 session expiry | `api/apiClient.js` → `apiRequest` |
| Binary `/source` response | `apiDownload`, `getContentDispositionFilename`, `saveBlobAsFile` — precedent: `reportExportsApi.download` |
| Idempotency for Retry and Confirm | `createIdempotentAttempt` (`transactionHelpers.js`), `createIdempotencyKey` (`apiClient.js`) |
| Confirmation dialog, insufficient-balance detection | The `account-form-modal` shell and `isInsufficientBalanceError` (`transactionHelpers.js`) |
| Status polling while the backend works | The `useImportStatus` shape: one timer, growing delay, a poll cap (pattern to follow, not a hook to share) |
| Laravel paginator parsing | `parsePage(response, key)` (`SavingsGoals/savingsGoalHelpers.js`) |
| Money | `toMoneyString`, `sumMoney`, `subtractMoney`, `formatMoney`, `getAmountError` |
| Currencies | `ACCOUNT_CURRENCIES` (`Accounts/accountHelpers.js`) |
| Accounts / categories for the review form | `accountsApi`, `categoriesApi` |
| Query allow-listing | `pickQuery` (`apiClient.js`) |
| Loading / error / empty states | `components/Loading/Loading`, `getApiErrorMessage` |
| Status badge pattern | `ImportStatusBadge`, `TransactionStatusBadge` (pattern to copy, not components to share) |
| Page data-fetching shape | `useCallback` loader + `AbortController` effect, per CLAUDE.md |

Nothing above needed a Sprint 7 variant, and none was created.

## Files created

```
src/features/Dashboards/User/AiExpenseCaptures/
  captureConstants.js   statuses, status groups, field lists, per-page, confirm prefix
  captureHelpers.js     lifecycle predicates, suggestion/review accessors, review_version
docs/ai-expense-captures/
  overview.md           purpose, statuses, lifecycle, action rules, routing and sidebar plan
  review-model.md       suggestions vs review values, review_version, money, idempotency, source
  foundation.md         this file
```

No `components/` folder yet: an empty one would be noise. Task 2 created it with its first components.

## Files modified

None. Task 1 changed no existing file — no routes, no sidebar, no locales, no API modules.

## Design decisions

**Predicates take a `status`, not a record.** `getCaptureStatus(capture)` extracts it once, then `canConfirmCapture(status)` reads plainly at the call site. Imports pass the whole record because their rules also depend on row counts and `is_editable`; Sprint 7's rules depend only on the status, so the narrower signature is honest about that.

**`failed` is not final.** `isCaptureFinal` covers only `confirmed` and `discarded`. Retry can move a failed capture back into processing, so treating it as final would hide the retry action.

**`uploaded` counts as processing.** `isCaptureProcessing` includes it because nothing in the UI can advance it — only the backend queues it. The UI shows the same pending state; discard is governed separately by `canDiscardCapture`.

**No merged value object.** See [review-model.md](review-model.md). The form seeds from `review_values` and shows each AI hint beside its field.

**No state-machine framework.** Seven statuses and six predicates, each a one-line array check. A transition table would be harder to read and to change than the thing it models.

## Deliberately not implemented

*(Task 2 added `GET /ai/expense-captures`, the list page, its route and the sidebar entry — see [list.md](list.md). Task 3 added `GET /ai/expense-captures/{id}` and the read-only review screen — see [details.md](details.md). Task 4 added the source/receipt infrastructure — see [source.md](source.md). Task 5 added `PATCH /ai/expense-captures/{id}` and the editable draft — see [editing.md](editing.md). Task 6 added `POST /ai/expense-captures/{id}/retry` and status polling — see [retry.md](retry.md). Task 7 added `POST /ai/expense-captures/{id}/confirm`, the only action that creates financial state — see [confirm.md](confirm.md). Task 8 added `DELETE /ai/expense-captures/{id}` — see [discard.md](discard.md). **All seven documented endpoints are now integrated**, so the only items below that still stand are the ones about what the contract itself does not offer.)*

- ~~**Discard.**~~ `aiExpenseCapturesApi.js` now exposes all seven: `list`, `get`, `downloadSource`, `update`, `retry`, `confirm` and `discard`. Only `confirm` creates anything — `update` edits the review draft, `retry` requeues AI processing, `discard` abandons the draft.
- ~~**No upload flow.**~~ The Sprint 7 contract still documents no create endpoint. One was wired later from the product flow diagram — see [upload.md](upload.md) — with every assumed value collected in `captureConstants.js` and a missing route reported honestly.
- ~~**No discard UI.**~~ Task 5 added the editable draft and its `PATCH`, Task 6 added Retry, Task 7 added Confirm — the one of the four that moves money — and Task 8 added Discard.
- **The receipt preview is built but unreachable.** Task 4 added the source infrastructure and UI; the contract delivers no signed URL, so the section never renders. See [source.md](source.md).
- **No Task 3+ locale keys.** Task 1 rendered nothing so it added none; Task 2 added only what its page renders. Speculative keys for later tasks stay out, and EN/AR parity is checked whenever keys are added.
- **No mock captures, AI suggestions, transactions or confidence values.** Nothing fake makes this look further along than it is.
- **No error-wording helper.** The list uses the shared `getApiErrorMessage`; a `getCaptureErrorMessage(error, t, context)` following `getImportErrorMessage` is only worth adding once the write endpoints need context-specific wording.

## Verification

ESLint clean on both new files. `npm run build` succeeds. No dependencies added.
