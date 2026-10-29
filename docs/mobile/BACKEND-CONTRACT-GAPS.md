# Mobile — backend contract gaps

No backend repository was available on this machine (`F:\Projects` holds only `smartspend-web` and `smartspend-design-preview`), and none was found in the usual local paths. **No server-side guarantee below has been verified.** Everything Mobile relies on comes from the frontend docs under `docs/` and the Desktop wrappers.

## Writes: evidence matrix

| Operation | Endpoint | Key sent by Desktop | Server dedup | Concurrency / atomicity | One-time reversal | Read-only reconciliation | Mobile |
|---|---|---|---|---|---|---|---|
| Category create | `POST /categories` | none | UNVERIFIED (name uniqueness?) | UNVERIFIED | n/a | `GET /categories` (a similar name is not proof) | closed |
| Category rename | `PATCH /categories/{id}` | none | idempotent by nature? UNVERIFIED | UNVERIFIED | n/a | `GET /categories/{id}` | closed |
| Income / expense | `POST /transactions/income\|expense` | `Idempotency-Key` | UNVERIFIED (scope, retention, replay) | UNVERIFIED | n/a | `GET /transactions` | no code |
| Correction | `PATCH /transactions/{id}` | key | UNVERIFIED | UNVERIFIED | n/a | `GET /transactions/{id}` | no code |
| Transaction reversal | `POST /transactions/{id}/reverse` | per docs | UNVERIFIED | UNVERIFIED | UNVERIFIED | `GET /transactions/{id}` | no code |
| Transfer | `POST /transfers` | key | UNVERIFIED | UNVERIFIED | n/a | `GET /transfers` | no code |
| Transfer reversal | `POST /transfers/{id}/reverse` | **none** | UNVERIFIED (docs say 409 on a repeat) | UNVERIFIED | UNVERIFIED | `GET /transfers/{id}` | no code |
| Debt payment | `POST /debts/{id}/payments` | key | UNVERIFIED | UNVERIFIED | n/a | `GET /debts/{id}/payments` | no code |
| Debt payment reversal | `POST /debt-payments/{id}/reverse` | **none** | UNVERIFIED (docs say 409) | UNVERIFIED | UNVERIFIED | payments list | no code |
| Debt / goal / budget / rule create, edit, archive | various | none | UNVERIFIED | UNVERIFIED | n/a | lists | no code |
| Recurring confirm-next | `POST /recurring-transactions/{id}/confirm-next` | derived by server (docs) | UNVERIFIED | UNVERIFIED | n/a | rule detail | no code |
| Savings contribution / withdrawal, installment, funding-leg reversal | savings endpoints | per docs | UNVERIFIED | UNVERIFIED | UNVERIFIED | goal / plan reads | no code |
| Import confirm / reverse | `POST /imports/{id}/confirm\|reverse` | key | UNVERIFIED | queue worker required | UNVERIFIED | `GET /imports/{id}` | no code |
| Export create / cancel | `POST`, `DELETE /report-exports` | none | UNVERIFIED | async | n/a | export list | no code |
| Mark notification read | `PATCH /notifications/{id}/read` | none | idempotent per docs | n/a | n/a | inbox | no code |
| AI message, feedback, settings; voice and receipt capture | AI endpoints | varies | UNVERIFIED | UNVERIFIED | n/a | conversation reads | no code |
| WhatsApp draft confirm / discard, link, unlink | WhatsApp endpoints | review version | UNVERIFIED; consent and legal pending | UNVERIFIED | n/a | draft reads | no code |
| Profile update, password change | `PUT /profile`, `PATCH /profile/password` | none | UNVERIFIED | UNVERIFIED | n/a | `GET /user` | form only, no send code |
| Notification preference | `PATCH /notifications/preferences` | none | idempotent by nature? UNVERIFIED | n/a | n/a | preferences read | toggle only, Save disabled |

Since the unblocked-feature pass, every row marked "no code" has a Mobile form and review that ends at a disabled send: there is still no code that sends it (SECURITY-AND-FINANCIAL-GATES.md §1).

## Questions that must be answered from the backend source and staging

1. For each key-carrying route: where is the key stored? What is its scope (user, route, body hash)? How long is it kept? What does a repeat with the same key return: the original status and body? And with a different body?
2. Which routes have no key and rely on a uniqueness rule, and which rule is it (database constraint or application check)?
3. **Can any route answer 408?** Check the app server, the reverse proxy, the Hostinger front end and Laravel Cloud. Is the API served over HTTP/1.1 anywhere on the path? (See SECURITY-AND-FINANCIAL-GATES.md §2.)
4. Are the transfer and debt-payment reversals protected by a database-level guard (a unique reversal row, or a status check under a lock), not just a read-then-write?
5. Are ledger postings wrapped in one database transaction with the balance update?
6. Can a write complete after the client gave up (20 s client timeout)?
7. What does `GET /reports/*` do with `page` (it is not in the documented examples)?
8. What is the exact shape of `data.import` (the `counts`, `account`, `completed_at` fields Mobile reads)?
9. Is `GET /report-exports/{id}/download` safe to call more than once, and what does it return after expiry?
10. Do `notifications` paginators include `from` and `to`? Mobile accepts their absence only for this endpoint.

## Read contracts Mobile relies on (from the frontend docs, not verified on a server)

`/dashboard` (now with every documented `period`, and `date_from`/`date_to` for `custom`), `/financial-alerts`, `/accounts`, `/transactions`, `/categories`, `/budgets`, `/savings-goals`, `/savings-goals/{id}/plan`, `/recurring-transactions`, `/debts`, `/debts/{id}/payments`, `/transfers`, `/notifications`, `/calendar`, `/reports/{type}`, `/report-exports`, `/report-exports/{id}/download`, `/imports`, `/imports/{id}`.

Added in the unblocked-feature pass, through `data/readAssistApi.js` (GET only; the guard test lists the methods): `/ai/settings`, `/ai/conversations`, `/ai/conversations/{id}`, `/ai/insights`, `/ai/forecast`, `/ai/input-quotas`, `/ai/expense-captures`, `/ai/expense-captures/{id}`, `/ai/voice-expense-captures`, `/ai/voice-expense-captures/{id}`, `/integrations/whatsapp`, `/integrations/whatsapp/expense-drafts`, `/integrations/whatsapp/expense-drafts/{id}`, `/notifications/preferences`. Insights, the forecast and conversations are read only when `/ai/settings` reports consent.

Each has tests against a fake backend shaped like the docs and the full version's parsers. None was run against a real server.

Added in the closure pass: `/savings-goals/{id}/plan-options` (with `frequency`, `interval`), `/savings-goals/{id}/planned-contributions/{iid}/confirmation-preview`, `/notifications/unread-count`, and `group_by` on `/reports/{type}`.

Open questions added by these reads:
11. The exact shapes of `data.forecast.currencies[]`, `data.insights` items and message `sources` (Mobile reads the fields the full version's panels read, and shows nothing it cannot validate).
12. Whether a receipt capture's detail ever carries a signed source URL (none is documented; Mobile shows no original photo).
13. The voice capture's `transcript` field name on the detail read (Mobile shows it only when present).
14. The shape of `trend_by_currency` points (not fixed by the contract; Mobile reads the shapes the full version reads and shows a gap where a figure is missing).
15. Whether `savings_plan.installments` is always part of `GET …/plan` (Mobile falls back to `next_installment` alone).

## External evidence checklist (each item needs backend source plus a staging run with fictional data)

Each item is unanswered today, because no backend was available.

| # | Item | Evidence that settles it |
|---|---|---|
| 1 | Idempotency-key storage | The table or cache that holds keys, and the middleware that reads it |
| 2 | Key scope | Whether a key is per user, per route, per body hash or global |
| 3 | Key expiry | Retention period; what a reuse after expiry does |
| 4 | Same key, same body | Returns the stored status and body, with no second effect (shown by a staging test) |
| 5 | Same key, changed body | Rejected (409 or 422), never applied |
| 6 | Same key while the first request is still running | Waits or 409; never two effects (staging test with a slowed handler) |
| 7 | Atomic money writes | Ledger rows and balance update in one database transaction; a failure leaves neither |
| 8 | One-time reversals (transaction, transfer, debt payment, funding leg, import) | Database-level guard (unique reversal row, or a status check under a row lock); a parallel double request gives exactly one reversal |
| 9 | Import confirm and cancel | Confirm is idempotent under its key; what cancel does after confirm; queue-worker failure behaviour |
| 10 | Recurring confirm-next | Server-derived key: two parallel confirms give one transaction |
| 11 | Category create and rename | Name uniqueness rule (database or application); what a duplicate create returns; side effects of a rename on existing transactions |
| 12 | HTTP 408 | Which layer can answer 408 (app server, proxy, Hostinger, Laravel Cloud), and whether it can do so after reading the body |
| 13 | Protocol on the path | HTTP/1.1 or HTTP/2 from browser to origin. Chrome resends after a 408 or a reset reused socket only on HTTP/1.1 (local evidence, SECURITY-AND-FINANCIAL-GATES.md §2) |
| 14 | Read-only reconciliation | For each write, the GET that shows whether it happened (by id or by key), not "a similar row exists" |
| 15 | Token and workspace authorization | Each read and write checks the record's workspace against the token's user; a foreign id gives 403 or 404, never data |

## Ready-to-run read check

`scripts/mobileReadContract.mjs` sends GET requests only. It validates every Mobile read with the same models the screens use: debts, transfers, notifications, calendar, exports, imports and the ten reports.

- **Safeguards:** it refuses to run unless the operator sets `SMARTSPEND_CONTRACT_OK=isolated-fictional-data`, and it accepts only an HTTPS or local target.
- **Dry run:** 16 of 16 passed against a local fictional server.
- **Not run against a real backend**, because none was available.

There is no write-contract script. Writing one is pointless until items 1–8 above are answered, and running it would need an approved isolated backend.
