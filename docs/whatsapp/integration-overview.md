# WhatsApp frontend: final integration overview

How the WhatsApp pieces fit together after TASK 04–08. Backend reference: `money-management-team/smartspend-backend`, branch `feature/whatsapp-availability-contract` @ `b7ca549` (Draft PR #3, **not merged**). Nothing here was run against the live backend, Meta, or production.

## Layers

| Layer | Where | Doc |
| --- | --- | --- |
| Adapter and contract | `api/whatsappApi.js`, `FinancialOperations/whatsappContract.js` | `api-integration.md` |
| Linking and settings | `Settings/components/WhatsAppIntegration/` | `linking-ui.md` |
| Draft inbox | `WhatsAppDrafts/WhatsAppDrafts.jsx` | `draft-inbox.md` |
| Draft review (edit, confirm, discard) | `WhatsAppDrafts/WhatsAppDraftDetails.jsx` + hook | `draft-review.md` |
| Shared pending count | `contexts/whatsappPending/` | this file |
| Dashboard integration | sidebar, Attention Center | this file |

## Routes

| URL | What |
| --- | --- |
| `/dashboard/settings?tab=integrations` | Linking, preferences, unlink, entry to the inbox |
| `/dashboard/whatsapp/drafts` | Inbox (filters and page in the URL) |
| `/dashboard/whatsapp/drafts/:draftId` | Review screen |
| `/whatsapp/drafts/:draftId` | The link the backend writes in WhatsApp replies (`review_path` default `/whatsapp/drafts/{draft}` on `WHATSAPP_FRONTEND_URL`); forwards to the review screen |

All four are children of the one `RequireAuth` + `DashboardLayout` route group, and each URL matches exactly one route (tested with `matchRoutes`). Unknown `?tab=` values fall back to Profile. Tab changes are real history entries.

## States

- **WhatsApp availability** (`GET /integrations/whatsapp`): `disabled`, `not_linked`, `linked`, from the backend, never inferred. Linking and link management follow `capabilities`.
- **Draft access is separate from availability.** Reading, editing, confirming and discarding drafts never consult `enabled`; the backend decides per draft (`can_edit`, `can_confirm`, `can_discard`, `confirmation.ready`). With WhatsApp off, an existing draft can still be reviewed and the pending count still counts it. The UI only says that no new messages are being received.
- **Draft lifecycle:** `collecting`, `ready_for_review`, `confirmed`, `discarded`, `expired`. Terminal states offer no action.

## Shared pending-review count

`WhatsAppPendingProvider` (mounted once in `DashboardLayout`, inside the signed-in area) owns the backend's `pending_review_count` from `GET /integrations/whatsapp/expense-drafts/summary`. Sidebar, Attention Center, the inbox header and the Settings entry read it with `useWhatsAppPending()`; the dashboard makes **one** request, not one per widget.

- It is the backend's global figure; it is never derived from loaded rows, and not hidden when WhatsApp is disabled.
- The result belongs to the signed-in user. After logout or a different user the previous number is never returned (consumers see "loading" until that user's own answer). The same user keeps the last number while re-reading, so a badge does not flicker.
- `refresh()` forces a re-read: after confirm and discard (`useWhatsAppDraftReview` `onChanged`), the inbox Refresh and the Attention Center Refresh. `ensureFresh()` is used when the inbox, Attention Center or Settings entry opens: it re-reads only if the last answer is older than 30 s, and does nothing while a request is in flight (this prevents a duplicate request on first load). A tab returning to view re-reads at most once a minute. No polling. A newer request cancels an older one and an older answer never replaces a newer one.
- Nothing is stored in the browser. Outside the provider the hook reports "unknown" and its actions do nothing.

## Sidebar

The "WhatsApp drafts" item under Transactions shows a small soft-primary badge with the count (capped like the notification badge: `99+`), with a screen-reader label (`dashboard.whatsappDrafts.sidebarBadge`, the exact number). It is hidden at zero, when the count is unknown, and the red alert style is not used. While the Transactions group is collapsed, a small dot on the group row carries the same label. Only this one item has an indicator. Works in the mobile drawer and in RTL.

## Attention Center

When the count is above zero a "WhatsApp drafts" card shows the number, one line of explanation and a link to the inbox. It is absent at zero; a failed read shows a small retryable note and leaves the rest of the page intact. No notification objects or unread states are invented.

## Errors

One vocabulary across screens: `classifyWhatsAppError` plus `getDraftsErrorMessage` / `getReviewErrorMessage` / `getWhatsAppErrorMessage` map 401, 403, 404, 409 (stale version, key conflict, `whatsapp_disabled`), 422, 429, network, timeout, 5xx and malformed responses to translated text; raw backend messages and request data are not shown. The adapter's in-flight refusal (`WHATSAPP_CONFIRM_IN_FLIGHT`) is translated too.

## Transaction source labels

The backend `TransactionSource` is `manual, natural_language, voice, receipt_ocr, statement_import, recurring_rule, business_request, whatsapp, system`. `dashboard.transactions.sources` (Transaction details) and the account movement history messages now cover all of them, `whatsapp` being "WhatsApp" / "واتساب". The older keys (`import`, `recurring`, `ai`, `api`) are kept. A WhatsApp-confirmed expense remains `type: expense`; no new transaction type exists.

## Privacy and session

No draft data, amount, key or token in storage, URLs or console (tested). The review screen is keyed by user + draft; late answers after a page or user change are dropped. Accounts and categories are requested for the draft's own workspace only.

## Tests

`docs/whatsapp/testing.md`. TASK 08 added `tests/whatsapp-ui/finalIntegration.test.mjs` (provider, sidebar, Attention Center, a Settings → inbox → review → confirm journey, reload with a confirmation in flight, route matching, Settings tabs, source labels, deployment metadata) and moved the existing TASK 05–07 UI tests onto the shared provider.

## Known limitations

- Only mocked backends were used (the fake draft server follows the backend source; see `production-readiness.md`).
- Visual checks are manual; the harness is documented in `testing.md`.
- The dialog focus trap and focus restoration come from the shared `ModalAccessibility` manager, which is mounted by `DashboardLayout`; the jsdom tests render dialogs without it.
- Unrelated and left alone: the existing 1.2 MB PDF chunk warning, and the Arabic "Commitments and dates" heading in the Attention Center wrapping letter by letter at 375 px.
