# WhatsApp API integration

API adapter and contract helpers only (TASK 04). There is no WhatsApp UI yet.

## Backend reference

- Repo `money-management-team/smartspend-backend`, branch `feature/whatsapp-availability-contract`, commit `b7ca54934ad4881d8bea842b697dc77167791d71` (draft PR #3).
- **Not merged to `develop` and not assumed deployed.** Until it is, the live API may lack `GET /integrations/whatsapp` fields (`enabled`, `state`, `capabilities`), the `whatsapp_disabled` error, and `confirmation`. The parsers throw `MALFORMED_RESPONSE` on a response without them instead of guessing.
- Verified from: `routes/api.php`, `WhatsAppIntegrationController`, `WhatsAppExpenseDraftController`, the `Requests/WhatsApp/*` validators, `WhatsAppExpenseDraftResource`, `WhatsAppIntegrationResource`, `WhatsAppLinkChallengeResource`, `WhatsAppUnavailableException`, `WhatsAppExpenseDraftReadiness`, the status enums, `bootstrap/app.php` renderers, and `docs/api/API.md`.

## Files

| File | Role |
| --- | --- |
| `src/features/Dashboards/User/api/whatsappApi.js` | Endpoint functions on top of `apiRequest`. Returns backend envelopes. |
| `src/features/Dashboards/User/FinancialOperations/whatsappContract.js` | Pure helpers: request builders, response parsers, error classification, attempt helper. |
| `src/features/Dashboards/User/api/apiClient.js` | One addition: `ApiError.serverCode`. |

## Endpoints

All paths are relative to the API base (`VITE_API_BASE_URL`, already ending in `/api`).

| Function | Request |
| --- | --- |
| `getIntegration` | `GET /integrations/whatsapp` |
| `createLinkChallenge` | `POST /integrations/whatsapp/link-challenges` |
| `getLinkChallenge(token)` | `GET /integrations/whatsapp/link-challenges/{token}` |
| `confirmLinkChallenge(token)` | `POST /integrations/whatsapp/link-challenges/{token}/confirm` |
| `updatePreferences({language, default_account_id})` | `PATCH /integrations/whatsapp/preferences` |
| `unlink` | `DELETE /integrations/whatsapp/link` |
| `listDrafts(query)` | `GET /integrations/whatsapp/expense-drafts` |
| `getDraftSummary` | `GET /integrations/whatsapp/expense-drafts/summary` |
| `getDraft(id)` | `GET /integrations/whatsapp/expense-drafts/{id}` |
| `updateDraft(id, values, reviewVersion)` | `PATCH /integrations/whatsapp/expense-drafts/{id}` |
| `confirmDraft(id, {reviewVersion, idempotencyKey})` | `POST /integrations/whatsapp/expense-drafts/{id}/confirm` |
| `discardDraft(id)` | `DELETE /integrations/whatsapp/expense-drafts/{id}` |

The backend documents these `/integrations/whatsapp/expense-drafts*` routes as *compatibility aliases* of `/whatsapp/expense-drafts*` (same controller). The paths above follow the task specification; switching is a one-constant change (`DRAFTS` in `whatsappApi.js`).

Every function takes `options.signal` (where applicable) and rejects instead of throwing synchronously on invalid input. Nothing retries, caches, stores or logs.

## Availability

`parseWhatsAppAvailability` returns `{ enabled, state, capabilities, integration }` and requires `enabled` (boolean), `state` (`disabled | not_linked | linked`) and the three boolean capabilities (`can_link`, `can_manage_link`, `can_review_drafts`). Anything else is `MALFORMED_RESPONSE`.

- The backend config is the only availability source. A present `integration` never implies the feature is usable: when `state` is `disabled` an old link still appears but `can_link` and `can_manage_link` are false.
- `can_review_drafts` is true even when disabled; the draft endpoints are not gated, so historical drafts stay reachable (subject to backend permissions).
- `integration` is whitelisted to the public fields (`linked`, `status`, `workspace_id`, `phone_last_digits`, `language`, `generation`, `default_account_id`, `default_account`, `linked_at`, `revoked_at`). Nothing else passes through.

## Errors

`ApiError.code` is unchanged (status-derived: `CONFLICT` for any 409). The new `ApiError.serverCode` carries the backend's own string `code`, or `null`.

- `isWhatsAppDisabledError(error)` is `status === 409 && serverCode === "whatsapp_disabled"`. It is not a network error and is never retried.
- `classifyWhatsAppError(error)` returns one of `aborted, disabled, unauthenticated, forbidden, not_found, conflict, validation, rate_limited, timeout, network, malformed, server, unknown`.
- A 409 that is not `whatsapp_disabled` is `conflict`. For draft writes it means a stale `review_version` or a reused Idempotency-Key; the backend gives no code to tell them apart, so re-read the draft.
- `isOutcomeUncertain(error)` is true for `TIMEOUT`, `NETWORK_ERROR`, `SERVER_ERROR`, `MALFORMED_RESPONSE`.
- Input rejected before any request throws `ApiError` with `code: "WHATSAPP_INPUT_INVALID"` and `errors[field]`.
- `shouldStopChallengePolling(errorOrChallenge)`: true for `disabled`, 401, 403, 404, abort, or a challenge that is `sender_verified`, `confirmed`, `expired` or `cancelled`.

## Link challenge and token handling

- `createLinkChallenge` returns the plaintext token once, in `data.linking.token`. `parseCreatedChallengeResponse` exposes it as `linking.token`; keep it in component state only. The adapter modules contain no storage, cookie or `console` calls (enforced by a test).
- Challenges are addressed by token, never a database id. `requireChallengeToken` accepts `[A-Za-z0-9_-]{16,128}` so a token cannot change the URL path.
- Parse errors never attach the response body, so a token cannot leak through an error.
- Polling is the caller's: pass an `AbortSignal` and stop with `shouldStopChallengePolling`. Activation requires the explicit `confirmLinkChallenge` call.

## Drafts

`parseDraftResponse` / `parseDraftsPageResponse` keep the backend fields and add `canConfirmNow`.

- **Confirm button rule:** `canConfirmNow === (can_confirm === true && confirmation.ready === true)`. The backend still re-checks balance, role and version at confirmation.
- `confirmation.issues[]` is kept verbatim (`field`, `code`, `message`, and any extra keys). Unknown codes are not dropped. Known codes: `account_required, category_required, amount_required, amount_invalid, account_unavailable, account_not_usable, category_unavailable, category_not_usable, currency_mismatch, date_required, time_unresolvable`.
- Pagination: `{ items, pagination: { currentPage, perPage, total, lastPage, from, to } }`.
- Filters (`status, date, account, per_page, page`) are validated; unknown keys (e.g. `workspace_id`, `account_id`) are dropped, invalid values reject. No `workspace_id` is ever sent: the backend scopes to workspaces the user can act in and returns an empty page otherwise.
- Summary: `{ pendingReviewCount }`, same rules as the default list.

## Money, dates, time

- Amounts stay decimal strings end to end. A numeric `amount` in a response is `MALFORMED_RESPONSE`. Outgoing amounts are normalized to four decimals with string operations only (`"12.5"` becomes `"12.5000"`); zero, negatives, more than 4 decimals and numbers are refused.
- `account.current_balance` is passed through as the exact string. If it is missing or not a string it becomes `null`, never `0`. Caveat: the backend itself reports `"0.0000"` when it has no balance for an account (for example one outside the draft's workspace), and the client cannot tell that from a real zero.
- `transaction_date` and `transaction_time` are kept as sent. A missing date stays `null`; it is never replaced by today. `workspace_timezone` is preserved; the draft is dated in that zone.
- The currency is read-only (`review_values.currency_code`, follows the account). `updateDraft` rejects `currency_code`.

## Editing a draft

`updateDraft(id, values, reviewVersion)` sends `review_version` plus only the fields passed. Editable: `account_id`, `category_id`, `amount`, `description` (max 500), `transaction_date` (can change, cannot be `null`/empty), `transaction_time` (`HH:MM[:SS]` or `null` to clear). The response carries the new `review_version`. Saving never confirms and creates no transaction.

## Confirming

`confirmDraft(id, { reviewVersion, idempotencyKey, signal })`:

- Requires a caller-supplied key matching the backend rule (`[A-Za-z0-9._:-]{8,255}`); it never generates one. Use `createWhatsAppConfirmAttempt(draftId, reviewVersion)` once per logical confirmation and keep the key across retries.
- Body is exactly `{ "review_version": n }`; edits are never mixed in.
- No automatic retry. After `TIMEOUT` / `NETWORK_ERROR` / `SERVER_ERROR`, call `getDraft(id)` and use `resolveConfirmationOutcome(draft)` (`confirmed | still_open | closed`) before resending with the **same** key.
- One confirmation per draft at a time: an identical concurrent call shares the running request; a different key or version rejects with `WHATSAPP_CONFIRM_IN_FLIGHT`.
- `parseConfirmResponse` returns `{ draft, transaction }`, the transaction untouched. The financial posting stays entirely in the backend.
