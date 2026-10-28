# Mobile — full implementation sprint: report

**Verdict: IMPLEMENTATION PARTIAL — BLOCKED BY EXTERNAL DEPENDENCIES.** No backend repository was available, and no physical devices.

- **Branch:** local `integration/mobile`, started at `eff8fff`.
- **Commits in this sprint:** `b21b760`, `9fe88c7`, `abe0ed9`, and the commit that adds this file.
- **Not done:** no push, no merge, no deployment. The production Mobile flag is unchanged (off).

## Levels of completion, kept apart

| Level | State |
|---|---|
| Code implemented | The screens listed below, the write gate, the cross-tab auth fix |
| Verified with mocks | Yes: 1,493 / 1,493 tests, including fake-backend screen tests for every new screen |
| Backend integration verified | **No.** No backend was available |
| Financially safe to enable writes | **No.** Every write is closed (SECURITY-AND-FINANCIAL-GATES.md) |
| Ready for controlled release | **No.** See RELEASE-AND-ROLLBACK.md |
| Deployed | **No** |

## Done in this sprint

1. **The 408 investigation.** Reproduced 3 out of 3 times on Chrome 156:
   - On HTTP/1.1, Chrome resends a POST or PATCH by itself after a 408, or after a dropped reused connection. The server can process the write twice while the page sees one success.
   - On HTTP/2, nothing was resent.
   - Details in SECURITY-AND-FINANCIAL-GATES.md §2.
2. **The write gate.** Every Mobile write is closed in source, including the S04B4 category create and rename. Screens explain why and link to the full version. The facade refuses before any request is made.
3. **A shared AuthProvider cross-tab fix.** Another tab's sign-out, sign-in as someone else, or workspace switch is now followed, and the app tree is remounted. Tested against the real provider, and the full Desktop suite passes.
4. **New read-only screens:**
   - Debts (list and detail, with the latest payments);
   - Transfers (list and detail, with ledger entries);
   - Notifications (the inbox, without marking anything read);
   - Calendar (a monthly agenda);
   - Reports (all ten types: per-currency summaries, documented items with pagination, bars drawn with BigInt and a text alternative);
   - Export history (download only when `download_available` is true);
   - Imports (history and status; processing is never shown as finished).
5. **New ways in** from Planning and More. Titles, English and Arabic strings, and tests for all of them.

## Not done (open)

- **Writes:** transactions, transfers, reversals, debt payments, savings, recurring actions, account, budget, goal and debt create and edit, category writes, imports, exports, AI, WhatsApp. All are blocked by unverified backend deduplication (BACKEND-CONTRACT-GAPS.md).
- **PWA:** none built (PWA-AND-DEVICE-QA.md has the design constraints).
- **Not on Mobile yet:** AI assistant reads, WhatsApp, profile and password, the Home period picker, search, monthly review, templates, saved report filters, dashboard blocks, statement PDF.
- **Browser and device evidence:** the new screens have had no real-browser screenshot pass. There has been no device, VoiceOver or TalkBack testing, and no cross-tab test of the auth change in a real browser.

## Evidence

- **Tests:** `npm test` passes 1,493 of 1,493 (1,449 at the start). The new files are:
  - `mobileWriteGate` (9 tests);
  - `authCrossTab` (7);
  - `mobileMoreScreens` (18);
  - `mobileReports` (10).
- **Lint:** clean.
- **Flag-off build:** the stylesheet is byte-identical to the original baseline (sha-256 `141bb8a9…`, `style-CdLHj2cm.css`), and the output has no Mobile marker or `sm-root`. The entry chunk differs from the baseline because of the shared AuthProvider change. That difference is expected and was not pixel-compared in this sprint.
- **Flag-on build:** builds successfully.
- **Not re-run in this sprint:** the 54-job Desktop visual parity and the Mobile browser matrix. They must be re-run before review.

## Resume checkpoint

To continue:
1. Run the browser screenshot and parity pass with the scratchpad harness (`shoot7.mjs`) on the new routes.
2. Build the PWA slice to the constraints in PWA-AND-DEVICE-QA.md.
3. Add AI insights, WhatsApp status and profile as read-only screens.
4. Open no write until the backend questions are answered.
