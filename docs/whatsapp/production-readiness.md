# WhatsApp: production prerequisites and TASK 09 checklist

Nothing below was verified against the live backend, Hostinger, Meta, or production data. This is what must be checked before relying on the feature.

## 1. Backend must be deployed first

The frontend needs `feature/whatsapp-availability-contract` (Draft PR #3) on the production backend: `GET /integrations/whatsapp` with `enabled`/`state`/`capabilities`, the `whatsapp_disabled` 409, `confirmation.ready`/`issues`, and the draft routes. Against an older backend the Integrations tab says "not available on this server yet" (it does not guess).

Production variables the backend needs for links (`config/whatsapp.php`): `WHATSAPP_FRONTEND_URL` (must be `https://smartspend.anasalharazeen.com`, https in production, otherwise the backend produces no link) and optionally `WHATSAPP_REVIEW_PATH` (default `/whatsapp/drafts/{draft}`; the frontend handles exactly the default). WhatsApp stays disabled in production until deliberately enabled.

## 2. Duplicate confirmation: evidence and conclusion

Verified in the backend source (`WhatsAppExpenseDraftConfirmationService::confirm`, `IdempotencyService`):

- Confirmation runs inside one `DB::transaction`. It first takes `lockForUpdate()` on the draft row; the idempotency reservation, the posting (`PostExpenseAction`), and the draft's change to `confirmed` with `confirmed_transaction_id` all commit together. If anything fails, everything rolls back, including the idempotency row, so no key stays stuck "processing".
- A second request for the same draft waits on the row lock. After the first commits it sees `confirmed`: with the **same** key it gets the original transaction (replay, 201); with a **different** key `replayConfirmed` throws `DuplicateOperationException` (409). If the first rolled back, the second proceeds normally.
- A key already used for another operation or another draft is refused (409) by `assertKeyIsCompatibleWithDraft`.
- The backend ships a real MySQL concurrency test for exactly this: `WhatsAppExpenseDraftMySqlConcurrencyTest::test_two_concurrent_confirmations_create_one_transaction` runs two workers with **different** keys (`wa-concurrent-first`, `wa-concurrent-second`) on one draft and expects one success, one refusal, one `Transaction` and one `LedgerEntry`. (Read, not executed here.)

Scenario audit, with the frontend behavior:

1. The first request reaches the server and the connection drops: the screen keeps the attempt (same key), reads the draft, and offers Check status / Try again (same key). Same-key retry is a replay; it cannot post twice.
2. The page reloads: the in-memory key is lost. The first request may still be running, so an initial GET showing `ready_for_review` proves nothing about it.
3. The user confirms again (explicit, via the dialog) with a new key. The server serializes it behind the first request's lock. After the first commits the second is refused (409, different key). The screen reads the draft, sees `confirmed`, and shows the one recorded expense with its transaction; it does not show an error or a second success. If the first rolled back, the second legitimately records it once.
4. If the second request takes longer than the client timeout it is reported as unknown, the draft is read, and the same reconciliation applies.

Tested in `finalIntegration.test.mjs` ("reload while a confirmation may still be running"): two requests with different keys, one transaction, a recorded-expense screen, no misleading error. The fake server models the backend rules above; it is not the backend.

Conclusion: the in-memory key is safe under these guarantees, so no persistence of idempotency keys was added. No backend change is required for correctness. One acknowledged cost: after a reload the user cannot replay the lost key, so the second confirmation ends as "refused, already recorded" rather than a silent replay; the screen presents this correctly.

## 3. SPA routing on Hostinger (must be tested live)

The repository ships no SPA fallback for Hostinger: `vercel.json` is a leftover from the previous host, `public/` has no `.htaccess`, and the deploy workflow rsyncs `dist/` and runs `deploy.sh` on the server (outside this repository). Direct requests to `/dashboard/*` already depend on the server rewriting unknown paths to `index.html`, and `/whatsapp/drafts/{id}` needs the same rule.

Test after deployment (expected: HTTP 200 and the SmartSpend `index.html`, not a host 404):

```bash
curl -sI https://smartspend.anasalharazeen.com/whatsapp/drafts/1          # 200, text/html
curl -sI https://smartspend.anasalharazeen.com/dashboard/whatsapp/drafts  # 200, text/html
curl -sI https://smartspend.anasalharazeen.com/dashboard/settings         # 200, text/html
```

Then in a browser: open `/whatsapp/drafts/1` signed out (expect the sign-in page, then the review screen after signing in; a missing draft shows "not available"). If these return 404, the server needs a rewrite equivalent to:

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ /index.html [L]
```

(a suggestion, not applied; do not add it to `public/` without checking what the server's `deploy.sh` already does).

## 4. Legal and metadata items (owner or legal decision)

Fixed (technical consistency): the public legal page generator canonical origin is now `https://smartspend.anasalharazeen.com` (the pages are generated at build time and git-ignored); `.env.example` and `docs/auth/google-sign-in/setup.md` no longer point at Vercel or Laravel Cloud (production URLs are the Hostinger ones). No OAuth or Google Console setting was changed; the Console must be checked to match.

Left unchanged and needing approval:

- `policyContent.js` (Arabic and English) still says SmartSpend uses hosting such as "Laravel Cloud and Vercel". That no longer matches the Hostinger deployment, but it is a published factual claim about data processors, so it was not edited.
- The Privacy Policy and Terms say nothing about WhatsApp or Meta: that messages sent to SmartSpend on WhatsApp are processed through Meta's WhatsApp Business platform, what is stored (masked last digits, a protected identifier, message-derived drafts and their retention), and consent for being contacted. These disclosures must be written and approved by the owner or legal counsel before WhatsApp is enabled for users. The backend retention settings to base them on are in `config/whatsapp.php` and the handover document; they are not restated here.

## 5. TASK 09 checklist

Backend and environment
- [ ] Backend branch merged and deployed; migrations applied; `WHATSAPP_ENABLED` still false.
- [ ] `WHATSAPP_FRONTEND_URL` set to the production frontend, https.
- [ ] `FRONTEND_URLS` / CORS allow `https://smartspend.anasalharazeen.com`.

Frontend deployment (via the normal `development` workflow only)
- [ ] The production build has `https://smartspend-api.anasalharazeen.com/api` (the workflow checks this).
- [ ] Section 3 curl checks pass.

With WhatsApp disabled (production default)
- [ ] `GET /integrations/whatsapp` → `enabled:false`, `state:disabled`; Settings shows the unavailable state; no Connect button.
- [ ] Link endpoints answer 409 `whatsapp_disabled` and the UI stops cleanly.
- [ ] An existing draft (created in staging or by a controlled test) can be opened from the inbox, edited, saved, and confirmed once; the transaction appears with source "WhatsApp"; the sidebar and Attention Center counts drop.

Staging with WhatsApp enabled and a test Meta number (never production customers)
- [ ] Link: LINK message, verification, explicit confirm, preferences, unlink.
- [ ] A WhatsApp expense becomes a draft; the review link opens (signed out → sign-in → review).
- [ ] Confirm with the network cut mid-request, then reload: exactly one transaction and one ledger entry; the screen ends on the recorded expense.
- [ ] Stale `review_version` (edit in two tabs), insufficient balance, archived account.

Legal
- [ ] WhatsApp/Meta disclosures approved and published; hosting statement corrected.

## 6. Not part of this work

No commit, push, merge, deploy; no backend change; no live Hostinger, Meta, Google, or production data access.
