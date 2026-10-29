# Loading, error and empty states

Dashboard data screens follow one pattern. Use the shared pieces rather than a new variant.

| State | Component | Notes |
| --- | --- | --- |
| First load of a page | `<Loading variant="page" size="large" />` (branded) | Dashboard and detail pages; see [loading](../loading/implementation.md) |
| A list or section loading | `<Loading message={...} />` (ring) | Only that region, never the whole page |
| A form or row | `<Loading size="small" variant="inline" />` or the button's own busy label | |
| Load failed | `<StateMessage tone="error" message={getApiErrorMessage(error, t)} onRetry={reload} />` | Announced as an alert, with a "Try again" button |
| Valid but empty | `<StateMessage message={...} action={{ label, onClick }} />` | Neutral, never styled as an error; offer the next step (add, clear filters) |
| Unexpected crash | [Error boundary](error-boundary.md) | Not for API errors |

Rules:

- Show a translated, user-safe message. `getApiErrorMessage` (and the feature helpers such as `getBudgetErrorMessage`, `getTransactionErrorMessage`) map backend codes to the `api.errors.*` keys; never print `error.message` or a backend payload.
- Offer a retry only for failures of the data load, not for a failed action (a failed save keeps the form open with its own message).
- Keep stale content visible while a refresh runs when the data is still valid.

## What was standardised in this pass

`src/components/StateMessage/` is the shared error and empty block. The main list pages (accounts, budgets, categories, debts, savings goals, recurring, transfers, ledger, reports, notifications, calendar, exports and the detail pages) already had loading, error-with-retry and empty states with page-specific styling; they are unchanged. The gaps were closed:

- **Imports:** plain-text loading became `<Loading>`; a failed load now shows a `StateMessage` with a retry; the empty list uses `StateMessage`.
- **Category history:** a failed load now offers a retry; loading and empty states use the shared components.

Remaining pages keep their existing, equivalent blocks; migrate them to `StateMessage` when they are next changed.
