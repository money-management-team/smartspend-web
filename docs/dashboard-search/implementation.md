# Dashboard search: implementation

```
src/layouts/DashboardLayout/
  dashboardNavigation.js                      the menu as data (shared with the sidebar)
  components/DashboardSearch/
    DashboardSearch.jsx / .css                the field, the popup, keyboard handling
    buildSearchEntries.js                     menu -> searchable entries (all languages)
    searchMatch.js                            normalisation, scoring, ranking (pure)
```

## One source of truth

`getNavigation(t, badge)` used to live inside `DashboardSidebar.jsx`. It now lives in `dashboardNavigation.js` and both the sidebar and the search call it. A page added to (or removed from) the menu therefore appears in (or disappears from) the search, with no second list to maintain. The menu has no per-role entries today, so every signed-in user sees the same pages; if a page later becomes conditional, hide it in `getNavigation` and the search follows.

## Indexing

`buildSearchEntries(i18n, t)` flattens the menu (groups included) and returns, per page:

| Field | Meaning |
| --- | --- |
| `path`, `label`, `group`, `icon` | What is shown and where it goes |
| `labels` | The page's name and its group's name in the current language **and** in `en` and `ar` (via `i18n.getFixedT`) |
| `keywords` | Extra words from `dashboard.search.keywords.<id>`, in both languages |

The keyword ids are mapped from the `PATH.USER.*` constants in `buildSearchEntries.js`. A page without an id is still searchable by its name.

## Matching and ranking (`searchMatch.js`)

Text is normalised (case-folded, Arabic diacritics and tatweel removed, alef / yeh / teh marbuta variants unified). For each typed word the best score wins: exact label 100, label prefix 80, any label word prefix 70, label substring 50, keyword prefix 40, keyword substring 20. A page matches when every word matches; the score is the average, ties keep menu order, at most 8 results are shown.

## i18n

Keys in `dashboard.search.*` (both locale files): `label`, `open`, `clear`, `results`, `empty` (with `{{query}}`) and `keywords.*`. `dashboard.header.searchPlaceholder` now reads "Search pages and tools..." because that is what the field does.

## Tests

`tests/dashboardSearch.test.mjs` builds the real index with the real translations and checks that every menu page is indexed, English and Arabic queries, cross-language matching, spelling normalisation, empty queries and multi-word queries.

## Extending it to data

Return entries of the same shape from another source (for example `{ id, path, label, group, labels, keywords }` for accounts or transactions fetched from an API) and merge them in `DashboardSearch.jsx` before calling `searchEntries`. Fetched data should be debounced and cancelled with an `AbortController`, and shown in its own group so page results stay first.
