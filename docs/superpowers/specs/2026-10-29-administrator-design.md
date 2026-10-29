# Administrator overview

Approved direction: user delegated implementation choices on 2026-10-29.
Build a separate Admin feature in the existing React application at /admin.
Match the provided light English reference; fully translate Arabic, mirror RTL,
and reuse ThemeProvider and i18next for the four combinations and persistence.
Isolate CSS with admin prefixes and load the route lazily. No new runtime libraries.
Use explicit, public demo data, never real personal financial data. Do not infer
production admin authorization from the existing personal-user session.

Alternatives: a separate React application adds duplicate tooling and theming;
reusing the personal dashboard layout couples unrelated navigation and styling.
A dedicated feature and layout in this SPA is the chosen implementation judgment.

Scope: sidebar, header, overview, priorities, metrics, product summaries, growth
chart, service status; responsive layout, language/theme switches, collapse,
search, refresh demo feedback, CSV summary export, accessible detail dialogs.
Future sections are visibly identified as unimplemented, not fake live pages.
No backend integration or production permissions are claimed.
