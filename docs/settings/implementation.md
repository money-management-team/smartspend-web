# Preferences

The profile and security tabs use the existing profile and password endpoints.
The preferences tab now writes `locale` and `timezone` through `PUT /profile`,
then updates the current user and the browser's language after success.
Theme is a browser-local choice because the backend has no theme field.
The workspace base currency is displayed on Profile but cannot be changed
through the profile API. AI consent and retention live on the assistant's
separate settings tab.

## Tabs and URL

The active tab is kept in `?tab=` (`profile` default, `security`, `preferences`, `integrations`), so a refresh or a shared link opens the same tab. Unknown values fall back to `profile`. Build links with `getSettingsTabPath(tab)` from `routes/Path.js`. The Integrations tab hosts WhatsApp; see `docs/whatsapp/linking-ui.md`.
