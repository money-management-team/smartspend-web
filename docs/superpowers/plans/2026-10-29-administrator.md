# Administrator implementation plan

1. Add behavior tests for translations, reference metrics and demo export. Observe
   missing admin resources fail, then add bilingual resources and demo data.
2. Add isolated Admin/Overview and components for shell, navigation, chart and
   details, using existing theme/language contexts, logical CSS and semantic HTML.
3. Register a lazy /admin route and PATH.ADMIN constant without changing existing
   layouts or auth guards. Document demo-only access and backend-auth follow-up.
4. Verify build, lint, locale parity; test all four modes and mobile in browser,
   including persistence, dialogs, navigation/search, export and overflow.
5. Review the full diff, commit only intended files, push feature/administrator.

Review focus: RTL ordering/numbers; dark readable surfaces; no mobile overflow;
keyboard dialog dismissal; direct /admin access contains only synthetic data.

Execution: inline, user delegated choices and asked to proceed. Use fresh clone
as isolated checkout, feature/administrator branch; no changes to main.

## Execution record

- Implemented tasks 1–4 in the isolated clone on feature/administrator.
- `npm test`: 2 passed; new admin files and modified route files pass ESLint.
- `npm run build`: passed; existing main-bundle size advisory remains.
- Browser smoke: 35 assertions passed across four language/theme modes,
  persistence, export contents, search/dialogs, keyboard drawer, 320–1440px.
- Review: fixed light text contrast and mobile drawer focus containment/restore.
- Regression fixes: prevent Enter from activating the new dialog close button;
  keep status messages translated when changing language.
- No package dependencies or existing user features changed. Full lint baseline
  errors and existing lockfile audit findings are recorded in docs/admin-preview.md.
- Ruling: keep preview publicly accessible with synthetic data only; production
  admin authorization requires backend enforcement and is outside this UI task.
