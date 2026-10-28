# Mobile Category Management and the first non-financial write (S04B4)

Categories for Mobile: a list, a category's page, **a new category, and a rename of your own**. These are the first requests Mobile makes that are not reads, and the slice sets the pattern for any later non-financial write. It builds on S04A–S04B3 ([S04A-foundation.md](S04A-foundation.md), [S04B1-readonly-home-accounts.md](S04B1-readonly-home-accounts.md), [S04B2-activity-readonly.md](S04B2-activity-readonly.md), [S04B3-planning-readonly.md](S04B3-planning-readonly.md)).

It moves no money: no transaction, transfer, account, budget, goal, debt or recurring write exists in Mobile. There is no archive, delete, type change, colour or icon change. No service worker, manifest or offline queue. Mobile is still off in production; nothing is pushed or merged.

## 1. Scope

```
/m/planning/categories                 MobileCategories        GET /categories[?type=]
/m/planning/categories/new             MobileCategoryCreate    POST /categories            { workspace_id, name, type }
/m/planning/categories/{id}            MobileCategoryDetail    GET /categories/{id}
/m/planning/categories/{id}/edit       MobileCategoryEdit      GET /categories/{id}, then PATCH /categories/{id}  { name }

data/writeApi.js                 the ONLY file that makes a non-GET request: sendCategoryCreate, sendCategoryUpdate
models/categories.js             one category, the list, the one-level grouping, filters
models/categoryForm.js           validation, the two payloads, what counts as proof, what an error means
categories/useCategoryMutation   the write's life: editing -> submitting -> confirmed | rejected | unknown
categories/                      the four screens, CategoryOutcome (confirmed / unknown), CategoryBadge
identity/guardContext.js         gives a write the identity guard (reads already had it through the store)
```

Discoverable from Planning (Tools → Categories, which was a full-version link in S04B3). Every page also links to the full version, which remains the only place for archive and for type, colour and icon changes.

## 2. Contract verification matrix

The backend repository is **not available** in this environment (only `smartspend-web` and the design preview are). So no row below is verified in backend source.

| Operation | Method | Endpoint | Request | Response | Financial side effects | Evidence |
|---|---|---|---|---|---|---|
| List | GET | `/categories?workspace_id=&type=` | query only | `data.categories` (active only, system ones included), not paginated | none (a read) | Documented ([../categories/api.md](../categories/api.md)), verified in frontend source (`categoriesApi.list`, Desktop `Categories.jsx`) |
| Detail | GET | `/categories/{id}` | — | `data.category` (+ `created_at`, `updated_at`) | none (a read) | Documented, frontend source |
| Create | POST | `/categories` | `workspace_id` (required), `name` (required, max 255), `type` (`income`/`expense`); `color`, `icon` optional | `data.category` | **None that the frontend can see**: the payload has no amount, account, transaction or date; the response is the category. Backend behaviour **unverified** | Documented, frontend source (`categoriesApi.create`, `CategoryForm`) |
| Rename | PATCH | `/categories/{id}` | only changed fields among `name`, `type`, `color`, `icon`; Mobile sends `{ name }` only | `data.category` | A new name is shown on every transaction that already uses the category (transactions reference `category_id`). Amounts and balances: none visible in the contract. Backend **unverified** | Documented, frontend source (`categoriesApi.update`) |
| Type change | PATCH | `/categories/{id}` | `{ type }` | `data.category` | **Changes what existing transactions mean** (counted as income instead of expense in reports and budgets) | Documented ([../categories/overview.md](../categories/overview.md)); the Desktop form requires an explicit confirmation. **Not implemented in Mobile** |
| Archive | POST | `/categories/{id}/archive` | none | `data.category` (`is_active: false`) | Transactions keep the category | Documented. **Not implemented** (and `DELETE` is a backend alias of it: not implemented) |

Other items of the audit:

| # | Item | Finding | Evidence |
|---|---|---|---|
| 7 | Types | `income`, `expense` | documented, frontend source |
| 8 | Parent | `parent_id` appears in responses; **no create or update parameter for it is documented** | documented (list sample), inferred absence |
| 9 | Name rules | required, trimmed, max 255 | documented |
| 10 | Duplicate names | **not documented**; the Desktop form does not check; whether the backend rejects duplicates (and with which status) is unknown | unverified |
| 11 | Permissions | system categories are read-only (403); a 404 means "doesn't exist or not yours" | documented |
| 12 | Auth and workspace | Bearer token; `workspace_id` is the session workspace | documented, frontend source |
| 13 | Inactive | the list returns active only; an archived category's page shows `is_active: false` | documented |
| 14 | Errors | 401, 403, 404, 409 (not documented for categories, handled), 422 with `errors.{name,type,…}`, 429, 5xx | documented / frontend source |
| 15–17 | Side effects, history, ledger | §4 | inferred from the frontend contract; backend unverified |
| 18 | Idempotency | **none** for categories (no `Idempotency-Key` in the contract or the wrapper); a repeated POST is a second category | documented, frontend source |

## 3. Actual API endpoints used

`GET /categories`, `GET /categories/{id}`, `POST /categories`, `PATCH /categories/{id}`. Nothing else is new. `workspace_id` comes from the session's stored workspace (`getStoredWorkspace`, the value the Desktop list also sends); Mobile does **not** call `resolveWorkspaceId()` (it writes to storage). With no usable stored workspace, the create form says so and sends nothing.

## 4. Evidence about financial side effects

**Gate decision: open for name-only and create-with-name-and-type, in a non-deployed, mock-tested build; server-side safety NOT verified.**

What the frontend contract shows: a category write carries only `workspace_id`, `name`, `type` (create) or `name` (rename); no money field, no account, no transaction id, no date. Transactions refer to categories by `category_id`, so a rename relabels them and changes nothing else that the contract exposes. The documented domain rules say archiving keeps the category on old transactions.

What remains unknown without the backend source: whether a create or rename triggers anything server-side (re-categorisation jobs, budget recalculation, AI rules, notifications, audit entries), and how duplicates are handled. These do not appear in any contract the frontend reads, and **nothing here claims they do not exist**.

What was excluded because the contract itself says it touches financial meaning: **changing a category's type** (the Desktop form's own warning: existing transactions are counted under the new type in reports and budgets) and **archive**. Colour and icon were left out to avoid duplicating the full version's preset lists, not for safety reasons.

## 5. Category list behaviour

- Your own categories first, then **Built in** (system), each row: icon badge (tinted by the stored colour, icon in the text colour), name, type chip, and "Read-only" with a lock on anything you cannot change. No counts, totals or amounts (the S03.5 drawing shows transaction counts; the contract has none, so there are none).
- **One level of grouping**, only when the data clearly says so: a category is shown under its parent when the parent is listed, is not itself, is in the same section and is itself top-level. A missing parent (filtered out or archived), a self-reference, a cycle or anything deeper is listed on its own.
- The type filter (All / Expense / Income) is the backend's `type` and lives in the address.
- States: loading, populated, empty (with "New category"), filtered-empty, only-system note, error with Retry, forbidden, offline/session/malformed (the shared `ErrorPanel` kinds), stale (an earlier read, marked), refreshing.
- A list with a row without an id, or an id twice, is refused whole.

## 6. Create and rename

**New category:** name (required, trimmed, at most 255 characters counted as characters) and type (required radio: Income / Expense; no default, so it is chosen on purpose). Sent as `POST /categories { workspace_id, name, type }`.

**Rename:** only for a category whose response says `is_system: false` and is active (an unclear flag means "not changeable"). The form starts from the category's name, **seeded once**: a later read never overwrites what is being typed, and the record is kept for the life of the form. Save is enabled only by a real change (spaces alone are not one). Sent as `PATCH /categories/{id} { name }`. The type is shown, **locked**, with the reason. Colour, icon and archive: "in the full version".

Both: labelled fields with "(required)", inline messages under the field, an error summary at the top that takes the focus and links to each field, the server's own 422 field messages under the field they name, sticky Create/Save and Cancel at the bottom of the page, "Discard your changes?" (a labelled sheet; Keep editing / Discard) when Cancel is tapped with a draft, a browser warning on reload or close while something is unsaved or sending. No hidden submit button.

## 7. Mutation-state handling

`categories/useCategoryMutation.js`: **editing → (validating) → submitting → confirmed | rejected | unknown**.

- **One request per submission.** A ref is set synchronously before anything is awaited, so a second tap or a second submit event in the same turn does nothing (tested with two clicks and a submit event in one turn: one request). It is released only by a rejection.
- While submitting the fields and buttons are disabled and the page says "it isn't sent twice".
- **Confirmed** requires proof in the answer: for a create, the server's category with an id, the name and type that were sent, not a system category, and (when it says) the same workspace; for a rename, the same id with the new name. The outcome page shows the **server's** name. A similarly named category in a later list is never taken as proof.
- **Rejected:** any 4xx (401, 403, 404, 409, 422, 429, …) means the server looked and refused; the draft stays, the reason is said in words, and the person may change it and send again **by hand**.
- **Unknown:** no answer (network failure, timeout, leaving), a 5xx, an answer that is not the documented envelope, a failure envelope with a success status, or a success that does not prove the write.
- After a write that may have happened (confirmed or unknown) everything read about categories is forgotten, so the next view is a fresh read.
- No retry after a timeout, after reconnecting, after the tab returns, in the background; no queue; no idempotency key (none exists for this endpoint); nothing in storage (tested: the typed name appears nowhere in local or session storage).

## 8. Unknown-outcome policy

"We couldn't confirm the result. The request was sent, but no clear answer came back. The category may or may not have been created. Check your categories before you try again. If you create it again and the first one went through, you'll have two. Mobile won't send it again by itself." It offers **only reads**: "Check my categories" (and, for a rename, "Check this category"). There is no resend button and no form. It is never called a failure. No reconciliation endpoint exists, and none was invented.

## 9. Identity safety

The identity guard of the scope is given to the write (`identity/guardContext.js`); `IdentityBoundary` now provides it beside the store (its only change). The guard is asserted **in the same turn the request leaves** (the API client reads the token synchronously when the call is made, so the token sent is the one just checked) and **again when the answer arrives**. Tests (`mobileCategoryIdentity.test.mjs`):

- another tab signs out before the tap: nothing is sent;
- another tab signed in as B and this tab missed the event: the tap is refused at the check, B's token is never used;
- sign-out or a switch to B while the request is on its way: the answer is not shown (not as success, not at all) and nothing is claimed; the identity notice replaces the screen;
- the identity changes with no event before the answer arrives: the check on arrival refuses it;
- a 401 while saving: a refusal; the app's own 401 flow ends the session;
- storage blocked at the tap: nothing is sent;
- leaving the form while it is sending: the request is not aborted (it is already on its way; aborting would not prove anything about the server), its answer is shown to no one, nothing is resent, and the list the person goes to is read fresh (and shows the result);
- a rename's late answer for a category the person left is not shown on the next category's form;
- a new session in the tab starts with none of the previous identity's categories.

Not changed: the Desktop `AuthProvider` (still no cross-tab listener; separate approval needed). Workspace changes inside one session are not a Mobile feature; the workspace is read from storage at the moment of the tap.

## 10. Routing

| Address | Mobile mode | Desktop mode |
|---|---|---|
| `/m/planning/categories[?type=]` | list | → `/dashboard/categories[?type=]` |
| `/m/planning/categories/{id}` | page | → `/dashboard/categories/{id}` |
| `/m/planning/categories/new` | new-category form | → `/dashboard/categories` (no query: a form's state is never carried) |
| `/m/planning/categories/{id}/edit` | rename form | → `/dashboard/categories/{id}` (no query) |
| `/m/planning/categories/abc`, `/007`, `/7/delete` | not available, no request | → `/dashboard` |
| `/dashboard/categories`, `/dashboard/categories/{id}` | **stay Desktop** | stay |

No canonical Desktop category route is redirected to Mobile (resolver tests and a real browser). The Planning destination is current on every category page.

## 11. Accessibility

Labelled inputs with `aria-required`, `aria-invalid` and `aria-describedby` to the message; the type radios in a `fieldset`/`legend`; the error summary is `role="alert"`, focused, with links that move focus to the field; the outcome heading takes the focus (`role="status"` for confirmed, `role="alert"` for unknown); the discard sheet is a labelled modal with focus inside and returned to Cancel; disabled controls are really disabled while sending; sticky actions stay above the bottom bar and a simulated on-screen keyboard. **The two type radio inputs are 24 px**; each sits in a 44 px label that is the tap target (the same pattern as the presentation choice on More). **Not claimed:** WCAG conformance, real-device or assistive-technology behaviour.

## 12. Arabic / English

All strings in both languages with exact key parity. Right-to-left layout and mirrored chevrons; the name field is `dir="auto"` (a Latin name in an Arabic page stays left-to-right, and the reverse); the server's own messages are shown isolated as sent; hex colours and icon names are in `<bdi dir="ltr">`.

## 13. Light / Dark

Both themes for every screen; the colour wash behind an icon is mixed with the surface so the icon keeps text-colour contrast in either theme.

## 14. Tests and browser results

| Suite | Tests |
|---|---|
| New: `mobileCategoryModels` | 17 |
| New: `mobileCategories` (list, page, create, rename, refusals, unknown outcomes, double tap, storage, only-category-writes) | 36 |
| New: `mobileCategoryIdentity` | 10 |
| Extended: read-only (the write facade is the only non-GET file and names exactly `create` and `update`; no archive/delete), routing (+1), planning, bundle | |
| **`npm test`** | **1423 / 1423** (1358 before), about 47 s, three full runs; lint clean |

The fake backend now takes an explicit allow-list of exactly two writes (`POST /categories`, `PATCH /categories/{id}`); any other non-GET still fails on the spot, allowed or not (tested with archive, DELETE, PUT, a transaction, a transfer and an account PATCH).

**Browser** (headless Chrome, touch emulation, a mock API with fictional data that also accepts the two writes; final flag-on build): **205 jobs / 198 Mobile renders**: the list at 320/360/390/430 px in English and Arabic, light and dark; a category's page, the new-category form, its validation errors, a confirmed create, a rejected create (422), an unknown create (502 with a non-JSON body), the rename form, a rejected rename (409), a confirmed and an unknown rename, each at 320 and 390 px in both languages and themes; empty, error, not-found, a built-in category's rename refused, "sending", the discard sheet, a simulated on-screen keyboard (visible area 420 and 330 px with the field focused), long names, hidden amounts; enlarged text at **1.25×, 1.5× and 2×** for the list, the form with errors, the rename, the unknown outcome and Planning; Planning → Categories and page → Rename → Back; three real two-tab identity runs on a filled form; the routing cases.

| Check | Result |
|---|---|
| JavaScript errors | **0** |
| Horizontal overflow | **0** (a first run found 4 at 2× text: the nested subcategory row could not wrap; and a sticky "New category" bar covered a quarter of a small enlarged screen. Fixed: rows wrap, smaller indent, actions not sticky; re-run clean) |
| Clipped text or amounts | **0** |
| Targets under 44 px | only the two type radio inputs (24 px; 30/36 px when enlarged), each inside a 44 px label that is the target |
| Headings | one `h1`, nothing deeper than `h2` |
| Writes | **62**, every one a job that submits; **at most 1 per job**; only `POST /categories` with exactly `{ workspace_id, name, type }` and `PATCH /categories/{id}` with exactly `{ name }`; all with the signed-in token |
| Two-tab identity | sign-in as B and sign-out in another tab on a filled form: identity notice, **0 writes**; an unrelated key: the form stays |
| Routing | §10, all as designed |

Found by looking at the screenshots and fixed: the three-option type filter wrapped to two rows at 390 px (a tighter variant now keeps short labels on one row); two sentences claimed that a create or rename changes no balance, which the frontend cannot verify (removed). Seen and **not** fixed: at 2× text on 320 px a long app-bar title ("New category") breaks inside the word; that is the S04A shell title and was left as it is.

## 15. Desktop regression checks

Desktop parity on the final flag-off build and the flag-on build before the last copy change (§14 explains the difference: two Mobile strings), 54 jobs each (every signed-out and signed-in route, desktop 1366×900 and a 390×844 phone), against two runs of the original baseline:

- URL, title, language, direction, theme, visible text and DOM identical in every comparison; 0 JavaScript errors; 108 API calls per build, all GET.
- **Flag on vs flag off: 50 of 54 identical, pixels included.** The other 4 differ only by the 388-pixel logo anti-aliasing patch (rows 17–44, columns 17–40) that the **baseline also shows against itself** (3 of 54 here), plus, on the WhatsApp draft page, 101 pixels of at most 1/255, the same baseline render noise found and isolated in S04B3 §15.
- Desktop Categories and a category's Desktop page **stay Desktop** in Mobile mode, and the Mobile chunk is not requested for them (real browser). A Desktop-mode visit to `/m/planning/categories?type=income#x`, `/m/planning/categories/1`, `/new?type=income` and `/1/edit` lands on `/dashboard/categories?type=income#x`, `/dashboard/categories/1`, `/dashboard/categories` and `/dashboard/categories/1`.
- **Regression of the earlier Mobile screens** on the same flag-on build: S04B3 Planning (387 jobs, 378 Mobile renders), S04B2 Activity (218 / 211), S04B1 Home, Accounts, identity and flags (188 / 180): **0 JavaScript errors, no overflow, no clipped amount, only GET requests (2,722 calls)**. The only targets under 44 px are the three presentation radios on More (24 px inside 44 px rows), as before.

## 16. Flag-off and flag-on bundle analysis

**Flag off vs the original baseline:** 149 of 150 files identical (only the entry chunk, as in S04B1–S04B3: the entry is identical to S04B3's flag-off entry after content-hash normalisation); the stylesheet is **byte-identical** (`style-CdLHj2cm.css`, 824,885 bytes, same sha-256); no Mobile file; `tests/mobileBundle.test.mjs` searches every file for 38 Mobile strings (now including `sm-cat-badge`, `sm-cat-form`, "We couldn't confirm the result", "Mobile won't send it again by itself", `/m/planning/categories`) and finds none.

**Flag on (final build):** one lazy `MobileApp` chunk, **181.4 kB (45.3 kB gzip)** (S04B3: 147.7 kB; the category screens, form, icons and strings); entry 418,680 bytes; stylesheet 848,558 bytes with **231 Mobile rules**, every Desktop rule present, unchanged and in the same order. The Mobile chunk contains no `"POST"` literal and no `/archive` path: the request methods live in the Desktop wrapper module it calls.

## 17. Remaining implementation blockers

- **Server-side side effects of create and rename are unverified** (§4): the backend source is needed before Mobile writes are enabled anywhere real.
- **Duplicate names:** unknown backend behaviour; Mobile neither checks nor warns.
- Leaving the page with the bottom navigation while a draft exists discards it **without a prompt** (Cancel and Back links ask; the route-level blocker needs the data router, which the test harness does not use, so it was not added).
- Colour, icon, type change and archive remain full-version only.
- S03.5 has no drawing for the create form or the outcomes; §18's screen specification was written for this slice and is **not product-owner approved**.

## 18. Backend verification still required

1. That `POST /categories` and `PATCH /categories/{id}` (name) create no ledger entry, change no amount or balance, and start no job that does.
2. What a duplicate name returns (status, `errors.name`), and whether names are compared case-insensitively.
3. Whether a rename is visible to other users of a shared workspace, and whether that needs a confirmation.
4. Whether a 409 is ever returned for categories (handled as a refusal, undocumented).
5. Whether the stored workspace can differ from the one `resolveWorkspaceId()` would return for a user with several workspaces.

**Screen specification (S04B4, not drawn in S03.5):** new-category and rename forms are full pages under the app bar (title = the action), a Back link, one card of fields, a sticky two-button bar (primary action, Cancel) on the page background; an error summary card with a red start border above the fields; the outcome replaces the form with one card: a heading, the server's name in bold, and links as buttons (confirmed: View the category / Back to categories; unknown: Check this category / Check my categories, no other action).

## 19. Recommended next slice

Before any further write: **the backend verification in §18**, and approval of the Desktop `AuthProvider` storage listener. Then the next non-financial write on the same pattern (for example a category's colour and icon, with the presets shared rather than copied), or — only with the product owner's decision — the first money-moving write (S04C), which additionally needs the idempotent-attempt pattern the full version already uses. Still no service worker, manifest or offline writes.
