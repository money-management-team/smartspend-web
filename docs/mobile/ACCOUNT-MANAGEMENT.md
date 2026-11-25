# Mobile — account management (Phase 2D)

**Accounts → Add an account / an account's page → Edit or Archive → review → confirm → the server's result.** The operations `account.create`, `account.update` and `account.archive` are **closed**: `APPROVED` in `src/mobile/data/writeGate.js` is empty. Opening them is a separate, approved commit. Same shape as [TRANSFER-CREATE.md](TRANSFER-CREATE.md).

## What the backend supports (read from the source, never from production)

Refs: `develop` @ `fd87531` and `fix/financial-idempotency-p0` @ `6b696d72` (read with `git show`). `AccountController`, the two requests and the update and archive actions are **identical** on both; only `CreateAccountAction` differs (see create). Routes (`routes/api.php`): `POST /accounts`, `PUT|PATCH /accounts/{id}`, `POST /accounts/{id}/archive` and `DELETE /accounts/{id}` (an alias of archive: nothing is ever deleted).

**Not supported, so not implemented:** restoring an archived account (no endpoint, no action; `GET /accounts?status=archived` only lists them) and changing the default account (`is_default` is read-only; the archive action only clears it). Mobile has no such operation and says so on the account's page and in the archive review. Color and icon exist on the backend but no Mobile or full-version screen offers them.

### Create: `POST /accounts`
- **Body** (`StoreAccountRequest`): `workspace_id` (exists), `name` (required, trimmed, **max 150**, unique per workspace), `type` (`cash`, `bank`, `wallet`, `savings`, `custom` = "Other"), `currency_code` (3 letters, upper-cased), `opening_balance` (required, non-negative, up to 4 decimals), `allow_negative_balance` (boolean), optional `color` (`#RRGGBB`) and `icon`.
- **Authorization:** the user must be able to manage the workspace (`manageableWorkspaceIds`), else 403.
- **Answer:** 201 `{ data: { account } }` with `current_balance` (the opening balance).
- **No replay.** Unique `(workspace_id, name)` is the only protection: a copy is refused with a **422 on `name`**, never answered with the first account. On develop a copy that races the first can reach the database index and answer 500; on 6b696d72 the index violation is translated to the same 422. So after a lost answer the refusal can come for an account that exists. The classification stays **`unique-index`**.

### Update: `PATCH /accounts/{id}`
- Partial; sets the sent values, so a copy leaves the same state (**`same-result`**).
- **Refused (422):** an archived account; for a savings goal's account any change of `type`, `currency_code`, `opening_balance` or `allow_negative_balance`; **once the account has ledger entries**, its `opening_balance` (any value) and its `currency_code` (a different one); a name that is taken. 403 for another workspace, 404 if it isn't visible.
- Turning off `allow_negative_balance` on an account that is already negative is **not** checked by the backend.
- **Answer:** 200 `{ data: { account } }`.

### Archive: `POST /accounts/{id}/archive`
- Under a row lock; changes only `status`, `archived_at` and `is_default`. The ledger and history are untouched; a balance does not block it.
- **Refused:** already archived (422), a savings goal's account (422, "archive it through its savings goal"), an account an **active savings plan is funded from** (**409** with `code: "account_funds_active_savings_plan"`, certain: nothing was changed).
- **Answer:** 200 with `status: archived`, `archived_at` and `current_balance` (the closing balance). A copy after success is a 422 "already archived" (**`once-only`**).

## What Mobile does

Already in place (verified): the three forms (`workflows.js` `account`, `account-edit`, `account-archive`), routes `/m/add/account`, `/m/accounts/{id}/edit|archive`, payload builders (an edit sends only what changed), senders, the send hook and the account page's Edit/Archive links (not for a goal's or an archived account).

Added or changed in this phase:
- **Name limit 150**, the backend's (the full version's 255 would be refused with a 422).
- **Add an account** on the Accounts screen (and its empty state); the screen's text no longer says everything stays in the full version.
- **Edit review** shows what each changed detail was ("Was: …"); the currency stays locked.
- **Archive review** shows the account and its closing balance and says what archiving means, including that it can't be restored and that an account funding an active savings plan can't be archived.
- **Server-confirmed results** (`models/accountResult.js`, `forms/AccountResult.jsx`): shown only when the answer is provably what was asked for (a created account's name, type, currency, opening balance and negative setting; an edit's changed fields on this account; an archive's `archived` status on this account). It shows the server's figures, including the server's balance, and links to the account. Anything else falls back to "Recorded" with no figures. The write's cached reads are dropped, so the lists and balances read again. Hide-amounts masks the figures.
- **Refusals that say more** (`useWorkflowSubmit.js`, `WriteOutcome.jsx`): the 409 `account_funds_active_savings_plan` is a **certain** refusal ("an active savings plan is funded from this account; nothing was changed"); any other 409 stays unknown. A create refused for its **name** says the first copy may be the account that is there, and the lists are read again.
- Strings `forms.accountResult.*`, `forms.outcome.account*`, `accounts.add`, in English and Arabic.

## Unknown outcomes

- **Create:** nothing is resent by itself. After a lost answer this form sends nothing more. If the person retypes the account after a reload, the server refuses the copy (422 on `name`) and Mobile tells them the first copy may be the one that exists. It never pretends to replay.
- **Update:** safe to repeat (same result); still no automatic resend.
- **Archive:** a copy is refused ("already archived"); after a reload the account page is read as archived, so the form isn't offered again.

## Tests

`tests/mobileAccountManagement.test.mjs`, against a fake backend that follows the rules above. It covers the registration (no restore or default operation exists), the closed gate (zero requests), the types offered, the currency beside the opening balance, payloads, the 150-character name, invalid inputs, a taken name, double tap, a lost answer then a retype (one account), timeouts, 403/404, ownership, the update and archive refusals (goal, archived, ledger-locked opening balance, the plan conflict), same-result replays, unverifiable 2xx, the account page's links, hide-amounts and Arabic.

The two persistence tests (`tests/mobilePendingWritePersistence.test.mjs`, `tests/pendingWritePersistence.test.mjs`) no longer match `42`/`999` as substrings (which also matched the stored `createdAt` clock): they parse the stored JSON and assert each field. They pass under a clock pinned to values full of `42` and `999`.

## Before opening

1. **Create:** has no replay on any ref, so it can only be opened as an accepted risk: a lost answer is recoverable by reading the list, but the app can't prove the outcome. Decide that explicitly, or wait for a keyed create on the backend.
2. **Update and archive** are safe by construction; they need only a staging run (one of each; a taken name; an opening balance after activity; a goal's account; an account that funds a plan: 409).
3. The 408 evidence, a recorded per-write approval, then a separate commit adding the operations to `APPROVED`.

## Differences from the full version worth knowing

The full version's account form allows 255 characters for the name (the backend refuses more than 150), and `accountsApi.js` says a changed opening balance is "rejected with 409" (it is a 422 validation error). Neither was changed here.
