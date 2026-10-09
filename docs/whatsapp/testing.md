# WhatsApp integration tests

```bash
npm test    # node --import ./tests/helpers/register.mjs --test "tests/**/*.test.mjs"
```

Node's built-in runner (Node 22). `fetch`, `localStorage` and `sessionStorage` are replaced by `tests/helpers/mockFetch.mjs`; no real API, token, Meta service or financial data is used.

## UI test infrastructure (TASK 05)

- `tests/helpers/loader.mjs` (registered by `register.mjs`): compiles `.jsx` with Vite's own `transformWithOxc`, stubs `.css`/image imports, loads `.json` without import attributes, replaces `import.meta.env`, and resolves extensionless relative imports like Vite.
- `tests/helpers/domSetup.mjs`: installs the jsdom window (dev dependency added for this). DOM test files must import it **first**: React DOM probes `document` once at import time to decide how to wire text-input `onChange`, so importing it earlier silently breaks typing/date inputs.
- `tests/helpers/dom.mjs`: helpers on top of it: `render`, `click`, `change`, `submit`, `flush` built on React's `act`. Components are the real ones.
- `tests/helpers/fakeDraftServer.mjs`: a stateful stand-in for the draft endpoints written from the backend source (version checks, validation, readiness, atomic confirmation with idempotent replay, discard). It answers through `mockFetch`, so tests see the exact method, path, headers and body, and its `transactions` list is the ledger: a double posting shows up there. Failures can be injected per call (`failNext(op, { kind, apply })`, `apply` = the server did the work but the answer is lost) and calls can be held (`hold(op)`).
- `tests/helpers/i18n.mjs`: i18next with the real locale files; `instance.missingKeys` records any untranslated lookup.

## Files

| File | Covers |
| --- | --- |
| `tests/whatsapp/integration.test.mjs` | Adapter: availability states, `whatsapp_disabled`, link challenge calls, preferences, unlink, abort, no token persistence |
| `tests/whatsapp/drafts.test.mjs` | Adapter: drafts, readiness, money/date precision, PATCH versions, confirm + idempotency, HTTP errors |
| `tests/whatsapp/regression.test.mjs` | `ApiError.serverCode`; Voice and Receipt Capture APIs |
| `tests/whatsapp-ui/linkingLogic.test.mjs` | Poller (fake clock), reducer, deep link, clipboard, error text, AR/EN copy parity |
| `tests/whatsapp-ui/draftHelpers.test.mjs` | Inbox helpers: filters/URL/query, exact money, dates and time zones, readiness, error text |
| `tests/whatsapp-ui/draftInbox.test.mjs` | Real inbox and details pages through a real router: route registration, list, empty, all statuses, filters, pagination, summary vs rows, disabled/unlinked, read-only details, readiness, errors, cancellation, out-of-order results, session change, GET-only requests through the real adapter, AR/EN |
| `tests/whatsapp-ui/finalIntegration.test.mjs` | TASK 08: shared pending count (one request, freshness, races, user isolation), sidebar badge and dot, Attention Center item, a Settings → inbox → review → confirm journey, reload with a confirmation still in flight, route matching, Settings tabs, transaction source labels, error text, deployment metadata |
| `tests/whatsapp-ui/draftReview.test.mjs` | The review screen end to end behind the real adapter and HTTP client: editing, save/conflict, confirmation contract, duplicate prevention, uncertain outcomes and same-key retry, reload, rejections, session isolation, discard, deep link through `RequireAuth`, privacy, AR/EN |
| `tests/whatsapp-ui/whatsappUi.test.mjs` | Real components in jsdom: the three states, full linking flow, preferences, unlink, accessibility, Arabic/English, token leaks |

## Real-browser checks

Tests cannot see layout (jsdom has none). For TASK 06 the real app was driven in Edge (headless, `puppeteer-core` kept outside the repo) against a **mocked** API: every `/api` request was answered by the script, the browser was started with `--host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE localhost"` so no other host resolves, and all data was invented. Widths 1440/768/375, English LTR and Arabic RTL, light and dark, inbox, details, empty, and the Settings integrations tab were captured and inspected. Run the dev server with `VITE_API_BASE_URL=/api` for such a session (the repo `.env` points at a real backend; under git-bash prefix `MSYS_NO_PATHCONV=1` or the value is rewritten into a Windows path).

### Browser isolation checklist (any session that runs the real app)

1. Serve with `VITE_API_BASE_URL=/api` (under git-bash with `MSYS_NO_PATHCONV=1`) and check the served `apiClient.js` shows it; the repo `.env` points at a real backend and is never edited.
2. Start the browser with `--host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE localhost"`.
2b. Check the served `apiClient.js` contains `"VITE_API_BASE_URL": "/api"` before starting the browser.
3. Intercept requests before navigating, answer every `/api` call from the mock, abort everything else.
4. Log every request at the CDP level (`Network.requestWillBeSent`, which includes CORS preflights) and fail the run on any host that is not allow-listed (only Google Fonts and Google Identity Services, which are refused by rule 2; the report lists the attempted hosts and counts).
5. Use a fake token and invented data; clear storage for "signed out" scenes (localStorage persists across pages of one browser).
6. Full-page screenshots of the RTL desktop layout can show a shifted sidebar (a capture artifact); take normal viewport captures to judge layout.

## Limits

- Visual checks are manual, not part of `npm test`.
- `Settings.jsx` itself is not rendered in tests (it pulls auth-dependent tabs); `SettingsTabs` is tested, and the `?tab=` logic is covered only by lint and build.
- Fixtures mirror the backend source at `b7ca549`; the live API was never called, and no real WhatsApp/Meta linking was exercised.
- `transactionsApi.js` has no test here.
