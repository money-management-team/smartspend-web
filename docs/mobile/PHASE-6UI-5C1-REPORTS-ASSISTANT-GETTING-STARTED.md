# Phase 6UI.5C1: Reports, Assistant and Getting started

Mobile only. Everything here is read-only: no write is opened (`APPROVED` in `src/mobile/data/writeGate.js` is still `Object.freeze([])`), Backend is untouched, and the flag-off build still contains no Mobile code (`tests/mobileBundle.test.mjs`).

Backend contracts were read from `fix/financial-idempotency-p0 @ 6b696d72` with `git show`, without checking anything out.

## 1. Reports

`/m/reports` opens on analytics instead of a list of links.

| Part | Source | Notes |
|---|---|---|
| Period | the address (`?from=&to=`) | This month, last month, last 3 or 6 months, this year, or a custom range of two real dates in order. Default: the last six months. A reversed or impossible range is ignored. |
| Net result, income, expenses | `GET /reports/overview` `summary_by_currency` (`net_income`, `total_income`, `total_expense`) | Per currency, one shown at a time; currencies are never added. A figure the answer lacks is "not available", never zero. |
| Change vs the previous period | `analytics.comparison_by_currency[].{total_income,total_expense,net_income}.change_percentage` | Shown as the backend sent it. When the backend has nothing to compare (it sends `null`), nothing is shown. |
| Income and expenses over time | `analytics.trend_by_currency` (`labels` + `series[{name,data}]`) | Paired bars, with the figures in a table underneath. Day, week or month buckets, chosen from the period (days up to about a month, weeks to about three, months beyond) and selectable (`group_by`). A negative bucket draws no bar; its figure stays in the table. |
| Spending by category | `analytics.top_expense_categories[].categories[]` (`name`, `total`, `percentage`) | The backend's top five and its share. |
| Budget performance | `GET /reports/budgets` (`items`, `summary_by_currency`, `analytics.utilization_by_currency`) | The backend's percentage and state word per budget; the first five, in the backend's order; each links to its Mobile page. |
| All reports | the ten existing report pages | Opened for the same period. |

A real defect was fixed on the way: the Mobile trend reader did not understand the backend's trend shape (`labels` plus `series: [{ name, data }]`, from `trendByCurrency`), so every trend chart would have been empty against a real server. `models/trend.js` now reads it. Desktop's reader (`Reports/reportHelpers.js`) was not touched; a search of it finds no handling of `labels` either, so it may have the same gap. That is outside this phase and was not verified by running it.

Hidden amounts: with amounts hidden, no bar is drawn (bar heights would show the figures) and amounts are masked.

Not built, because the backend has no such read: forecasts in Reports, per-category trends, per-budget history, and any figure combined across currencies.

## 2. Assistant

What Mobile can read: conversations, a conversation's messages, insights, the 30-day forecast, privacy settings and the receipt/voice reading quotas. What it does with that:

- A conversation reads as a chat (yours at the end, the assistant's at the start, each with its time).
- The message reader follows `AiMessageResource`: the time is `timestamps.created_at`, `status` says whether the reply was made, and a failed reply carries `failure.message`. A failed reply shows that message; a reply still being prepared says so. Neither is labelled AI-generated, shows made-up text, or offers feedback.
- Conversations show `message_count` and `last_message_at` when the backend sends them.
- The composer and every conversation link to "the full version" as the way to ask or continue.

**Blocked by the write gate (nothing is sent, and the screens say so):**

| Capability | Backend call | Why it is closed |
|---|---|---|
| Ask a question / reply | `POST /ai/conversations`, `POST /ai/conversations/{id}/messages` (body carries a `client_request_id`) | A write; not approved for Mobile. The composer is a draft box: Send is disabled, and the note says nothing typed is sent or kept. |
| Delete a conversation | `DELETE /ai/conversations/{id}` | A write. |
| Rate a reply or an insight | `POST /ai/messages/{id}/feedback`, `POST /ai/insights/{id}/feedback` | A write. The form can be filled in and checked; Send is disabled. |
| Refresh or dismiss insights, change consent or retention, delete data | `POST /ai/insights/refresh`, `POST /ai/insights/{id}/dismiss`, `PUT /ai/settings`, `DELETE /ai/data` | Writes. |
| Savings contribution suggested by a reply | Desktop opens a goal with a prefilled contribution | That path ends in a money write; not offered. |

## 3. Getting started

`/m/getting-started`, reached from More (first row of the first group) and from Search. Not on Home.

It makes the same four checks as Desktop's Getting Started (`Experience/GettingStarted.jsx`), each from a read the app already makes:

| Step | Read | Done when |
|---|---|---|
| Add an account | `GET /accounts` | an active account of this workspace that is not a savings goal's own |
| Record a first expense | `GET /dashboard?period=all` | `recent_transactions` is not empty, and the answer's `scope.workspace_id` is this workspace |
| Create a budget | `GET /budgets?per_page=1&page=1` | the paginator's `total` is above zero |
| Start a savings goal | `GET /savings-goals?per_page=1&page=1` | the paginator's `total` is above zero |

A step is done, to do, or "couldn't check" (the read failed, or its answer was malformed or about another workspace). A step that could not be checked is never counted as done, and "You're all set" appears only when all four were read as done. Nothing is stored: it is worked out from the backend each time, and there is no dismiss (Desktop's dismissal is a device-local preference).

Mobile cannot create accounts, expenses, budgets or goals (their writes are closed), so a step that is not done opens the full version; a done step opens the matching Mobile screen.

## 4. Footprint

- New reads on `/m/reports`: `GET /reports/overview` and `GET /reports/budgets` (the report pages' own reads, same cache keys).
- New reads on `/m/getting-started`: `GET /accounts`, `GET /dashboard?period=all`, `GET /budgets`, `GET /savings-goals` (existing Mobile loaders).
- No other screen's reads changed. The bar's bell still makes no notification request.
- `MobileApp` chunk: 566.81 kB before this phase, 600.64 kB after (gzip 139.49 to 148.79 kB). Still over Vite's 500 kB warning, as before.
