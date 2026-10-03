# AI Expense Captures — Review data model

## AI suggestions are not review values

A capture carries two objects:

| Object | What it is | Shape | Editable | Sent back |
| --- | --- | --- | --- | --- |
| `ai_suggested_values` | What the AI read off the receipt. Hints | `{ field: { value, confidence } }` | No | Never |
| `review_values` | The user's draft, and the only thing recorded on confirm | `{ field: value }` | Yes | Yes |

They are kept apart deliberately, and there is **no helper that merges them**. Merging would lose the one distinction the feature is built on: whether a value was guessed by a model or accepted by a person.

> **Corrected after Task 3.** Task 1 assumed the two objects shared field names. The Show contract disproves it: the suggestion for the receipt total is `total_amount`, while the review field is `amount`. The AI names things its own way, and the objects are not even key-compatible — which is one more reason never to spread one over the other.

- The review form seeds from `review_values`, and from nothing else — no suggestion is copied into it at any confidence, and there is no "accept all" action.
- A suggestion is shown *beside* the review section, and an AI field the UI has no label for is humanised rather than dropped.
- `getAiSuggestedValues()` / `getReviewValues()` both return `{}` for a missing or malformed object, so the form never has to null-check.
- `getSuggestedValue(capture, field)` reads a single hint; `undefined` means the AI had nothing to say about that field.
- `getSuggestionEntries(capture)` renders the whole suggestion object defensively — see [details.md](details.md).

## Fields

`CAPTURE_REVIEW_FIELDS` fixes the vocabulary of `review_values`:

```
account_id        category_id       merchant_name
amount            currency_code     transaction_date
transaction_time  reference_number  tax_amount
fee_amount        description
```

The same eleven fields are what `PATCH` accepts, as `CAPTURE_EDITABLE_FIELDS` — the payload allow-list, so nothing outside them can ever be sent. This list drives the display and form order too. A `review_values` key outside the list is still shown, appended after the documented ones, so a field the contract gains isn't silently hidden.

`ai_suggested_values` has **no** such fixed list: its keys are the AI's own and are rendered from whatever arrives.

`account_id` and `category_id` resolve against the existing `accountsApi` / `categoriesApi` lists, exactly as the transaction and import forms already do. Sprint 7 does not fetch its own copies of accounts or categories. Which of them may be chosen is in [editing.md](editing.md).

## review_version

`review_version` is optimistic concurrency for the draft. **It is not a UI counter** — it belongs to the record.

The rule, now enforced by the editable draft form:

1. Every successful update can return a **newer** `review_version`.
2. The next `PATCH` and the final `Confirm` must send the **newest version the frontend has seen**. When Confirm has to save a dirty draft first, that means the version the save just returned — not the one the page loaded with.
3. The version is always re-read from the response. It is never incremented locally.

`getReviewVersion(capture)` returns the integer, or `null` when the backend sent nothing usable — a missing version is not silently treated as `0`, and a capture without one produces no PATCH payload at all.

> **Corrected in Task 5.** The helper read the value with `Number()`, and `Number(null)` is `0` while `Number.isInteger(0)` is `true` — so `review_version: null` was read as version 0 and would have been submitted as if the backend had sent it. It now accepts only an actual integer, or a string of digits.

A stale version is rejected as a **422**, not a 409: the backend treats it as a failed validation of the version that was submitted, so it arrives as `VALIDATION_ERROR` like any other field error.

That makes the code alone useless as a signal. Most 422s here are ordinary field problems — a bad amount, a missing category — which the user fixes in place; a stale version instead means the draft must be reloaded. So `isCaptureVersionConflict(error)` says yes only when the backend actually points at `review_version`: the `errors.review_version` key when it names one, otherwise its own wording. Every other 422 stays a normal validation error.

On a real version conflict the answer is to **reload the capture and show its current state**, never to resend the same update — see [editing.md](editing.md) for the conflict UX and why nothing is retried automatically. Confirm follows the same rule, and additionally never confirms automatically after the reload: see [confirm.md](confirm.md).

## Money

Money stays in the backend's decimal-string form (`"25.0000"`) from the response to the request body. `CAPTURE_MONEY_FIELDS` lists them: `amount`, `tax_amount`, `fee_amount`.

- Never parse a money field into a float for arithmetic or storage. Binary floating point cannot represent these values exactly, and a rounding drift here is a wrong expense.
- Format for display with `formatMoney(value, currency, locale)`.
- Total with `sumMoney` / `subtractMoney` (`utils/formatters.js`), which work in BigInt minor units.
- Send with `toMoneyString` (`api/apiClient.js`), which produces the 4-decimal string.
- Validate a typed amount with `getAmountError` (`FinancialOperations/transactionHelpers.js`).

## Currency

`currency_code` has no closed set of its own. The project already defines the supported currencies once, as `ACCOUNT_CURRENCIES` in `Accounts/accountHelpers.js`; Budgets, Savings goals and Reports all reuse it, and so does Sprint 7. `ILS` and `USD` are examples in the guide, not the list.

Where a currency outside the list can arrive from the backend, follow the existing pattern of merging it into the options rather than dropping it:

```js
[...new Set([...ACCOUNT_CURRENCIES, capture.review_values?.currency_code])]
```

## Idempotency for Confirm

Confirm creates a transaction, so it must carry an `Idempotency-Key`. The project's existing infrastructure covers this and **no second system is introduced**:

- `createIdempotencyKey(prefix)` in `api/apiClient.js` generates a key.
- `createIdempotentAttempt(prefix)` in `FinancialOperations/transactionHelpers.js` keeps **one key per logical operation**: `keyFor(payload)` returns the same key while the payload is unchanged, and `settle(error)` retires it only after success or a definitive rejection (422, 403, 404, 401). After a timeout, network failure, 5xx, 409 or 429 the key is **kept**, so retrying the same confirm replays the original result instead of creating a second transaction.

`CONFIRM_ATTEMPT_PREFIX` is `"ai-capture-confirm"`, following `import-confirm`, `transfer`, `operation` and `correction`. The attempt is held by the details page for the life of one confirmation intent, the way `ImportConfirm.jsx` holds its own — see [confirm.md](confirm.md) for when the key is kept and when it is retired.

Retry moves no money, so its key (`RETRY_ATTEMPT_PREFIX`) is optional; Discard will need none either.

## The source file

`GET /ai/expense-captures/{id}/source` returns the original receipt as a file or stream, not the JSON envelope. Sprint 6 already solved authenticated binary responses and Sprint 7 reuses that rather than adding its own:

| Helper | In | Role |
| --- | --- | --- |
| `apiDownload(endpoint, options)` | `api/apiClient.js` | Same token, `Accept-Language`, timeout and 401 handling as `apiRequest`, but resolves to `{ blob, filename, contentType }` and never parses the body as JSON. A JSON envelope in the response is correctly treated as a refusal |
| `getContentDispositionFilename(header)` | `api/apiClient.js` | Reads the filename, RFC 5987 `filename*` first |
| `saveBlobAsFile(blob, filename)` | `api/apiClient.js` | Hands the blob to the browser and revokes the object URL afterwards |

`reportExportsApi.download` is the working precedent. For displaying the receipt inline rather than downloading it, the blob becomes an object URL — which must be revoked when the component unmounts, or every reopened capture leaks one.

The route also needs a **signed** URL on top of the bearer token, and the contract currently provides no way for the frontend to obtain one. See [source.md](source.md) for what is built, what is blocked, and what the backend needs to add.
