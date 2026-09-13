# Accounts — Implementation

## Accounts list (`Accounts.jsx`)

- **Loading:** one fetch effect (`accountsApi.list` with an `AbortController`), re-run by bumping `reloadKey`. It shows `components/Loading`.
- **Empty:**
  - `states.emptyAll` with an "Add account" button when there are no active accounts at all;
  - `states.empty` when only the selected type filter is empty.
- **Error:** the `getApiErrorMessage` text and a "Try again" button that refetches.
- **Filters:** type chips, filtered client-side (`AccountFilters`, unchanged).
- **Cards (`AccountCard`):**
  - the name is a `Link` to `getAccountDetailsPath(id)`, stretched over the whole card, so clicking anywhere on the card opens the details;
  - Edit and Archive sit above that link and stay separately clickable;
  - keyboard focus on the link outlines the card;
  - the card shows `current_balance` exactly as returned, `last_four_digits` when present, and the real `updated_at` (the old static "Updated today" text is gone);
  - `color` (validated hex) tints the icon, and `icon` picks a matching icon, falling back to the type's icon.

**State after each mutation:**

| Action | List update |
| --- | --- |
| Create | The returned account is appended (refetch if the response has no account) |
| Edit | The card is replaced with the returned account (refetch if it has none) |
| Edit / archive 404 | The list is refetched, so a stale card disappears |
| Archive | The card is removed (only active accounts are listed), and a success notice is shown |
| Coming back from the details page | The page mounts again and refetches; an archive done there passes `archivedAccountName` in router state for the notice, which is then cleared from history |

## Account details (`AccountDetails.jsx`)

Route `PATH.USER.ACCOUNT_DETAILS`; it reads `accountId` from `useParams`.

- The result is stored with the request key it belongs to (`accountId:reloadKey`), so there is no synchronous `setState` in the effect. It is "loading" until the matching result arrives.
- **Header:** type icon (tinted by `color`), name, and chips for type, status (active or archived), and "Default account" / "Hidden" when set. Edit and Archive buttons appear for active accounts.
- **Balance card:** current balance (red when negative) and opening balance.
- **Details list:** type, currency, current and opening balance, negative balance allowed or not, low-balance alert, card ending, color, status, created, last updated, archived on. A row is only shown when it has a value.
  - IDs such as `workspace_id`, `created_by` and `sort_order` aren't shown.
- **Archived account:** a note explains that its history is kept, and the actions are hidden.
- **Errors:**
  - 404 → "Account not available", with no retry;
  - 401 → session flow;
  - 429 / network / timeout / server → the message and "Try again".
- **Edit:** the returned account replaces the displayed one. A 404 turns the page into the not-available state.
- **Archive:** on success, navigates to the list with the notice. A 404 shows the not-available state.

## Edit / create form (`AccountForm`)

- One modal for create and edit, pre-filled from the account.
- **Fields:**
  - name, type, currency, opening balance;
  - "Allow a negative balance";
  - under the opening balance in edit mode, a hint that it locks after activity.
- **Payload:**
  - create sends the full payload (unchanged);
  - edit sends only changed fields, and closes without a request when nothing changed;
  - `opening_balance` goes through `toMoneyString` (4-decimal string).
- **Duplicates:** `isSaving` blocks a second submit, the parent keeps a single in-flight save promise, and inputs and buttons are disabled while saving.
- **Errors:**
  - 422 → `errors[field]` under each input, plus the general message;
  - 409 with `opening_balance` in the payload → the "opening balance locked" message under that field and in the alert;
  - 403 / 404 → account messages;
  - 429 / network / server → `getApiErrorMessage`.
- Escape or a click on the backdrop closes the form, except while it is saving.

## Archive dialog (`ArchiveAccountDialog`)

- `role="alertdialog"`; Cancel is focused first.
- **Copy:** "Archiving is not deletion…", then three points:
  - history is kept;
  - no new activity;
  - nothing is permanently deleted.
- **Confirm** calls `POST /accounts/{id}/archive` once: a `pendingRef` guard, "Archiving..." with the buttons disabled, and Escape/backdrop blocked while it runs.
- **Errors stay inside the dialog:**
  - 422 → the backend message (already archived / savings-goal container);
  - 403 → no permission;
  - 404 → not available;
  - 401 → session flow.
- The confirm button uses the primary style, not red, and the card's archive button uses an archive icon in a neutral color. Both were a red trash icon before.
- It replaces the previous `window.confirm`.
- It reuses the modal shell from `AccountForm.css`.

## Money

- Amounts stay the backend's decimal strings in state and requests. They are never parsed into floats for storage or math, and `current_balance` is never recalculated.
- Display uses the shared `formatMoney(value, currency, locale)`, with the locale from the UI language, like the dashboard.
- Negative amounts are detected with a string check (`isNegativeMoney`), not `Number()`.
- Amounts are rendered LTR (`dir="ltr"` / `<bdi dir="ltr">`). The Arabic currency format starts with a right-to-left mark, which would otherwise scramble the amount.

## i18n

`dashboard.accounts.*`, in both locales:

| Key | Content |
| --- | --- |
| `updatedOn` | Card's last-updated line |
| `archiveNamed`, `archiveSuccess` | Archive button label and success notice |
| `archiveDialog.*` | Confirmation copy |
| `status.*` | Active / archived labels |
| `form.openingBalanceHint`, `form.allowNegative` | New form text |
| `details.*` | Details page labels and states |
| `errors.*` | forbidden, notFound, openingBalanceLocked |
| `states.emptyAll` | Empty list |

Removed, because they were unused static data: `items.*`, `updatedToday`, `creditLimit`, `delete`, `confirmArchive`.
