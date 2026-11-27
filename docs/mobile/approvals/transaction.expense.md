# Approval: transaction.expense            (registry: POST /transactions/expense, moves true, key client, dedup key-atomic, tier 4)

**Status: PENDING. Not approved.** Proposed for the first Mobile release.

## Identity
- Backend code the evidence was gathered on: local checkout of `fix/financial-idempotency-p0` @ `fee7272`; `app`, `config`, `routes`, `database` and `bootstrap` are byte-identical to production `a82197f` (`git diff fee7272 a82197f` empty for those paths, checked 2026-11-27).
- Database: MySQL 8.4.13 on `127.0.0.1:3310`, database `smartspend_test_local_api`, own data directory, fictional users only (`@smartspend.test`), mail to the log, no provider keys.
- Backend commit production runs: `a82197f` (reported by the owner, 2026-11-27). Production MySQL version: **unconfirmed** (BE-05).
- Frontend commit tested: `7042c08` (real API and browser runs). The tier 2 wording change `d1943e4` is covered by mocked tests only (`tests/mobileWriteIntegration.test.mjs`).
- Staging: **none**. This evidence stands in for staging only if the owners accept [local-evidence-exception.md](local-evidence-exception.md).

## Evidence: real local API through Mobile's send path (gate, facade, the app's API wrappers; test-only switch, one operation open at a time)
- One key per intent; an identical retry with the same key returned the same transaction (id 5 / 5); the wallet was debited once (1000.0000 -> 900.0000).
- Same key + a different amount: 409, no money moved.
- Insufficient balance: 422, wallet unchanged.
- Another fictional user posting to this user's account: 403, balance unchanged.
- Every account's opening balance plus its ledger entries equals the balance the API showed; no multi-entry transaction is unbalanced; no idempotency key appears twice.

## Evidence: real browser (headless Chrome on the Mobile UI, Vite in mode "test", local fault proxy)
- Double tap on Send: exactly 1 POST reached the server.
- Answer lost after the server posted: the page said 'not confirmed', nothing was resent; the identical expense resent after a reload carried the same key and was replayed: 1 transaction in the database.

## Not covered
- Staging (none exists); real iOS Safari / Android Chrome devices and the installed PWA; Chrome's own automatic resend (not reproduced: every POST used a fresh connection).

## Risk statement (plain language)
- Low. A browser-level resend carries the same key and is replayed by the backend (shown). Production MySQL version unconfirmed.
- How we would stop: rebuild without the operation in `APPROVED` (or with Mobile off) and redeploy through the production workflow.

## HTTP 408
- The 408 evidence (HTTP-408-EVIDENCE.md) is **not satisfied** (Chrome's own automatic resend was not reproduced). The owner decided on 2026-11-27 to proceed without it, conditionally, for this release: [local-evidence-exception.md](local-evidence-exception.md) section 3 and [WRITE-APPROVAL-REGISTER.md](../WRITE-APPROVAL-REGISTER.md) section 6. This write's own decision below is still PENDING.

## Decision
- [ ] Approved   [ ] Approved with conditions (list)   [ ] Rejected   — **PENDING**
- Approver (name, role, date): **PENDING**            Reviewer, not the tester (name, date): **PENDING**
- Tester: Claude Code session for the project owner, 2026-11-27 (local runs described above).
- The exact change that will open it: a separate reviewed commit adding the operation to `APPROVED` in `src/mobile/data/writeGate.js`, updating the register row and the guard tests (register section 5). **Not made.**
- Re-review required when: the production backend commit or MySQL version differs from the one recorded; the write's classification or payload changes; the hosting or browser support changes.
