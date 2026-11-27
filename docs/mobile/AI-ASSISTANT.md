# Mobile — the AI assistant (Phase 2F)

**Assistant → New conversation → ask → answer; feedback on an answer or insight; refresh or dismiss insights; privacy settings; delete a conversation; delete my AI data.** All nine writes are **closed**: `APPROVED` in `src/mobile/data/writeGate.js` is empty. The reads (settings, conversations, messages, insights, forecast, input quotas) already existed and are unchanged. See also [PHASE-6UI-5C1-REPORTS-ASSISTANT-GETTING-STARTED.md](PHASE-6UI-5C1-REPORTS-ASSISTANT-GETTING-STARTED.md) and [../ai-copilot/integration.md](../ai-copilot/integration.md).

The assistant is read-only over SmartSpend's facts (`AiChatService` injects no finance action), so **none of these writes moves money**. A message and an insight refresh do spend provider quota, so each stays closed and none is ever resent by itself.

## Backend contracts (read from the source, never from production)

Refs: `develop` @ `fd87531` and `fix/financial-idempotency-p0` @ `6b696d72`: routes, controllers, requests, resources, services and the insights job are **identical** on both.

| Write | Request | Answer | Dedup (classification) |
|---|---|---|---|
| New conversation | `POST /ai/conversations` `{ title?, locale? }` (`ar` or `en`) | 201 `data.conversation` (status `active`) | none: a copy is another, empty conversation (`duplicates`). Needs consent (403 otherwise). |
| Send a message | `POST /ai/conversations/{id}/messages` `{ content (1–4000), client_request_id (≤100, [A-Za-z0-9._:-]) }`, `throttle:ai-generate` | 201 `data.user_message`, `data.assistant_message`, `replayed: false`; **200 with `replayed: true`** for a copy | `same-result` (a client key; see below) |
| Delete a conversation | `DELETE /ai/conversations/{id}` | 200 `data: null`; it and its messages are removed in one transaction | `once-only`: a copy is a 404 |
| Feedback | `POST /ai/messages/{id}/feedback`, `POST /ai/insights/{id}/feedback` `{ rating, reason_code?, comment? }` | 200 `data.feedback` | `same-result`: an upsert per (person, answer) under a row lock |
| Refresh insights | `POST /ai/insights/refresh`, `throttle:ai-generate` | **202** `data: null`: a `GenerateAiInsightsJob` is queued (unique per person and workspace while pending); 422 when insights are switched off | `same-result` |
| Dismiss an insight | `POST /ai/insights/{id}/dismiss` | 200 `data.insight` (status `dismissed`) | `same-result` |
| Settings | `PUT /ai/settings` (partial) `{ ai_enabled, insights_enabled, forecast_enabled, preferred_language, retention_days }`, `throttle:ai-privacy` | 200 `data.settings` | `same-result` |
| Delete my AI data | `DELETE /ai/data` `{ confirmation: "DELETE_AI_DATA" }`, `throttle:ai-privacy` | 200 `data.deleted` (`conversations_deleted`, `insights_deleted`, `feedback_deleted`, `usage_logs_deleted`); the assistant is switched off until consent is given again | `same-result` (a copy deletes nothing more) |

### Sending a message: what makes it safe, and the two traps
`AiChatService::send` stores the user message and the assistant message (status `processing`) **before** it calls the provider, under a unique `client_request_id` per conversation. A copy, including one that races the first, returns that stored pair with `replayed: true` **without calling the provider again**. So an unknown outcome can be recovered by sending the same id.

- **Trap 1: the replay does not compare the text.** The same id with other text returns the first pair. Mobile therefore binds the id to the exact text (a hash in `data/pendingWriteStorage.js`) and never produces one id for two texts. A pair whose user message isn't the text that was sent is not accepted as the answer.
- **Trap 2: a failure is stored and replayed.** A provider failure marks the stored assistant message `failed` and answers 429, 502 or 503 with `{ status: false, message, error: { code, retryable } }`. The same id would then replay the stored failure. So that body shape is a **certain** outcome (`AI_FAILED`, in `forms/useWorkflowSubmit.js`): the key is released and the next send is a new question. Any 5xx without that body stays unknown.
- **Limits:** `throttle:ai-generate` allows a configured number of questions per minute and per day (by default 12 and 120) and answers 429 with `Retry-After` **before the controller**: nothing is recorded. There is no endpoint that reports how many are left, so Mobile shows the wait the server gave and does not invent a counter. The receipt and voice quotas card is unchanged.
- **No streaming:** the answer arrives in one response (up to 90 s). Mobile shows an "asking" state and nothing more.

### Consent
Enabling the assistant is a **consent decision**: `AiSettingsService` creates or renews consent only for `ai_enabled = true`. Mobile never sends that: its settings form is offered only while the assistant is on, and can turn it **off**; turning it on again is done in the full version, where the consent is shown.

## What Mobile does

Already there: the assistant page (settings, insights, forecast, conversations, input quotas), the conversation page, a draft composer, a draft feedback form and a draft delete sheet (all with a disabled Send and a closed note).

Added:
- **A box in each conversation** (`assist/ConversationComposer.jsx`), offered only while `ai.message` is open. One request per submission; the box is emptied after an answer; a failed attempt keeps the question; after an unknown outcome nothing is resent and **"Try sending again"** sends the same text with the same id, which SmartSpend recognises. The server's answer is read again (the conversation's reads only). A 2xx that isn't provably this question is acknowledged without claiming an answer.
- **New conversation** (`/m/add/ai-new`, the forms engine): reviewed, then created; the result opens the conversation. A question typed on the assistant's page travels with it (router state) into the new conversation's box; it is **not** sent until the person sends it.
- **Feedback** wired into the existing sheet (`assist/AiFeedback.jsx`); **refresh** and **dismiss** (`assist/InsightActions.jsx`): a refresh says it is queued and that nothing is refreshed yet, and offers to look again.
- **Privacy settings** (`/m/assistant/settings`) with "Was" per changed setting, only the changed settings sent; **delete a conversation** (`/m/assistant/conversations/{id}/delete`, reached from its Delete sheet); **delete my AI data** (`/m/assistant/delete-data`), which needs an explicit acknowledgement and shows the server's counts.
- Rate-limit and provider-error wording (`forms/WriteOutcome.jsx`), in English and Arabic.

Two general fixes the tests needed (they affect other screens for the better):
- `data/useResource.js` re-reads an entry that was dropped while its screen is mounted; before, such a list stayed on its loading state until reopened.
- `forms/useWorkflowSubmit.js` drops only the reads an assistant write can change (feedback and a queued refresh: none; a dismissal: the insights; a message: its conversation and the conversation list). Everything else still drops every read.

## Tests
`tests/mobileAiAssistant.test.mjs` (42 tests), against a fake backend that models the stored-pair replay, a provider-call counter, stored failures, the throttle with `Retry-After`, consent and settings. It covers the registration, the closed gate (zero requests), each write with its exact payload, double submission, lost responses before and after the server received them, reload recovery, timeouts, provider failures, limits and quota exhaustion, consent refusals, unverifiable answers, privacy settings, conversation deletion, AI data deletion, Arabic and RTL, and that none of the new source files contains the test switch.

## Before opening
1. A staging run, with the provider limits in mind: one conversation; one question (and the same id again: a replay, no second provider call); a provider failure (stored, then a new id); the limit (429); feedback twice; a refresh (202) and dismissal; a settings change; a conversation deletion (then a 404); the AI data deletion.
2. The 408 evidence, a recorded per-write approval, then a separate commit adding the operations to `APPROVED`. `ai.message` and `ai.insightsRefresh` consume provider quota, so approve them last.
