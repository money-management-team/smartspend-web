# Owner decision draft: local isolated evidence in place of staging

**Status: PENDING. Nothing here is approved, and no write is open (`APPROVED = Object.freeze([])`).** This file is a draft for the owners to accept, change or reject. It does not change any rule in [WRITE-APPROVAL-REGISTER.md](../WRITE-APPROVAL-REGISTER.md); if accepted, the register is amended in the same reviewed commit that records the decision.

## 1. The exception asked for

The register requires per-write **staging** evidence on the backend commit and database engine production runs. No staging exists (decision 2026-11-27: no hosted staging). The owners are asked to accept, for the writes listed in section 4 only, evidence gathered on an **isolated local backend** instead:

- backend code identical to production `a82197f` in `app`, `config`, `routes`, `database`, `bootstrap` (local `fee7272`);
- MySQL 8.4.13 on `127.0.0.1:3310`, its own data directory, fictional users only, mail to the log, no provider keys;
- nothing sent to production; every request was checked to target `127.0.0.1:8010` only.

Conditions proposed: (a) the production MySQL version is confirmed (BE-05) and recorded here; (b) any change to the production backend commit voids the exception for the affected writes; (c) the first release is watched (ledger vs balances) for the first week.

Owner decision: **PENDING** (name, role, date).

## 2. What the evidence covers

| Run | Date | How | Result |
|---|---|---|---|
| Real API | 2026-11-27 | Node under the test runner, Mobile's own send path, test-only switch per operation | 30 / 30 checks |
| Real browser | 2026-11-27 | Headless Chrome on the Mobile UI (sign-in, forms, Send), Vite in mode "test", local fault proxy (lost answer, 408 before / after the server) | every scenario as expected; database: one record per intent |
| Mocked UI | 2026-11-27 | `tests/mobileWriteIntegration.test.mjs` and related suites at `d1943e4` | 29 / 29 and 211 / 211 |

The test-only switch works only when Vite's mode is literally "test" and throws in every real build (`tests/mobileWriteGate.test.mjs` builds `production`, `preview`, `staging`, `development`); the production workflow builds in mode "production".

## 3. HTTP 408 (HTTP-408-EVIDENCE.md): not satisfied

- **Shown:** a 408 or a lost answer reaches the page as "not confirmed"; Mobile never resends by itself; for keyed writes (expense, income, transfer, goal create / contribution / withdrawal) an identical resend carries the same key and the backend replays it: one record.
- **Not shown:** Chrome's own automatic resend of a POST after a 408 or a dropped reused connection. Every test POST used a fresh connection, so Chrome had nothing to retry. The allowed "satisfied" sentence cannot be used.
- **Mitigation:** keyed writes are protected by replay (above). Unkeyed tier 2 creates (account, budget, category) are protected by their unique rule: a resend cannot create a second record, it is refused, and the page now says the record may be the person's own and offers to check the list (`d1943e4`).
- Owner decision needed: **PENDING**: proceed without the 408 evidence for the writes in section 4, for the reason above, or require it first.

## 4. Writes proposed for the first release

| Operation | Tier | Evidence | Proposed |
|---|---|---|---|
| `transaction.expense` | 4 | API + browser | yes |
| `transaction.income` | 4 | API + browser | yes |
| `transfer.create` | 4 | API + browser | yes |
| `goal.create` | 4 | API + browser | yes |
| `account.create` | 2 | API + browser | yes, if the tier 2 decision below is accepted |
| `budget.create` | 2 | API + browser | yes, if the tier 2 decision below is accepted |
| `account.update`, `budget.update` | 1 | API only | only with a browser run, or an explicit owner waiver |
| `goal.contribution`, `goal.withdrawal` | 4 | API only | only with a browser run, or an explicit owner waiver |
| `category.create` | 2 | API only | only with a browser run, or an explicit owner waiver |
| everything else | | not tested | **excluded** |

Tier 1 also asks for a pilot of the NOTIFICATION-PILOT.md shape; none was run. Owner decision: **PENDING** (run it or waive it).

## 5. Tier 2 lost answers: the cost to accept

- **What can happen:** the first request created the account or budget, its answer was lost; a retry (by the person, or silently by the browser) is refused as "already exists".
- **What cannot happen:** a second account or budget with the same unique key.
- **What the person sees (since `d1943e4`):** "may be the account/budget you added … Nothing new was recorded by this request", a "Check your accounts / budgets" link, and the list read again from the server.
- Owner decision needed: **PENDING**: accept this cost for `account.create` and `budget.create` (and `category.create` if it is added).

## 6. Still required before release, whatever is decided here

Real iOS Safari and Android Chrome checks with the installed PWA (or an owner decision to do them right after release); `development` as the default branch (or the workflows on `main`); `Cache-Control: no-cache` for `index.html` on Hostinger; the release approval variables at release time.
