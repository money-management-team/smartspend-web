# AI Expense Captures — Editing the reviewed draft

`PATCH /ai/expense-captures/{id}` and the editable Review values section on `/dashboard/ai-expense-captures/:captureId`.

> **This saves a draft. It moves no money.** No transaction, no ledger entry, no balance change, no budget change — and so nothing on the page refreshes a financial total after a save. The expense is created only by Confirm — see [confirm.md](confirm.md).

## Endpoint

`aiExpenseCapturesApi.update(captureId, payload, { signal })` → `apiRequest("/ai/expense-captures/{id}", { method: "PATCH", body })`. Fetch-based, no axios, and no second API module: this is the same `aiExpenseCapturesApi` the list and details already use. `VITE_API_BASE_URL` already ends in `/api`, so the module's path carries no `/api` prefix of its own.

No component calls `apiRequest` directly. The page owns the request and hands the form an `onSave(payload)` that throws on failure, which is the same shape `DebtForm` and the other write forms in this project use.

### No Idempotency-Key

Sprint 7 calls one *recommended but not required* here, and this project reserves idempotency keys for money-moving writes (`POST /transfers`, `POST /transactions/income|expense`, `PATCH /transactions/{id}`). A draft update creates nothing, so a replayed PATCH is simply the same draft saved again — and stale-version rejection already guards the interesting case. **Nothing new was built for it.** `CONFIRM_ATTEMPT_PREFIX` is still waiting for Confirm, which will need one.

## Request

```json
{
  "review_version": 2,
  "amount": "25.0000",
  "currency_code": "ILS",
  "description": "Food receipt"
}
```

`review_version` is **required**. Everything else is optional, and only the fields the user actually changed are sent — PATCH is a partial update, so an untouched field is not resent.

`CAPTURE_EDITABLE_FIELDS` is the allow-list the payload is built from:

```
account_id        category_id       merchant_name
amount            currency_code     transaction_date
transaction_time  reference_number  tax_amount
fee_amount        description
```

Nothing outside it can be sent, even if a caller puts it in the form object: **not** `ai_suggested_values`, `status`, `confirmed_transaction_id`, a source URL, a confidence value, `user_id` or `workspace_id`. Ownership and workspace scoping are the backend's, from the bearer token.

Ids are sent as numbers (`"account_id": 3`), matching the contract's example. Money is sent as a 4-decimal string.

### Clearing a field

A field the user empties is sent as `null`, which is this project's existing convention for clearing an optional field (`buildUpdatePayload` in `recurringHelpers.js`). Omitting it instead would leave the UI showing an empty field while the backend still held a value.

> The contract documents no explicit clearing semantics. `null` is the project convention applied to an undocumented case, not something the contract states — worth confirming with the backend.

## Read / write separation

| | Read | Write |
| --- | --- | --- |
| `ai_suggested_values` | Shown in its own section | **Never** |
| `review_values` | Seeds the form | The only thing PATCH changes |
| `status`, `warnings`, `confirmed_transaction_id`, `source_type` | Shown | Never |

The form initialises from **`review_values` and nothing else**. No AI suggestion is copied into it, at any confidence, and there is no "accept all" action — a suggestion the user never looked at must not become the value that gets recorded. The two objects are never merged, spread over one another, or normalised into a single object; the AI's keys are its own and need not match the review fields anyway (`total_amount` vs `amount`).

`merchant_name` is an ordinary editable field: what the user typed is never replaced by the AI's merchant.

## Editability

Editing is offered **only** when `canReviewCapture(status)` — that is, `ready_for_review`. The check comes from the shared helper; no status string is compared in a component.

For `uploaded`, `queued`, `processing`, `failed`, `confirmed` and `discarded` the section renders the read-only `<dl>` exactly as before, with **no Save action at all** — nothing that looks functional and isn't.

`ReviewValues` is one component with two presentations, not two components: the same section, header, labels and CSS prefix, so there is no duplicate review form to keep in sync.

**The draft values are owned by the page**, not by this component (a change made in Task 7). Confirm has to save unsaved edits before it posts, and then confirm against the version that save returned — a draft hidden inside the form would be invisible to it. Everything else here stays local: validation, touched fields, saving and conflicts. The page seeds the values from `review_values` per fetch, so a reload still rebuilds them from the server's copy.

## Form fields

| Field | Control | Notes |
| --- | --- | --- |
| `account_id` | `<select>` | Eligible accounts, with the currency shown |
| `category_id` | `<select>` | Expense categories |
| `merchant_name` | `<input type="text">` | No documented maximum, so none is invented |
| `amount` | `<input inputMode="decimal">` | Decimal string |
| `currency_code` | `<select>` | `getCurrencyOptions()` |
| `transaction_date` | `<input type="date">` | `YYYY-MM-DD` |
| `transaction_time` | `<input type="time">` | `HH:mm` or `HH:mm:ss` |
| `reference_number` | `<input type="text">` | `maxLength` 120 |
| `tax_amount` / `fee_amount` | `<input inputMode="decimal">` | Decimal strings |
| `description` | `<textarea>` | `maxLength` 500 |

`maxLength` stops the two bounded fields at the limit as the user types, so the UI never truncates text after the fact behind their back. No character counter was added: no form in this project has one, and inventing the pattern here would be inconsistent.

## Accounts

The existing `accountsApi.list` — no new accounts service. It is called with the documented `id_workspace` filter for the session's workspace, and it already returns active accounts only.

`getEligibleAccounts(accounts)` then applies the rule the contract states: **active, and never a savings-goal container** (a goal's money only moves through the goal's own flow). That helper is `recurringHelpers`', reused rather than written a third time.

No account id is ever hard-coded, and no backend query parameter was invented.

## Categories

The existing `categoriesApi.list`, called with the documented `workspace_id` and `type=expense` filters — the supported mechanism rather than fetching everything and filtering. `getExpenseCategories(categories)` filters again on `type === "expense"` and `is_active !== false`, so an **income category can never be offered as a valid expense selection** even if the filter were ignored.

### A value that isn't in the list

If the saved `account_id` or `category_id` isn't in the loaded list — archived, another type, or the list simply hasn't arrived — it is still rendered as an option, showing `#3`. Dropping it would silently clear a field the user never touched, and the next save would then wipe it.

## Currency

`currency_code` has no list of its own. `getCurrencyOptions(...)` supplies the project's shared `ACCOUNT_CURRENCIES`, the workspace's base currency, and whatever the draft and the selected account already use — so a value the backend sent is never dropped from the options. `ILS` and `USD` are examples in the guide, not the list.

**Choosing an account syncs the currency** to that account's `currency_code`. The backend rejects a currency that isn't the account's, and leaving a knowingly mismatched value selected would only produce a 422.

Only the code changes. **The amount is never touched: this is not a conversion and no rate is applied.** A €25 receipt booked to a USD account stays `25.0000` — with a different currency code, which is the user's decision to make.

If the user then picks a different currency by hand, validation says so before the request is made.

## Money

`amount`, `tax_amount` and `fee_amount` are strings from end to end. Nothing is ever parsed into a float — not for comparison, not for storage, not for the payload.

- The form shows them without trailing zeros for editing (`"25.0000"` → `"25"`), exactly as the transaction correction form does.
- A typed value is **not** rewritten while the user types. Normalisation happens once, at comparison and submission, through `toMoneyString`.
- That normalisation is also what keeps a re-typed `"25.00"` from counting as a change to a saved `"25.0000"`.

## Date and time

`transaction_date` is `YYYY-MM-DD` in and out, from a native date input. It is never locale-formatted before sending.

`transaction_time` accepts both documented forms. Seconds are kept when they carry information and dropped only when they are `:00` — the same instant. **Nothing invents `:00` for a time the user typed as `HH:mm`**, and no time-zone conversion is applied: these are wall-clock times printed on a receipt, not instants.

## Validation

Client-side validation is for speed; the backend stays the authority.

| Field | Rule |
| --- | --- |
| `amount` | Positive decimal, at most 4 decimals (`getAmountError`) |
| `tax_amount`, `fee_amount` | Format only: at most 4 decimals |
| `currency_code` | Three letters, and the selected account's currency |
| `transaction_date` | `YYYY-MM-DD` |
| `transaction_time` | `HH:mm` or `HH:mm:ss` |
| `reference_number` | ≤ 120 characters |
| `description` | ≤ 500 characters |

Two deliberate absences:

- **No field is required.** Every PATCH field is documented as optional, and a draft may legitimately be incomplete. Inventing a required field would block saving work in progress; what completeness Confirm demands is Confirm's business.
- **Tax and fee get format checks only.** They are documented as monetary fields and nothing more, so whether either may be negative — or zero — is the backend's rule to state. A zero tax is accepted here and the backend decides.

A client error appears once the user has touched the field, or after a save is attempted, so a draft that arrives incomplete isn't covered in red on arrival.

## review_version

The backend is its only author.

1. The form sends the newest version the backend has given it, read from the capture with `getReviewVersion`.
2. A successful save returns a newer version, which replaces it.
3. The next save uses that one.

It is never incremented locally, never guessed, and **never defaulted to `0`** — a capture with no usable version produces no payload at all, and the form says so instead of saving.

> `getReviewVersion` was corrected in this task. It read the value with `Number()`, and `Number(null)` is `0` with `Number.isInteger(0) === true` — so a `review_version: null` was read as version 0 and would have been PATCHed as if the backend had sent it. It now accepts only an actual integer (or an integer string).

## Errors

### Field errors (422)

`error.errors` is mapped onto the controls it names, one message per field, and is not reduced to a single toast. A backend error for a field this form doesn't render is listed above the actions instead of being dropped.

A field's backend error clears as soon as the user changes that field.

### A stale version (422, not 409)

A stale `review_version` arrives as a 422 like any other validation failure, so the code alone says nothing. `isCaptureVersionConflict(error)` says yes only when the backend actually points at `review_version` — the `errors.review_version` key, otherwise its own wording. **Every other 422 stays an ordinary field error**, shown inline.

On a real conflict:

- a dedicated message: *"This receipt was updated elsewhere. Reload the latest version before saving."*;
- **no automatic retry**, and the same stale version is never resent — Save is disabled until the draft is reloaded, because resending would only fail again;
- the version is not incremented to "get past" it;
- **the user's unsaved edits are left on screen**, untouched, until they choose otherwise.

### Reload latest

The explicit **Reload latest** action refetches `GET /ai/expense-captures/{id}`. The page rebuilds from the response, so `review_values` and `review_version` become the server's copy and the form is seeded from it again.

**This discards local unsaved changes, and the button says so before it is pressed.** There is no automatic merge algorithm: guessing which side of a conflicting edit was meant is exactly the kind of invention this feature avoids.

### Network and server failures

The edits stay in the form. Nothing resets to the backend state, and the user can press **Retry save**.

For a timeout, a dead connection, a 5xx or an unreadable body the outcome is genuinely unknown, so **nothing claims the draft was saved**. The failure message adds that the request didn't finish and offers **Reload latest** to read what the server actually holds. There is no optimistic success anywhere.

A 401 never surfaces here: `apiClient` ends the session and `AuthProvider` signs the user out.

## Save behaviour

**Save changes** is enabled only when it would do something: a field changed, nothing is in flight, client validation passes, there is a version to save against, and no unresolved stale-version conflict.

- A synchronous ref guard blocks a double click, so **two PATCHes can never run in parallel** over the same `review_version`.
- The controls are disabled while saving, and the values are preserved.
- On success the backend's `review_version` and `review_values` are applied, dirty state clears on its own — the form's values now equal the saved draft — and a small "Changes saved." line appears.
- **The page does not navigate away.**

Dirty state is derived by comparing the form against the saved draft rather than tracked as a flag, so it cannot drift out of step with what was actually saved.

## A partial response

The documented example returns `id`, `status`, `review_version` and a `review_values` object holding only the fields that were sent. PATCH is **not** guaranteed to return everything GET returns, so:

- returned top-level fields replace their counterparts;
- omitted fields are kept — `ai_suggested_values`, `warnings`, `source_type` and every other GET-only field survive a save;
- `review_values` is merged key by key for the same reason: **absence is not deletion**.

`mergeCaptureUpdate(current, updated)` does this, and a response whose capture isn't the one just saved is treated as a malformed answer rather than merged. The Retry response is merged the same way; a full `GET` is not, because it is the whole record — see [retry.md](retry.md).

> The contract says "returned `review_values` replace/update the saved reviewed values" without settling which. Per-key merge is the reading that cannot lose data the response merely omitted — see [Contract ambiguity](#contract-ambiguity).

## Accessibility

Every control has a visible label (a wrapping `<label>`, the project's existing pattern), the right input type, `aria-invalid` when it is in error, and `aria-describedby` pointing at that error's text. Errors are **text**, never colour alone. Buttons are real `<button>` elements — no clickable `div`s — and the save state is announced through a `role="status"` line while errors use `role="alert"`.

## Responsive, RTL and theme

Two columns on desktop, one below 720px, with the description spanning the row. Logical properties throughout (`margin-block-start`, `padding-inline`), so RTL needs no physical flips here. Colours are existing tokens, so dark mode follows automatically. All strings are translated, with EN/AR in exact key parity.

## Contract ambiguity

Three things the contract leaves open, resolved conservatively and flagged for the backend:

1. **Whether `review_values` in a PATCH response replaces or updates the saved object.** Merged per key, so a partial response cannot silently delete fields.
2. **How a field is cleared.** `null`, following the project's existing convention. Nothing in the contract states it.
3. **Whether `tax_amount` / `fee_amount` may be negative or zero.** Not decided here; only the format is checked and the backend rules.

## Not in this task

`DELETE /ai/expense-captures/{id}` arrived in Task 8 — see [discard.md](discard.md). It is the opposite intent to Confirm, so unlike Confirm it **does not save this form first**: discarding a capture means the draft should not become an expense, and PATCHing it on the way out would preserve values the user just abandoned.

`POST /ai/expense-captures/{id}/retry` arrived in Task 6 — see [retry.md](retry.md). It only ever applies to a `failed` capture, so it never meets an editable draft.

`POST /ai/expense-captures/{id}/confirm` arrived in Task 7 — see [confirm.md](confirm.md). It is the action that creates the transaction, and it carries the mandatory idempotency key this PATCH deliberately does not. It also **saves this form first** when the draft is dirty, reusing the save pipeline described above rather than a second update path, and a confirmed capture is read-only from then on.
