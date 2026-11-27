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
  - **Rejected:** only 422, 403, 404 and 429 (Laravel's throttle runs before the controller). Also rejected: a closed gate, a missing workspace, or a key that could not be written to storage (nothing was sent in all three).
  - **Possible duplicate:** a 409 whose body carries the backend's `possible_duplicate` code and the matched transaction (`data/possibleDuplicate.js`). The form asks the person. Confirming resends the same write with the same key plus `confirm_possible_duplicate: true`; cancelling sends nothing.
  - **Unknown:** everything else, including any other 409, a 5xx, a timeout, the network or a malformed answer. An unknown write is never resent automatically.
  - **Session ended:** a 401 ends the session.
  - **Workspace changed:** if the workspace changed while the request was in flight, the outcome is reported as "changed".
  - **Tier 2 creates with no replay (account and budget create):** after an unknown outcome (lost answer, 408, 5xx) or a refusal by their unique rule (422 on `name` for `POST /accounts`, on `category_id` for `POST /budgets`, `BudgetUniqueness`), the earlier attempt may be the record that is there. The outcome says so ("may be the account/budget you added … Nothing new was recorded by this request"), offers **Check your accounts / Check your budgets**, and the cached reads are dropped so the list comes from the server. Only the field the backend names decides (`isExistingRecordRefusal`), never the message. Nothing is resent and nothing is claimed as created. A budget race answer (409 with no code, `DuplicateBudgetException`) stays unknown. Category create already does the same in its own form (`categories/useCategoryMutation.js`). Tests: `tests/mobileWriteIntegration.test.mjs`.
- **What is stored:** only the submission's key and a hash of `{operation, ids, input}`, per user, workspace and operation, for 24 hours (`data/pendingWriteStorage.js`). That lets a reload retry with the same key. The input itself, amounts and the token are never stored. There is no retry, no queue and no replay. After anything but a certain refusal or a possible duplicate, the cached reads are dropped.

## Backend status per write (`serverDedup`)

| Value | Writes |
|---|---|
| `key-atomic` | transfer; goal contribution and withdrawal (via `TransferMoneyAction`); receipt, voice and WhatsApp confirm; receipt and voice upload; expense, income and goal create (atomic on production backend `a82197f`, 2026-11-27) |
| `key-fix-pending` | correction, debt payment; debt and recurring-rule create; Smart Savings confirm. The fix is deployed (`a82197f`), but these keep this class until their own source re-check reclassifies them |
| `once-only` | transaction, transfer and debt-payment reversal; account archive |
| `unique-index` | category create and rename; account create (unique `workspace_id, name`); budget create (unique `active_uniqueness_key`) |
| `same-result` | the record updates (`PATCH`/`PUT`) |
| `next-open` | recurring confirm-next and skip-next. **Never approvable** |
| `duplicates` | planned contribution and export creates: no key and no unique rule |
| `unverified` | password change |

Two invariants are enforced by `tests/mobileWriteGate.test.mjs`:
- A money write is never registered as `duplicates`.
- A write whose classification is in `NEVER_APPROVABLE` (`next-open`) stays closed even when it is listed in `APPROVED` or the test switch. The shipped `APPROVED` must not name one either.

**`unique-index` is not idempotency.** The database refuses the copy, so no second record is created, but nothing replays the first answer.
- A copy is refused with 422: on `name` for an account, by `StoreBudgetRequest` for a budget.
- A copy that races the first passes validation and is stopped by the index. On `develop` @ `fd87531` that answer is a 500. On the fix branch @ `6b696d72` (`296602e0`) it is a 422 for an account and a 409 (`DuplicateBudgetException`) for a budget.
- So after a lost answer, a refusal can come for a create that happened. The category form drops its cached reads after such a 422. `forms/useWorkflowSubmit.js` does not: it reports the 422 as a refusal. Account and budget create stay closed.

**`next-open`: recurring confirm-next and skip-next** (`RecurringTransactionController` `confirmNext`, `skipNext` and `nextOpenOccurrence`, on `develop` @ `fd87531` and `6b696d72`).
- The request names no occurrence. The backend takes the rule's next open occurrence (scheduled or due) when the request arrives.
- `PostOccurrenceAction` doesn't check that the occurrence is due.
- `RecurringScheduleService::advance` creates the next occurrence as soon as one is posted.
- A copy of the request therefore acts on the **following** occurrence: confirm-next posts the next period's money under that occurrence's own derived key, and skip-next skips a second period.
- The derived key can't stop this, because it is a different occurrence. The full version sends the same requests.
- This needs a backend change that names the occurrence in the request.

**Occurrence-specific confirm and skip (frontend done; backend change uncommitted).**
- **Backend:** the change exists only as uncommitted work in the `fix/financial-idempotency-p0` worktree, on top of `6b696d72`; nothing deployed takes it. Both endpoints then require `occurrence_id`. Under the rule lock it must still be the earliest open occurrence; otherwise the answer is 409 `recurring_occurrence_not_next` or `recurring_occurrence_not_open`, and nothing changes. A repeat of a request that already settled the occurrence gets that result back.
- **Desktop** sends the rule's `schedule.next_occurrence.id`. **Mobile** does the same (`pickRule` → `nextOccurrenceId`, `forms/writePayloads.js`); a rule with no open occurrence is ineligible (`noOpenOccurrence`).
- Tests: `tests/recurringOccurrence.test.mjs`.
- Both writes stay `next-open` and never approvable until that backend change is merged, deployed and its production commit confirmed. Only then does the classification change, in a reviewed commit.

**Correction to the earlier `serverDedup` values** (2026-11-15):
- confirm-next was `key-atomic`; skip-next was `unverified`.
- Account and budget create were `duplicates`. That missed the unique indexes, which `develop` already has.

**Correction to the 2026-11-01 audit.** Receipt **confirmation** was listed as affected by the completion window. It isn't:
- `AiCaptureConfirmationService` runs it in one outer transaction with a row lock and posts through `PostExpenseAction`.
- The non-atomic `run()` in `AiExpenseCaptureController` is the **upload** (`ai_receipt_upload`), which moves no money.

## Remaining backend API blockers

These are concise and source-backed. Opening each Mobile write depends on its row.

1. **Fix not deployed:** the P0 fix is unmerged and undeployed (`c18d4ea` versus `develop`/production `fd87531`). Expense, income, correction and debt payment stay closed until it is merged, deployed and the production commit is confirmed.
2. **Creates without duplicate protection:**
   - Planned contribution and report export creates take no `Idempotency-Key` and have no unique rule, so a request the browser delivers twice creates two records.
   - Goal, debt and recurring-rule creates are protected by a required key only on the fix branch.
   - For exports, the fix branch returns the in-flight export for an identical request (`2ebd0099`); `develop` does not.
   - Account and budget creates are covered by unique indexes; see `unique-index` above.
3. **Recurring confirm-next and skip-next act on the next open occurrence** (`next-open` above). A duplicate request confirms or skips the following occurrence. Both need the occurrence (id or due date) in the request, refused when it is not the open one named. Until then both are never approvable from Mobile.
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
  - `tests/mobileWriteGate.test.mjs`:
    - the registry is exactly the form writes plus categories and the receipt and voice uploads, all closed, each with a known classification;
    - the expected `serverDedup` of every write;
    - the `next-open` writes stay closed even when listed in `APPROVED` (checked on a compiled copy of the gate);
    - the shipped `APPROVED` names no never-approvable write;
  - `tests/mobileReadOnly.test.mjs`: the write facade's imports, its exact wrapper calls, the gate assertion as `sendWorkflowWrite`'s first statement, and the only three importers of the facade (`categories/MobileCategoryForm.jsx`, `forms/useWorkflowSubmit.js`, `assist/useCaptureUpload.js`).
- **Fake backend:** `tests/helpers/mobileApi.mjs` `FORM_WRITES` lists the only form requests a test may allow. Anything else is still a violation.
