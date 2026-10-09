# WhatsApp linking and management UI

Settings → **Integrations** tab. Route: `/dashboard/settings?tab=integrations` (`getSettingsTabPath("integrations")`). It lives inside the existing Settings page, so `DashboardLayout`, `RequireAuth` and lazy loading are unchanged; the tab is part of the Settings chunk. The dashboard search finds it with "whatsapp" (it opens Settings).

Built on the TASK 04 adapter (`whatsappApi`, `whatsappContract`). Backend reference: `feature/whatsapp-availability-contract` @ `b7ca549`, not on `develop` yet. Against an older server the tab shows an explicit "not available on this server yet" message (the availability response lacks the new fields).

## Files

All under `src/features/Dashboards/User/Settings/components/WhatsAppIntegration/`:

| File | Role |
| --- | --- |
| `WhatsAppIntegration.jsx` | Container. Reads availability, renders the three states, owns unlink and its dialog. Props `api`, `accounts`, `createPoller` default to the real adapters (test seams). |
| `WhatsAppLinkFlow.jsx` | Stepper, message + copy, waiting, verified, expired/cancelled/failed. |
| `WhatsAppPreferences.jsx` | Reply language and default account. |
| `useWhatsAppAvailability.js` | `GET /integrations/whatsapp` with the keyed-request pattern; `reload` (shows loading), `refresh` (background), `replaceIntegration`. |
| `useWhatsAppLinking.js` | Reducer + poller + API calls for the flow. |
| `whatsappLinking.js` | Pure logic: poller, reducer, deep link, clipboard, error text. |
| `whatsappFormat.js` | Masked digits, date. |
| `WhatsAppIntegration.css` | `wa-` prefixed styles, tokens only. |

Also changed: `Settings.jsx` (URL tab), `SettingsTabs.jsx` + `tabKeys.js`, `routes/Path.js`, both locale files (`dashboard.settings.whatsapp.*`, `dashboard.settings.tabs.integrations`).

## States (from the backend, never inferred)

- **disabled** (`state: "disabled"`): calm unavailable card, no buttons. If an old link exists its masked digits are shown as information with a note that it is inactive. Historical drafts are mentioned in text only; there is no link to a draft screen (not built yet).
- **not_linked**: introduction, three-point explanation, "no expense is posted automatically", and **Connect WhatsApp** (only when `capabilities.can_link`).
- **linked**: status, masked number, reply language, default account (name when the backend sends it), linked date. Preferences and Disconnect appear only when `capabilities.can_manage_link`.

## Linking flow

1. User clicks Connect → `POST link-challenges` (one request at a time).
2. The backend's own `linking.message` (`LINK <token>`) and `public_number` are shown; Copy button with a live announcement, and a manual-select fallback if the clipboard is blocked. "Open WhatsApp" is a `https://wa.me/<digits>?text=…` link, offered only when `public_number` is a plain phone number; it opens in a new tab with `noopener noreferrer`.
3. Polling `GET link-challenges/{token}` starts after 4 s (about 15 requests/min; the backend allows 120/min).
4. On `sender_verified` polling stops and the masked `phone_last_digits` is shown with **Connect this number**. Nothing is activated until the user clicks it.
5. Click → `POST …/confirm` (guarded against double clicks) → availability is re-read → connected state and a success notice. Success text depends on the 200 response only.

Challenge statuses used (`WhatsAppLinkChallengeStatus`): `pending`, `sender_verified`, `confirmed`, `expired`, `cancelled`. `expired`/`cancelled` show a restart panel; a new challenge is only created by a user click (the backend also cancels the previous open one).

### Polling rules (`createChallengePoller`)

- One request in flight, one timer; a new `start` replaces the old poll.
- Stops on: settled status, `whatsapp_disabled`, 401/403/404, unmount/cancel (the in-flight request is aborted and nothing is reported afterwards).
- 429: waits `Retry-After` (max 30 s); other transient errors double the delay up to 30 s; five in a row stop the poll with an error and a Try again button.
- Bounded: at the challenge `expires_at` (+10 s) or after 20 minutes it makes one final read (the server has the last word, so a fast local clock can't expire a live link) and then shows the expired panel.
- A page refresh drops the token (memory only), so an unfinished link has to be restarted.

### Token handling

The raw token exists only in the reducer state of the open flow. It is dropped on expiry, cancel, success and unmount, and never goes to storage, the URL, `console`, or any service except the user-initiated `wa.me` link to WhatsApp. Errors shown to the user are translated text; backend English messages for the cases the UI explains are not displayed. Tests assert storage, `location`, cookies and console output contain no token.

## Preferences

`PATCH /integrations/whatsapp/preferences`, only changed fields: `language` (`ar` | `en`, per `UpdateWhatsAppPreferencesRequest`) and `default_account_id` (integer or `null`). Accounts come from `accountsApi.list({ id_workspace: integration.workspace_id })`, filtered to `status === "active"` and no `savings_goal`, mirroring the backend rule; the backend remains authoritative. A 422 on `default_account_id` shows "can't be used anymore" and reloads the list. A saved default that is no longer eligible stays visible as "Account no longer available". Balances are neither read nor shown.

## Disconnect

Confirm dialog (existing `ConfirmDialog`, safe choice focused first) → `DELETE /integrations/whatsapp/link` once → availability is re-read. Nothing is deleted locally; the copy states that drafts, expenses and history are kept (backend policy). A 409 (already unlinked) or `whatsapp_disabled` shows a message and refreshes.

## Errors

`getWhatsAppErrorMessage(error, t, context)` maps by context (`create | poll | confirm | preferences | unlink`): `whatsapp_disabled`, 403, 404 (challenge), 409 per context, 422 per field; 401/429/network/timeout/server use the shared `api.errors.*`. `whatsapp_disabled` from any call triggers an availability reload.

## i18n, RTL, accessibility

- Complete AR/EN under `dashboard.settings.whatsapp.*` (key and placeholder parity are tested).
- Logical CSS; the service number, masked digits and message are `dir="ltr"` islands (`<bdi>` / `<code dir="ltr">`).
- Status is never colour-only (text badge plus shape), polite live regions for progress, copy and save feedback, `role="alert"` for errors, labelled fieldset/select/radios, 44 px touch targets, visible focus, `prefers-reduced-motion` disables animation, light/dark through tokens.

## Draft inbox entry

Below the state card, a "WhatsApp expense drafts" row links to `/dashboard/whatsapp/drafts` whenever `capabilities.can_review_drafts` is true (also when disabled or never linked). It shows the shared backend pending count (`useWhatsAppPending`, one request for the whole dashboard; omitted if it cannot be read). See `docs/whatsapp/draft-inbox.md`.
