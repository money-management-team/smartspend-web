# Dashboard header search (pages)

The header field searches the dashboard's **pages**. It does not search backend data yet.

## Files

- `layouts/DashboardLayout/navigation.js`: the navigation model (`getNavigation`), shared by the sidebar and the search. A page added to the menu becomes searchable automatically.
- `components/DashboardSearch/searchIndex.js`: pure functions. `buildPageIndex(i18n)` flattens the model, and `searchEntries(entries, query)` ranks matches.
- `components/DashboardSearch/DashboardSearch.jsx` and `.css`: the combobox UI.

## Behavior

- Each page is indexed with its name **and group** in both Arabic and English (`i18n.getFixedT(language)`), so "budgets" finds the page from the Arabic UI and the reverse. Case, Arabic diacritics, tatweel and alef/yaa/taa-marbuta variants are folded.
- Every word of the query must match. A label starting with the query ranks first. An empty query shows nothing; no matches shows `dashboard.header.search.noResults`.
- Keyboard: Arrow Up/Down move (wrapping), Enter opens the highlighted page, Escape closes the list and then clears the field. Clicking a result navigates; so does moving to any page, which resets the search.
- ARIA: `role="combobox"` input with `aria-controls`, `aria-expanded`, `aria-activedescendant`; `role="listbox"` / `option`; a polite live region announces the result count.
- At 480px and below the field collapses to an icon button and opens as a bar over the header (Escape or the close button returns focus to the button). The results panel stays inside the viewport (`inset-inline: 0`, `max-height`).
- RTL: logical properties only.

## Adding data search later

Return entries of the same shape (`{ id, path, label, context, haystack, labelText }`) from an API-backed source and concatenate them with the page entries before `searchEntries`. The component only renders `label` and `context` and navigates to `path`.

## i18n

`dashboard.header.searchPlaceholder` and `dashboard.header.search.*` (label, open, close, results, noResults, count) in both locales.
