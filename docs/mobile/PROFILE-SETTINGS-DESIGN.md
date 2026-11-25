# Mobile — Profile and settings design

Profile and settings (`/m/profile`, `src/mobile/settings/MobileProfile.jsx`) was refined visually to match the sign-in, Home, Activity, Accounts, Budgets, Savings goals and Debts screens. What each setting does, what it reads and what is closed is in PHASE-6UI-5C2-PROFILE-SETTINGS.md and SIGN-OUT-AND-SESSION.md.

## What changed in markup

**Regrouping:** the same controls and links, regrouped so each kind of setting has its own group.
- **Account:** phone and workspace, and Edit your profile.
- **Appearance and language:** the shared language and theme controls, with the device note.
- **Currency and region:** the main currency (moved from Account) and the time zone with its full-version link.
- **Privacy on this device:** Hide amounts (moved from Preferences).
- **Notifications:** unchanged.
- **Security:** unchanged, now after Notifications.
- **Help and privacy:** unchanged.
- **Session:** unchanged, last.

The old Preferences group is gone; its contents are in the three groups above. Four group names were added to `i18n/sections/settings.js`, in English and Arabic: `appearance`, `region` and `privacy`, with `preferences` replaced.

**Icons and header:**
- Each group label has a decorative icon, using `LabelledGroup`'s new optional `icon` prop. More passes none and is unchanged.
- The identity header has the class `sm-profile-hero`.

**What did not change:**
- No request, control, link, write gate or auth change.
- The page still reads only `GET /notifications/preferences`.
- Hide amounts, language and theme apply at once on this device as before.
- The reminder preference still cannot be saved here while its write is closed (integrated in NOTIFICATION-WRITES.md, Phase 1B).
- Sign out is the app's own sign-out.
- The Privacy group is shown only where the app's privacy provider is, as the switch was before.

## Styles

They are in the section "Mobile Profile and settings, premium refinement" at the end of `src/mobile/styles/mobile.css`. Every rule is under `.sm-root [data-sm-screen="profile"]`.
- **Header:** the navy hero of the other screens, with brand light and corner ring.
  - The avatar is a blue-to-cyan disc with the initial.
  - The name is white and the email is soft blue.
  - The email chip is green when verified and amber when not verified (or not checked).
- **Groups:**
  - The label sits beside a small tinted icon tile. It is uppercase in English and plain in Arabic.
  - Each group is one card with the Home finish and hairline rows.
  - Values are in a firmer weight, and link rows have a soft hover.
- **Notes:** a quiet tinted line.
- **Sign out:** a full-width pill in the error colour.
- **Motion:** the header and groups rise in once (0.34s, staggered). This is off with `prefers-reduced-motion: reduce`.

The profile and password forms (`/m/profile/edit`, `/m/profile/password`) use the shared form screen and are unchanged.

## Not available

These settings are not offered, because Mobile has no such control:
- A currency choice: the main currency is the workspace's and is only shown.
- Notification channels or other notification switches beyond the savings reminder.
- Two-factor authentication, sessions or account deletion: these are in the full version, which is linked.

## Checked

Headless Chrome on a local dev server, at 360, 390 and 430 px, English and Arabic, light, and dark at 390 px. Every `/api` request was answered in the page with a fictional person:
- The whole page (four scroll positions) with a verified email.
- The header with an unverified email.
- The profile form.

Each loaded with no horizontal overflow and no page errors. Real devices were not checked.
