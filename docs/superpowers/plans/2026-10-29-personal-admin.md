
# Personal administration extension — 2026-10-29

Direction: reuse the approved isolated admin feature and shell. Add the supplied
Personal overview at /admin/personal with all four language/theme combinations.
Keep public synthetic demo data and the same branch. Do not connect personal APIs.

1. Add failing locale and browser route checks for the Personal screen.
2. Add lazy Personal route, route-aware sidebar/search and overview card navigation.
3. Implement metrics, six module-health tiles, three follow-up items, privacy note,
   and four-user table. Add working overview/users/health/reports tabs with URL state;
   secondary tabs reuse these sections rather than inventing unsupplied full screens.
4. Add localized operational CSV export, responsive CSS and keyboard-accessible tabs.
5. Run tests/build/changed-file lint, four-mode and mobile browser checks, review,
   commit to feature/administrator, retry authorized remote push if access changed.

Review focus: sidebar active state, back/direct-link routing, tab keyboard behavior,
RTL table and amounts, dark badges, mobile table scrolling, no financial data export.

Execution record:
- Added route and personal components; reused existing shell/theme/language/dialog.
- Unit suite: 3 passed. Personal browser smoke: 56 assertions passed.
- Existing platform browser smoke: 35 assertions passed after the extension.
- Review fixed route dispatch for trailing slash/case variations using explicit
  route selection and useMatch; regression coverage added.
- Visual QA fixed Arabic status badge clipping and isolated signed numeric notes.
- Synthetic data only; no dependencies added or personal API calls introduced.
