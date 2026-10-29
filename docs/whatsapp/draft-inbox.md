# WhatsApp expense draft inbox

Browse, filter and page through WhatsApp expense drafts. **The inbox itself never writes.** Opening a draft leads to the review screen (edit, confirm, discard), documented in `draft-review.md`. Built on the TASK 04 adapter; backend reference `feature/whatsapp-availability-contract` @ `b7ca549` (not yet on `develop`).

## Routes

| Route | Page |
| --- | --- |
| `/dashboard/whatsapp/drafts` | Inbox (`PATH.USER.WHATSAPP_DRAFTS`) |
| `/dashboard/whatsapp/drafts/:draftId` | Review screen (`getWhatsAppDraftPath(id)`) |
| `/whatsapp/drafts/:draftId` | Backend review link; forwards to the route above (see `draft-review.md`) |

Both are lazy pages inside the existing authenticated `DashboardLayout` (`RequireAuth`); refresh, direct links and back/forward work. Entry points: sidebar → Transactions → "WhatsApp drafts", the dashboard search, and the "WhatsApp expense drafts" row in Settings → Integrations (shows the backend's pending count).

The backend's review link (`/whatsapp/drafts/{id}`) is handled by `WhatsAppDraftLink`, documented in `draft-review.md`.

## Files (`src/features/Dashboards/User/WhatsAppDrafts/`)

| File | Role |
| --- | --- |
| `WhatsAppDrafts.jsx` | Inbox page: header, summary, filters, list, pagination. |
| `WhatsAppDraftDetails.jsx` | Read-only details page. |
| `components/DraftRow`, `DraftStatus`, `DraftDetailsView` | Presentational pieces. `DraftDetailsView` takes the parsed draft (`parseDraftResponse`) and is the part a review task would extend. |
| `draftHelpers.js` | Filters ↔ URL ↔ query, exact money/date display, readiness, error text. |
| `useWhatsAppDraftSummary.js` | The backend pending count (also used by Settings). |
| `WhatsAppDrafts.css` | `wad-` prefixed styles, tokens only. |

## Data

- List: `listDrafts` → `data.drafts` is a Laravel paginator; parsed by `parseDraftsPageResponse` into `{ items, pagination: { currentPage, perPage, total, lastPage, from, to } }`. Paging is a real backend page.
- Summary: `data.pending_review_count` from `GET .../summary`, owned by `WhatsAppPendingProvider` (see `integration-overview.md`) and shared with the sidebar, Attention Center and Settings. It is the user's global reviewable count, **not** the rows on screen or under the filters, and is not recomputed on a filter change. The inbox re-reads it when opened if it is older than 30 s and on its Refresh button. If it fails the header shows "–" and "Count unavailable"; the list still works.
- Details: `getDraft`. The id is only a path segment; a malformed id never reaches the network and is shown as "not found".
- Statuses (backend enum): `collecting`, `ready_for_review`, `confirmed`, `discarded`, `expired`, each with its own label and icon. A draft is described as a draft; only `confirmed` links to its transaction (`confirmed_transaction_id` → existing transaction page).

## Filters and paging

Only `status`, `date`, `account`, `per_page`, `page` exist. The backend lists `ready_for_review` when `status` is omitted and has no "all", so the status filter has five choices and no "All". They live in the URL (defaults omitted). Anything invalid in the URL (unknown status, impossible date, non-numeric account, `per_page` not in 10/20/50, bad page) falls back to its default instead of being sent, so a hand-edited URL cannot loop or 422. Any filter change returns to page 1. Reset clears everything. The account filter lists the user's own active, non-savings-goal accounts from the existing accounts API; an account id in the URL that is not in that list stays selectable as "Account #id". No workspace is ever sent. After a page change focus moves to the list. There is no free-text search (the backend has none).

## Money, dates, readiness

- Amounts stay decimal strings and are formatted by `Intl.NumberFormat` from the **string** (no `Number`/`parseFloat`; verified exact for 16+ digit values), 2 to 4 decimals. Missing or malformed → "Amount not set", never 0; a real `0.0000` shows as zero. Nothing is summed or converted; the currency shown is the draft's `currency_code`. The shared `formatMoney` is deliberately not used (it coerces with `Number` and turns missing into 0).
- `transaction_date` is shown as that calendar day with no timezone shift; `transaction_time` as the given wall-clock time; server timestamps are shown in the draft's `workspace_timezone` when it is valid. Missing values read "Not set".
- Readiness (only for `ready_for_review`): "Details complete" when `confirmation.ready`, "Needs attention (n)" when issues exist; details list every issue with localized text. Unknown issue codes show a generic message plus the code, never dropped. A note states that the balance and permissions are re-checked at confirmation.

## Availability

Reads do not look at the WhatsApp `enabled` flag. With WhatsApp off the inbox still loads and shows a note ("no new messages are received; existing drafts are still here"). Availability is read only to show that note; if it fails the inbox is unaffected. A user who never linked can still review drafts they have; the backend decides access (empty page for no manageable workspace, 403/404 otherwise).

## Session, races, privacy

Results are keyed by user id + filters + reload, requests are aborted on change/unmount, and a late answer for an older key is ignored, so a newer filter, another user, or another draft never shows stale rows (a skeleton is shown while loading). Nothing is written to storage and drafts are not cached across users. No polling; refresh is manual. Errors are translated (401/403/404/422/429/network/timeout/malformed); raw backend text is never shown.

## i18n, RTL, accessibility

`dashboard.whatsappDrafts.*`, `dashboard.sidebar.whatsappDrafts`, `dashboard.search.keywords.whatsappDrafts`, `dashboard.settings.whatsapp.inbox.*` in both languages (key and placeholder parity tested; no plural suffix keys, matching the project's exact-parity rule). Logical CSS; numbers, dates and times sit in `bdi`. Status uses text plus icon, the list is `role=list`, loading/errors/count are live regions, the whole card is one link target with a visible focus ring, touch targets are ≥ 40px, and animations stop under `prefers-reduced-motion`.

## Known limits

- Settings → Integrations on a 375px phone now shows its four tabs as a 2×2 grid (`financeExperience.css`) because the existing horizontally scrolling strip hid the fourth.
- No AttentionCenter integration: it is a separate aggregate feed and changing it is out of scope; the Settings and sidebar entries cover discovery.
