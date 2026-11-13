# Phase 6UI.5C7 — WhatsApp (Mobile)

Read-only. `APPROVED = Object.freeze([])` is unchanged: nothing on these pages sends a message, links or unlinks WhatsApp, changes a setting, or edits, confirms or discards a draft.
Backend reference: `fix/financial-idempotency-p0 @ 6b696d72`, read with `git show` only (`WhatsAppIntegrationResource`, `WhatsAppExpenseDraftResource`, the two controllers, the enums, `WhatsAppExpenseDraftReadiness`, `WhatsAppExpenseDraftPolicy`, the list request, and the route table).

## What the backend offers as GET

| Route | Gives |
|---|---|
| `GET /integrations/whatsapp` | `enabled`, `state` (`disabled` / `not_linked` / `linked`), `capabilities`, `public_number` (SmartSpend's number, digits), and `integration`: link `status` (`pending` / `active` / `revoked`), `phone_last_digits`, `language`, default account, `linked_at`, `revoked_at` |
| `GET /integrations/whatsapp/expense-drafts/summary` | `pending_review_count` |
| `GET /integrations/whatsapp/expense-drafts?status=&page=&per_page=` | a page of the person's own drafts. **Without `status` it lists `ready_for_review` only; there is no "all".** |
| `GET /integrations/whatsapp/expense-drafts/{id}` | one draft: `status`, `review_version`, `review_values`, `confirmation.{ready, issues[{field, code, message}]}`, `timestamps`, `account` (with `current_balance`), `category`, `confirmed_transaction_id`, `can_edit` / `can_confirm` / `can_discard` |
| `GET /integrations/whatsapp/link-challenges/{token}` | a linking challenge by its secret token (Mobile never asks for or shows a token) |

There is **no route that lists WhatsApp messages and none that reports usage limits**. Webhooks are POSTs from WhatsApp, not an app API.

## Audit: Desktop vs Mobile

| Desktop feature | Backend GET | Mobile before | Mobile now |
|---|---|---|---|
| Connection state, linked date, last digits | `GET /integrations/whatsapp` | present | unchanged |
| Link's own status | `integration.status` | **missing** | shown (active, started-not-finished, disconnected; a status the contract does not list is shown as sent). A disconnected earlier link is said as such and its number is not shown as current |
| Replies language, default account | `integration.language`, `default_account` | **missing** | shown; the account is a link to its Mobile page |
| SmartSpend's number and chat link | `public_number` | **missing** | the number is shown; "Open SmartSpend's chat in WhatsApp" is a plain external link (`https://wa.me/<digits>`), only when linked, and says nothing is sent from here |
| Pending-review count | `GET .../summary` | **missing** | "Waiting for review: N", the backend's own figure, with a link to the drafts; its failure shows its own note and leaves the page standing |
| Draft inbox with statuses | `GET .../expense-drafts?status=` | status tabs plus an "All" tab | five status tabs, no "All" (see defects); each tab names its status in the request; total from the paginator; a sentence per status; per-status empty text |
| Draft rows | list | description, amount, date from fields the backend does not send | description, amount and currency, account, transaction date, status, "Details complete" or "Needs attention: n" while waiting, and "Review by" |
| Draft details | `GET .../{id}` | an invented message quote, no timeline, issue labels for codes the backend never sends | what SmartSpend read (amount, account and its balance, category, date, time, time zone, description), readiness with the issues in words, a timeline of every moment sent, reference and source, a link to the expense a recorded draft became |
| Edit, confirm, discard a draft | PATCH / POST / DELETE | review form that sends nothing | unchanged — still gated |
| Link, unlink, preferences, link challenge | POST / DELETE / PATCH | explained, disabled | unchanged — still gated |
| Message history | none | none | **no GET contract**: the screen says so and points to the drafts |
| Usage limits | none | none | **no GET contract**: same card says so |

## Defects found in the existing Mobile reads and fixed

1. **The drafts "All" tab was not "all".** It sent no `status`, and the backend answers that with `ready_for_review` only, so "All" showed the waiting drafts under the wrong name. The list now always names a status and has five tabs; "waiting for review" opens by default and is left out of the address.
2. **Draft moments were read from fields that do not exist** (`created_at`, `expires_at` at the top level), so every draft's date and expiry read as missing against a real backend. They now come from `timestamps`.
3. **An invented message text** (`source_text` / `message_text`) was read and quoted. The contract has no such field; it is gone, and the page says the original message is not available to Mobile.
4. **Issue labels used codes the backend never sends** (`missing_account`, …). They are replaced by the real ones (`account_required`, `category_required`, `amount_required`, `amount_invalid`, `account_unavailable`, `account_not_usable`, `category_unavailable`, `category_not_usable`, `currency_mismatch`, `date_required`, `time_unresolvable`). A code SmartSpend adds later shows the backend's own message.

## What was added

- `models/assist.js`: `buildWhatsApp` (link status, revoked time, default account, language, public number), `buildDraftSummary`, and `normalizeDraft` (timestamps, issues with message, category, balance, time zone, confirmed transaction, `can_*` flags). Strict: a connection answer without a valid `state` or `capabilities`, a count that is not a non-negative integer, or a draft with an unlisted status is refused.
- `readWhatsAppDraftSummary` (`whatsappApi.getDraftSummary`), named in the read-only allow-list; `PagedRead` gained an optional `header`.
- Strings: `i18n/sections/whatsappView.js` (EN and AR, parity-checked). Dead strings for the removed behaviour were deleted from `i18n/sections/assist.js`.

## What stays gated

Linking (a one-time challenge is a POST), disconnecting, saving preferences, and editing, confirming or discarding a draft. The existing review form is untouched. Opening WhatsApp through the chat link is the person's own navigation to another app; Mobile sends nothing.

## Limits (deliberate)

- No message history and no usage meter: the backend offers neither, so neither is invented. The drafts are the closest thing to "what my messages became".
- No date or account filter on the draft list (the backend supports both; the audit did not need them).
- A draft's balance is the account's own figure, in the account's currency, shown beside the draft and never added to it.
- Draft times are shown in the draft's own `workspace_timezone` when it is valid.

## Safeguards kept

- Only GET requests; the tests fail on any other method. No linking token is requested, shown or stored.
- Raw backend text is shown only for a validation issue whose code Mobile has no words for.
- A failed secondary read (the count) shows its own note and leaves the page.
- Flag-off builds still contain no Mobile code (`mobileBundle`).
- RTL: numbers, dates, the account and phone digits are `bdi`; no media queries.

## Tests

`tests/mobileWhatsApp.test.mjs` (model strictness, the connection in every state, the count, the limits card, the drafts, one draft in detail, Arabic, read-only) with `tests/helpers/whatsappFixture.mjs`, whose fake list follows the real default. The old WhatsApp tests in `mobileAssist` were moved onto the real contract; `mobileReadOnly` names the one new read.

## Visual QA

Local GET-only fixtures (fictional data; no production or staging API), 320 px and 390 px, EN and AR (RTL), light and dark, for the linked connection, the drafts, a recorded tab, a ready draft, a draft with issues, a recorded draft and an expired one, plus the not-linked (earlier link ended), disabled, empty and error states. Captures live outside the repository in `SmartSpend-Mobile-QA/phase-6ui-5c7/`.
