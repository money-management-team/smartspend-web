# AI Copilot web integration

The assistant uses the Laravel `/ai/*` endpoints through `api/aiCopilotApi.js`.
The four views are chat, active insights, 30-day forecast and privacy settings;
see [ui.md](ui.md) for the page structure and components.
No sample financial answer is shown. The backend decides the amounts, sources,
currencies and forecast; the web app does not construct financial claims.

## Conversation lifecycle

`GET /ai/conversations` loads the list. The first question creates a conversation
with the current language, then posts a message with `client_request_id`. A failed
post keeps that ID for a retry of the same question in the same conversation.
Conversation history is read from the last page first because the API orders
messages by ascending ID; older pages can be loaded on demand. Selecting another
conversation discards the current draft retry ID. Deleting a conversation asks
for confirmation and removes it from the visible list after server success.

Assistant sources link only to known in-app record types and reports. Feedback
calls the owned message or insight feedback endpoint. Insight refresh queues a
job and does not imply the new insights are immediately ready.

## Consent and errors

The settings tab reads and writes the user-facing settings only. If AI is
disabled, chat submission is disabled until the user enables it. Delete AI data
requires an explicit browser confirmation, sends the backend's literal
`DELETE_AI_DATA`, refreshes settings, and clears the local AI UI. Financial
records are never deleted through this control.

All requests use the shared bearer-token client. Server errors, quota and
validation failures appear in a translated alert. The provider is never called
directly from the browser.
