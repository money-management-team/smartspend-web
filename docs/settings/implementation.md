# Preferences

The profile and security tabs use the existing profile and password endpoints.
The preferences tab now writes `locale` and `timezone` through `PUT /profile`,
then updates the current user and the browser's language after success.
Theme is a browser-local choice because the backend has no theme field.
The workspace base currency is displayed on Profile but cannot be changed
through the profile API. AI consent and retention live on the assistant's
separate settings tab.
