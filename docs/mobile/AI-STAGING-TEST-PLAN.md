# Mobile — AI assistant: staging test plan for the nine writes

**Status (2026-11-16): a plan. No case below has been run on a deployed backend, and all nine writes are closed.** Contracts and classifications are in [AI-ASSISTANT.md](AI-ASSISTANT.md); the environment is in [STAGING-READINESS.md](STAGING-READINESS.md). A case counts only when its evidence is recorded (section 8); a passing automated test is not a result here.

The nine writes: `ai.conversationCreate`, `ai.message`, `ai.conversationDelete`, `ai.messageFeedback`, `ai.insightFeedback`, `ai.insightsRefresh`, `ai.insightDismiss`, `ai.settings`, `ai.dataDelete`.

## 1. Safety rules for every AI run

1. **Never use the production provider key, project or quota.** Staging has its own provider project, with a hard monthly spend cap set at the provider, and the key lives only in the staging `.env`.
2. **Lower the application limits on staging** so a mistake cannot burn the budget: `AI_COPILOT_GENERATE_PER_DAY` (default 120) and `AI_COPILOT_GENERATE_PER_MINUTE` (default 12) to small numbers for the run, restored afterwards.
3. **Synthetic prompts only.** No real name, account number, merchant or amount from a real person goes into a question. The test data is the staging seed.
4. **Watch the cost.** After each group, read `ai_usage_logs` (provider, model, tokens, cost) and compare with the provider's dashboard.
5. **Confirm AI cannot change money.** Before and after **every** case, record the row counts of `transactions`, `ledger_entries`, `accounts`, `transfers` and the balances of the seeded accounts. They must be identical: the assistant is read-only over finance. Any difference stops the run.
6. **One tester drives at a time**, and the circuit breaker and throttles (section 4) are accounted for, so a failure is not mistaken for another.

## 2. The provider: a decision the owners must make

There is **no runtime fake provider**. `FakeStructuredAIProvider` exists only inside PHPUnit; the application binds the real adapter and nothing selects another by environment. Three options:

| Option | What it is | Can it cover | Cost |
|---|---|---|---|
| **A. Real provider, dedicated staging project** | The real adapter with a capped staging key and the lowered limits of rule 2 | Happy path, replay, ownership, consent, throttles, usage logs. **Failures only by configuration**: an invalid key gives a stored `authentication_failed` (503); `AI_COPILOT_TIMEOUT_SECONDS=1` gives a stored `timeout` (503); the app throttle gives a 429 with `Retry-After`. A provider-side 429, a malformed answer or a grounding failure **cannot** be induced. Latency cannot be made long enough for the proxy experiment | Real, small, capped |
| **B. A staging-only provider stub** | Either a stub HTTP server the real adapter is pointed at (whether the Laravel AI package allows a base-URL override here is **Unverified**), or a **backend change** that binds the fake behind an environment selector that refuses to run in production, with configurable delay and failure modes | **Everything**, including 429, 502 grounding failures, malformed answers and 30–120 s delays (needed for [HTTP-408-EVIDENCE.md](HTTP-408-EVIDENCE.md) E5) | No provider spend. **Needs a backend change, which this phase did not and must not make** |
| **C. Production key or quota** | | | **Forbidden** |

**Recommendation:** ask the backend team for option B (an environment-selected fake provider that cannot be enabled when `APP_ENV=production`), and run option A for the cases it can cover in the meantime. Cases that need B are marked **[B]** below; without B they stay unverified and the write that depends on them stays closed.

## 3. Setup

- Personas (STAGING-READINESS.md §3.5): `owner-a` (consent given, insights and forecast on, two conversations, two insights), `owner-b` (the counter-party, with their own conversation, insight, feedback and settings), `no-consent`, `inactive`.
- A snapshot of the seeded database, restored between groups. Note the ids of `owner-a`'s and `owner-b`'s conversations, messages and insights; they are used in the ownership cases.
- Scheduler cron and the `ai-copilot` queue worker running (for refresh).
- Reads before writes: the assistant page, a conversation, the insights and the settings load for `owner-a` through the Mobile pilot build.
- Mobile build: a staging pilot build with **only the operation under test** in `APPROVED` (STAGING-READINESS.md §4). Each group below is a separate pilot.

## 4. Facts that shape the cases

| Fact | Consequence for testing |
|---|---|
| `throttle:ai-generate` (default 12/min and 120/day, per person, **shared by messages and insight refresh**) answers 429 with `Retry-After` **before the controller**: nothing is stored | A throttled message is a clean refusal. Hitting the limit with refresh makes messages fail and the reverse |
| `throttle:ai-privacy` (default 10/min) covers settings and data deletion | Pace those cases |
| The provider circuit breaker opens after 5 consecutive failures (`AI_COPILOT_CIRCUIT_FAILURE_THRESHOLD`) for 60 s (`AI_COPILOT_CIRCUIT_COOLDOWN_SECONDS`) and then fails fast as `unavailable` (503) | Run failure cases in a block, wait out the cooldown between blocks, and note when a fast failure is the breaker and not the provider |
| A message can take up to two stages × `AI_COPILOT_MAX_ATTEMPTS` (default 2) × `AI_COPILOT_TIMEOUT_SECONDS` (default 45) ≈ 180 s plus backoff in the worst case, in one synchronous request. Mobile waits **90 s** | Slow provider cases legitimately produce an **unknown outcome in Mobile while the server is still working**. The replay cases below are the recovery |
| The stored pair exists **before** the provider call, so a resend during processing returns the stored pair with the assistant message still `processing` | Mobile must show it as pending, not as an answer |

## 5. Test matrix

For each case: the **Mobile** column is what the pilot build must show; **Server** is what to record from the response and the database. "Rows" means database rows counted before and after.

### 5.1 `ai.conversationCreate` (`POST /ai/conversations`, classification `duplicates`)

| ID | Case | Expected | Evidence |
|---|---|---|---|
| CC-1 | Create with `locale` en, then ar | 201, `status: active`, locale as sent; conversations +1 each | Response, rows. Mobile: one request, body `{locale}` only, no key, result links to the new conversation |
| CC-2 | `no-consent` user | 403 "AI consent is required…"; no row | Response, rows. Mobile: refusal shown with the server's message |
| CC-3 | `inactive` user; no token | 403; 401 | Responses |
| CC-4 | Invalid locale (`fr`) | 422 | Response (sent from a script, not Mobile) |
| CC-5 | **Duplicate arrival** (two identical requests) | **Two rows**: there is no dedup. This records the accepted risk and is the reason Mobile never resends | Rows |
| CC-6 | Unknown outcome: abort the client right after sending | Row exists. Mobile: unknown outcome, nothing resent, a reload shows the conversation in the list | Rows, Mobile screenshot |

### 5.2 `ai.message` (`POST /ai/conversations/{id}/messages`, classification `same-result`, key = `client_request_id`)

| ID | Case | Expected | Evidence |
|---|---|---|---|
| MS-1 | Happy path | 201, `replayed: false`, a user and an assistant message stored; provider calls +1 (stub counter) or usage-log rows for intent and chat; money counts unchanged. Mobile: body exactly `{content, client_request_id}` (no other key, no header), the answer appears after the re-read, the box empties | Response, rows, usage log, counter |
| MS-2 | **Same id, same text, sequentially** | **200, `replayed: true`, the same message ids; provider calls unchanged; no new rows** | Response, counter, rows |
| MS-3 | **Same id, same text, two concurrent requests** | One provider call; one pair; the second answers replayed | Counter, rows |
| MS-4 | **Same id, different text** | The **first pair is returned (replayed), the new text is ignored**: the server does not compare content. Mobile must never produce this: type A, cause an unknown outcome, reload, type B, and confirm a **different** `client_request_id` is sent; then retype A and confirm the **same** id | Response; Mobile network log of both ids |
| MS-5 | **Stored provider failure** (timeout, via `AI_COPILOT_TIMEOUT_SECONDS=1`; or an invalid key) | 503 `{ error: { code, retryable } }`; the pair is stored with the assistant `failed`; the failure shows in the conversation | Response, rows, conversation read |
| MS-6 | **Replay of the stored failure** (same id after MS-5, after fixing the configuration) | 200, `replayed: true`, **still the failed pair**: the same id never retries | Response |
| MS-7 | **New id after a stored failure** | A new pair; the provider is asked again; the failed pair stays in history. Mobile: after the failure the key is released and the next send has a **new** `client_request_id`; the question stays in the box | Mobile network log, rows |
| MS-8 | Provider rate limit (provider 429) **[B]** | 429 with `error.code: rate_limited`, stored failed pair. Mobile: the limit wording, not "too many changes" | Response, Mobile screenshot |
| MS-9 | Grounding failure **[B]** | 502 `grounding_failed`, stored failed pair | Response |
| MS-10 | **Unknown outcome, slow provider** **[B]** (delay 100 s, over Mobile's 90 s) | Mobile shows an unknown outcome at 90 s, sends nothing more. After the server finishes: "Try sending again" sends the **same id** and returns `replayed: true` with the answer; **provider calls = 1** | Mobile log, counter |
| MS-11 | Resend **while still processing** **[B]** | The stored pair with the assistant `processing`; Mobile shows "still being prepared", not an answer | Response, Mobile screenshot |
| MS-12 | **App throttle (429 + `Retry-After`)**: set per-minute to 2, send three | The third is 429 with `Retry-After`; **no row, no provider call**; Mobile shows the wait in seconds and keeps the question. Repeat for the per-day limit (set to 2) | Response and header, rows, counter |
| MS-13 | **Ownership**: `owner-a`'s token with `owner-b`'s conversation id | Refused (record the actual status, 403 or 404); **no row in owner-b's conversation** | Response, rows |
| MS-14 | Consent withdrawn; a deleted conversation | 403; 404 | Responses |
| MS-15 | Validation: empty content; 4001 characters; `client_request_id` of 101 characters or with a space | 422 each; no row. (Mobile never sends these: its box blocks them; confirm it) | Responses |
| MS-16 | Prompt-injection and PII text | The injection guard's behaviour is recorded; an email and phone number in the text are not in the provider payload (stub log) **[B]** | Response, stub log |
| MS-17 | Money isolation | Transaction, ledger and balance counts identical before and after every case above | Counts |

### 5.3 `ai.conversationDelete` (`DELETE /ai/conversations/{id}`, `once-only`)

| ID | Case | Expected | Evidence |
|---|---|---|---|
| CD-1 | Delete own | 200 `data: null`; the conversation and its messages are gone from reads. Mobile: review, one DELETE with no body, result, the list read again | Response, rows |
| CD-2 | Repeat the same delete | **404**; nothing else changes. Mobile: after an unknown outcome a reload finds nothing to delete | Response |
| CD-3 | Ownership: `owner-a` deletes `owner-b`'s id | Refused (403 or 404, record which); **`owner-b`'s conversation intact** | Response, rows |
| CD-4 | Unknown outcome (abort after sending) | Deleted; Mobile shows an unknown outcome and the reload shows the page unavailable | Mobile log |
| CD-5 | Delete while a message is processing **[B]** | Record the result and that no orphan rows remain | Rows |

### 5.4 Feedback: `ai.messageFeedback` and `ai.insightFeedback` (`same-result`, upsert)

| ID | Case | Expected | Evidence |
|---|---|---|---|
| FB-1 | First feedback on an answer and on an insight | 200 `data.feedback` with the rating (and reason, comment). Mobile: one request, body `{rating, reason_code?, comment?}`, the sheet stays open and says it was saved | Response, rows |
| FB-2 | **Same feedback twice** | One row (an upsert), same values | Rows |
| FB-3 | Different rating afterwards | The same row updated | Rows |
| FB-4 | `normal_activity` on an **unusual-spending** insight | The insight is also dismissed (status and `dismissed_at`); the insights list no longer has it | Response, rows |
| FB-5 | Invalid rating; comment of 1001 characters; unknown reason | 422 each | Responses |
| FB-6 | Ownership: another person's message or insight | Refused; **no row for owner-b** | Response, rows |
| FB-7 | Unknown outcome | Saved or not; resending is safe (an upsert) | Mobile log |

### 5.5 `ai.insightsRefresh` (`POST /ai/insights/refresh`, `same-result`)

| ID | Case | Expected | Evidence |
|---|---|---|---|
| IR-1 | Refresh | **202**, `data: null`. Mobile says it is **queued and nothing is refreshed yet**; "Check again" reads the insights. After the worker runs, new insights appear | Response, jobs table, insights read |
| IR-2 | Double click, then a second refresh while one is pending | The unique job (per person and workspace) is queued **once**; no second job | Jobs table |
| IR-3 | Insights switched off | **422** "AI insights are disabled."; no job | Response |
| IR-4 | Consent off; no token | 403; 401 | Responses |
| IR-5 | **Shared throttle**: use up the generation limit with messages, then refresh | 429 with `Retry-After`; no job | Response |
| IR-6 | Provider failing during the job **[B or config]** | No insights, no crash, the job's retries (up to three) logged; the page still shows the old list | Logs, jobs |
| IR-7 | Provider cost | One refresh's usage-log rows and cost recorded | Usage log |

### 5.6 `ai.insightDismiss` (`POST /ai/insights/{id}/dismiss`, `same-result`)

| ID | Case | Expected | Evidence |
|---|---|---|---|
| ID-1 | Dismiss | 200, status `dismissed`, `dismissed_at` set; the list (default `active`) no longer shows it; Mobile reads again | Response, rows |
| ID-2 | Dismiss again | Same state | Response |
| ID-3 | Ownership | Refused; owner-b's insight stays active | Response, rows |
| ID-4 | Unknown outcome | Safe to repeat | Mobile log |

### 5.7 `ai.settings` (`PUT /ai/settings`, `same-result`, **explicit consent**)

| ID | Case | Expected | Evidence |
|---|---|---|---|
| ST-1 | Change insights, forecast, language, retention (30) | 200 `data.settings` with the values; Mobile sent **only the changed fields**, and the result shows the server's values | Response, row |
| ST-2 | Retention 6 and 366 | 422 (range 7–365 by default; the staging config states the real bounds) | Responses |
| ST-3 | **`ai_enabled: false`** | Consent withdrawn (`consent.active` false); a following message is 403; the assistant page shows it off | Response, follow-up |
| ST-4 | **Mobile never sends `ai_enabled: true`**: with the assistant already off, the settings form is not offered; with it on, the unchanged value is not sent | The Mobile network log of the whole run contains no request with `ai_enabled: true` | Network log |
| ST-5 | Enabling (consent) in the full version, then Mobile reads the settings | Consent active again; this path stays outside Mobile | Full-version run |
| ST-6 | Same PUT twice | Same state | Response |
| ST-7 | Prohibited fields (`user_id`, `provider`, `model`, `api_key`) | 422 | Response (script) |
| ST-8 | Privacy throttle (10/min) | 429 | Response |
| ST-9 | Unknown outcome | Safe to repeat | Mobile log |

### 5.8 `ai.dataDelete` (`DELETE /ai/data`, `same-result`, **destructive**)

| ID | Case | Expected | Evidence |
|---|---|---|---|
| DD-1 | Missing or wrong `confirmation` | 422; nothing deleted. (Mobile's wrapper always sends the constant; confirm it needs the acknowledgement tick first) | Response, rows |
| DD-2 | Correct request | 200 `data.deleted` with `conversations_deleted`, `insights_deleted`, `feedback_deleted`, `usage_logs_deleted` **equal to the counts taken just before** (including soft-deleted conversations and insights); the assistant is off (`consent_withdrawn_at`, `last_data_deleted_at` set, settings cleared) | Counts before, response, counts after |
| DD-3 | Mobile result | Shows the **server's** counts, says the assistant is off | Mobile screenshot |
| DD-4 | **`owner-b`'s data is untouched** (conversations, insights, feedback, usage logs, settings) | Identical counts before and after | Counts |
| DD-5 | Repeat | 200 with zero counts (usage logs may be non-zero only if new ones were created); nothing else changes | Response |
| DD-6 | Money isolation | Accounts, transactions, ledger and balances unchanged | Counts |
| DD-7 | Unknown outcome | Deleted or not; a reload shows the assistant's state; repeating is safe | Mobile log |
| DD-8 | End of the run | Restore the staging snapshot | Restore log |

## 6. Cross-cutting checks (every pilot build run)

- **Closed gate sends zero requests**: the same pages on a build without the operation in `APPROVED` produce no non-GET request (a network-log assertion).
- **One tap, one request**, double taps included; the busy state is visible.
- **No automatic resend** after an unknown outcome, a 5xx, a timeout or a stored failure; "Try sending again" is the only way, and it is a person's action.
- **Key hygiene**: the same question after a reload reuses its id; another question gets its own; after a confirmed answer or a stored failure the key is released (the browser's storage holds only the key and a hash, never the text).
- **Both languages and directions**; light and dark.
- **No test switch** in the pilot bundle (the build check used for the earlier phases).

## 7. Order inside AI

1. `ai.messageFeedback`, `ai.insightFeedback`, `ai.insightDismiss`, `ai.settings` (no provider cost).
2. `ai.conversationCreate`, `ai.conversationDelete`, `ai.dataDelete` (low-risk but destructive or duplicating; `ai.dataDelete` with the snapshot restore).
3. `ai.insightsRefresh` (provider cost through the job).
4. `ai.message` **last**: it spends provider quota per question, needs the failure and slow cases of option B, and depends on the 408 evidence for long requests.

## 8. Evidence for each case

Record in one file per group, alongside the signed approval (WRITE-APPROVAL-REGISTER.md): the case id, date, tester, staging commits, persona, the request as sent (headers redacted: never a token), the status and body, the database rows or counts before and after, the provider counter or usage-log rows, the Mobile network log and a screenshot where a screen is involved, and **pass, fail or not run with the reason**. A case that needs option B and was not run is "not run", and the write it protects stays closed.
