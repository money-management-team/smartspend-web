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

`/dashboard`, `/financial-alerts`, `/accounts`, `/transactions`, `/categories`, `/budgets`, `/savings-goals`, `/savings-goals/{id}/plan`, `/recurring-transactions`, `/debts`, `/debts/{id}/payments`, `/transfers`, `/notifications`, `/calendar`, `/reports/{type}`, `/report-exports`, `/report-exports/{id}/download`, `/imports`, `/imports/{id}`. Each has tests against a fake backend shaped like the docs. None was run against a real server in this sprint.
