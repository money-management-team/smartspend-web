# Mobile — write integration (prepared, closed)

Every Mobile form now has its request defined and a send path through the app's own API wrappers. **Every write stays closed:** `APPROVED` in `src/mobile/data/writeGate.js` is empty. With the gate closed, the review ends at a disabled button, as before, and nothing is sent; tests prove it.

Opening a write is a separate, per-write decision. It needs staging evidence and approval; see "What opens a write" in SECURITY-AND-FINANCIAL-GATES.md.

## The pieces

| File | Role |
|---|---|
| `src/mobile/forms/writePayloads.js` | Pure builders, one per form: `buildWrite(workflow, values, ctx)` gives `{ operation, ids, input, reviewVersion? }` |
| `src/mobile/data/writeGate.js` | The registry of every write (`MOBILE_WRITES`) with `moves`, `key` and `serverDedup`; `APPROVED = []` |
| `src/mobile/data/writeApi.js` | `sendWorkflowWrite(write, key)`: asserts the gate **first**, then makes the shared wrapper call; `newWriteKey(operation)` |
| `src/mobile/forms/useWorkflowSubmit.js` | One submission: one request, one key per intent, outcome classification, identity and workspace checks, cache drop |
| `src/mobile/forms/DraftForm.jsx` | The review. A closed write shows "Not sent from Mobile" and a disabled button (unchanged); an open one sends once and shows the outcome |

## Payload rules

All payloads were checked against each backend FormRequest:
- `develop` @ `fd87531`;
- `fix/financial-idempotency-p0` @ `c18d4ea`, which changed no route, request, resource or controller.

The comparison script is `formreq.mjs` in the session scratchpad. The payloads follow what the full version sends:
- **Ids:** numbers.
- **Amounts:** `wireAmount` gives no sign, no leading zeros and exactly 4 decimals. That is the backend's `MoneyAmount` pattern, and it never goes through a float.
- **Dates:** `occurred_at` is `"YYYY-MM-DD 12:00:00"`, like the full version's `toOccurredAt`.
- **Creates:** an empty optional field is left out. `workspace_id` is added where the request requires it (account, budget, goal, debt); a recurring rule's workspace is its account's.
- **Changes to a record:** only the changed fields are sent; an emptied optional text is sent as `null`. A correction also always sends its `reason`.
- **Budget:** `scope` is form-only and never sent. A general budget sends no `category_id`.
- **Debt payment:** today's date is left out, like the full version's `buildPaymentPayload`.
- **Export:** `{ report, format, filters: { from, to, currency? } }`.
- **Receipt, voice and WhatsApp reviews are two requests:**
  1. Save the reviewed values with the `review_version` that was read (`PATCH`, no key).
  2. Confirm with the version that save returned (`data.capture.review_version` or `data.draft.review_version`) and the key.

  No version in the save's answer means no confirmation.
- **Profile phone:** the form now matches `UpdateProfileRequest`: at most 20 characters, `^\+?[0-9]{7,20}$`.

## Submission rules (`useWorkflowSubmit`)

- **One request per submission.** A double tap sends once.
- **One `Idempotency-Key` per submission intent.** It is created on the first send, as `mobile-<operation>-<uuid>`, and is passed only where `MOBILE_WRITES[op].key === "client"`.
  - It is kept after an unknown outcome and cleared after a confirmed or certainly refused answer.
  - It is not renewed when the details change, like the full version's debt-payment form. After an unknown outcome the backend therefore replays the first result or refuses different values; it cannot post twice.
- **Outcomes:**
  - **Rejected:** only 422, 403, 404 and 429 (Laravel's throttle runs before the controller), plus a closed gate or a missing workspace.
  - **Unknown:** everything else, including 409, a 5xx, a timeout, the network or a malformed answer. An unknown write is never resent, and the form offers no resend.
  - **Session ended:** a 401 ends the session.
  - **Workspace changed:** if the workspace changed while the request was in flight, the outcome is reported as "changed".
- **Nothing is stored:** no retry, no queue, nothing in storage. After anything but a certain refusal, the cached reads are dropped.

## Backend status per write (`serverDedup`)

| Value | Writes |
|---|---|
| `key-atomic` | transfer; goal contribution and withdrawal (via `TransferMoneyAction`); recurring confirm-next; receipt, voice and WhatsApp confirm |
| `key-fix-pending` | expense, income, correction, debt payment. Atomic only on the unmerged `c18d4ea` |
| `once-only` | transaction, transfer and debt-payment reversal; account archive |
| `unique-index` | category create and rename |
| `same-result` | the record updates (`PATCH`/`PUT`) |
| `duplicates` | account, budget, goal, debt, rule, planned contribution and export creates: no key and no unique rule |
| `unverified` | recurring skip-next; password change |

A money write is never registered as `duplicates`; a test enforces that.

**Correction to the 2026-11-01 audit.** Receipt **confirmation** was listed as affected by the completion window. It isn't:
- `AiCaptureConfirmationService` runs it in one outer transaction with a row lock and posts through `PostExpenseAction`.
- The non-atomic `run()` in `AiExpenseCaptureController` is the **upload** (`ai_receipt_upload`), which moves no money.

## Remaining backend API blockers

These are concise and source-backed. Opening each Mobile write depends on its row.

1. **Fix not deployed:** the P0 fix is unmerged and undeployed (`c18d4ea` versus `develop`/production `fd87531`). Expense, income, correction and debt payment stay closed until it is merged, deployed and the production commit is confirmed.
2. **Creates without duplicate protection:** account, budget, goal, debt, recurring rule, planned contribution and report export creates take no `Idempotency-Key` and have no unique rule, so a request the browser delivers twice creates two records. They need an optional key or a natural unique rule before Mobile sends them.
3. **`skip-next` is not specific:** `POST /recurring-transactions/{id}/skip-next` names no occurrence and takes no key, so whether a duplicate skips a second occurrence is not established. It needs the occurrence (id or date) in the request, or a key.
4. **Password change is ambiguous:** a copy that arrives after success fails on the current password (422), so the answer can say "refused" for a change that happened. It needs a key, or an answer that can be told apart.
5. **Reversal conflicts are indistinguishable:** a 409 from a reversal ("already reversed") can't be told apart from other 409s by the client, so Mobile reports it as unknown. A stable error `code` (for example `already_reversed`) would let the screen say "already done".
6. **Import batches:** confirm and reverse still use `run()` without `atomic` (row posting is atomic on `c18d4ea`). The backend team lists import reconciliation as open; Mobile import writes stay closed.
7. **Already acknowledged by the backend team:** stuck-`processing` key recovery; review of unclassified financial paths; production revision and database engine; staging.

Not a backend blocker: funding preview. Its evidence is complete (BACKEND-VERIFICATION-RESULTS.md §7), and enabling it is the product owner's Decision B.

## Tests

- **`tests/mobileWriteIntegration.test.mjs`**:
  - exact payloads per form and the amount wire format;
  - every operation refuses before any request while the gate is closed, and a keyed write refuses without a key;
  - outcome classification;
  - with one write opened by the test switch: a single POST with the exact body and key; a double tap sends once; a 500 and a 409 are unknown and never resent; a 422 is a refusal with the server's words and a new key after it;
  - the receipt two-step flow, including no confirm without a version.
- **Guard tests, updated to the new invariants:**
  - `tests/mobileForms.test.mjs`: every form write is registered, has a send path and a payload, and is closed;
  - `tests/mobileWriteGate.test.mjs`: the registry is exactly the form writes plus categories, all closed;
  - `tests/mobileReadOnly.test.mjs`: the write facade's imports, its exact wrapper calls, the gate assertion as `sendWorkflowWrite`'s first statement, and the only two importers of the facade.
- **Fake backend:** `tests/helpers/mobileApi.mjs` `FORM_WRITES` lists the only form requests a test may allow. Anything else is still a violation.
