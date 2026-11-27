# Approval: transaction.income            (registry: POST /transactions/income, moves true, key client, dedup key-atomic, tier 4)

**Status: PENDING. Not approved.** Proposed for the first Mobile release.

## Identity
- Backend code the evidence was gathered on: local checkout of `fix/financial-idempotency-p0` @ `fee7272`; `app`, `config`, `routes`, `database` and `bootstrap` are byte-identical to production `a82197f` (`git diff fee7272 a82197f` empty for those paths, checked 2026-11-27).
- Database: MySQL 8.4.13 on `127.0.0.1:3310`, database `smartspend_test_local_api`, own data directory, fictional users only (`@smartspend.test`), mail to the log, no provider keys.
- Backend commit production runs: `a82197f` (reported by the owner, 2026-11-27). Production MySQL version: **unconfirmed** (BE-05).
- Frontend commit tested: `7042c08` (real API and browser runs). The tier 2 wording change `d1943e4` is covered by mocked tests only (`tests/mobileWriteIntegration.test.mjs`).
- Staging: **none**. This evidence stands in for staging only if the owners accept [local-evidence-exception.md](local-evidence-exception.md).

## Evidence: real local API through Mobile's send path (gate, facade, the app's API wrappers; test-only switch, one operation open at a time)
- Identical retry with the same key replayed the first transaction; the bank was credited once (0.0000 -> 500.0000).
- Every account's opening balance plus its ledger entries equals the balance the API showed; no multi-entry transaction is unbalanced; no idempotency key appears twice.

## Evidence: real browser (headless Chrome on the Mobile UI, Vite in mode "test", local fault proxy)
- Server posted, then answered 408: the page said 'not confirmed' and sent nothing again; 1 income in the database.

## Not covered
- Staging (none exists); real iOS Safari / Android Chrome devices and the installed PWA; Chrome's own automatic resend (not reproduced: every POST used a fresh connection).

## Risk statement (plain language)
- Low, as expense. Ownership was not run for income specifically (it was for expense, same controller family).
- How we would stop: rebuild without the operation in `APPROVED` (or with Mobile off) and redeploy through the production workflow.

## HTTP 408
- PENDING owner decision, see [local-evidence-exception.md](local-evidence-exception.md) section 3. The 408 evidence (HTTP-408-EVIDENCE.md) is **not satisfied**: Chrome's own automatic resend was not reproduced.

## Decision
- [ ] Approved   [ ] Approved with conditions (list)   [ ] Rejected   — **PENDING**
- Approver (name, role, date): **PENDING**            Reviewer, not the tester (name, date): **PENDING**
- Tester: Claude Code session for the project owner, 2026-11-27 (local runs described above).
- The exact change that will open it: a separate reviewed commit adding the operation to `APPROVED` in `src/mobile/data/writeGate.js`, updating the register row and the guard tests (register section 5). **Not made.**
- Re-review required when: the production backend commit or MySQL version differs from the one recorded; the write's classification or payload changes; the hosting or browser support changes.
