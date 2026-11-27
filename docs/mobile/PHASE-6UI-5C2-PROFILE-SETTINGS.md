# Phase 6UI.5C2: Profile and settings

Mobile only. Read-only: no write is opened (`APPROVED` in `src/mobile/data/writeGate.js` is still `Object.freeze([])`), Backend is untouched, and the flag-off build still contains no Mobile code (`tests/mobileBundle.test.mjs`).

## Audit: Desktop Settings against Mobile

Desktop Settings (`Settings/Settings.jsx`) has four tabs.

| Desktop | Backend | On Mobile |
|---|---|---|
| Profile: name, email, phone | `PUT /profile` | Shown (identity header, phone). The form (`/m/profile/edit`) can be filled in and reviewed; saving is closed and the page says so. |
| Profile: workspace main currency | read only on Desktop too | Shown. |
| Security: change password | `PATCH /profile/password` (Desktop: revokes the other sessions; this device keeps its token) | The form (`/m/profile/password`) can be filled in and reviewed; saving is closed. The Security group says what a change does on the full version. |
| Email verification status and "resend" | `GET /auth/email/status`; `POST /auth/email/verification-notification` | Status shown (from the app's single `EmailVerificationProvider`), "Check again" re-reads it (a GET). Resending is closed; the full version is linked. |
| Preferences: language | `PUT /profile` (`locale`) and the browser language | The shared language control (the same component as More and the app bar), applied on this device. The language saved to the account is the full version's; the page says so. |
| Preferences: time zone | `PUT /profile` (`timezone`) | Shown as saved. Changing it is closed; the full version is linked. |
| Preferences: theme | browser only (no backend field) | The shared theme control, applied on this device. |
| Preferences: display (hide amounts) | device preference (Experience store) | The same preference as Home's eye, as a switch here. Nothing leaves the device. |
| Savings reminders | `GET` / `PATCH /notifications/preferences` | The preference is shown and can be flipped as a draft. Saving is integrated as the closed write `notifications.preferences` ([NOTIFICATION-WRITES.md](NOTIFICATION-WRITES.md), Phase 1B): with the gate closed (the product) Save stays disabled, as before. |
| Integrations: WhatsApp | WhatsApp integration endpoints | Its Mobile screen (`/m/whatsapp`) is linked. |
| Sign out | `POST /logout` | ~~Not offered~~ **Offered since [SIGN-OUT-AND-SESSION.md](SIGN-OUT-AND-SESSION.md)**: the app's own `logout()`, outside the financial write gate (it moves no money). |

## What the screen is

`/m/profile`, eight labelled groups under an identity header (regrouped in the settings refinement, PROFILE-SETTINGS-DESIGN.md; every control, link and read is the same as before):

1. **Identity**: avatar, name, email and the email's state as a chip (verified, not verified, checking, not checked, unknown). "Verified" is shown only when the backend said yes.
2. **Account**: phone and workspace; Edit your profile.
3. **Appearance and language**: Language and Theme (the shared `DisplayChoices`, with the note that they apply on this device).
4. **Currency and region**: the main currency, and the time zone with a link to change it in the full version.
5. **Privacy on this device**: Hide amounts. The group is shown only where the app's privacy provider is.
6. **Notifications**: the savings-reminder preference (draft, not saved), the notification inbox, WhatsApp.
7. **Security**: Change your password; the email status with Check again; Security and sessions in the full version; what a password change does.
8. **Help and privacy**: support, contact, privacy and security.
9. **Session**: the real Sign out button, last ([SIGN-OUT-AND-SESSION.md](SIGN-OUT-AND-SESSION.md)).

The profile and password pages no longer repeat their title under the app bar.

## Shared code

- `ui/LabelledGroup.jsx`: the label-over-one-card group and the link row More introduced, now used by More and by Profile. It takes an optional decorative `icon` for the label; Profile passes one per group, More passes none.
- `ui/DisplayChoices.jsx`: language and theme, unchanged, reused.
- `settings/emailState.js`: the email status as one word, pure and tested.

## Footprint

- Reads on `/m/profile`: `GET /notifications/preferences` only (unchanged). The email status comes from the provider the app already has.
- More is unchanged in behaviour: it keeps its Appearance, app version and install blocks.

## Still not possible on Mobile

Saving a profile, changing a password, saving a notification preference (integrated but closed, see NOTIFICATION-WRITES.md) or the time zone or the account language, resending the verification email. Each is a write; none is approved. They are linked to the full version. (Signing out was in this list; it is now offered, see [SIGN-OUT-AND-SESSION.md](SIGN-OUT-AND-SESSION.md).)
