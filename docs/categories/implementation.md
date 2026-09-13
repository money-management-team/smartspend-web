# Categories — Implementation

## Categories list (`Categories.jsx`)

- **Fetching:** one effect calls `categoriesApi.list` with an `AbortController`. The result is stored with the request key it belongs to (`typeFilter:reloadKey`), so there is no synchronous `setState` in the effect. The page is "loading" until the matching result arrives. Changing the filter or pressing "Try again" changes the key and refetches.
- **Loading:** `components/Loading` with `states.loading`.
- **Error:** the `getApiErrorMessage` text (for example the 429 "try again after N seconds") and a "Try again" button.
- **Empty:**
  - `states.emptyAll` (or `states.empty.{income|expense}` for a filter) with an "Add category" button when nothing is returned;
  - `states.emptyCustom` inside "Your categories" when only system categories exist.
- **Sections:** "Your categories" (custom, manageable) first, then "System categories" (read-only), each with a count. The backend order is kept inside each section.
- **Cards (`CategoryCard`):**
  - the name is a `Link` to `getCategoryDetailsPath(id)`, stretched over the whole card, so clicking anywhere opens the details; keyboard focus outlines the card;
  - icon badge tinted by `color` (validated hex); `icon` picks a known icon, falling back to the type's icon;
  - type chip (income green, expense red) and "System category" / "Custom category" under the name;
  - **Edit** and **Archive** sit above the link and are rendered only when `canManageCategory(category)`. Otherwise a "Read-only" badge is shown.

**State after each mutation:**

| Action | List update |
| --- | --- |
| Create | The returned category is appended if it matches the current filter (refetch if the response has no category); "added" notice |
| Edit | The card is replaced with the merged returned category, or removed if a type change moves it out of the filter; "saved" notice |
| Edit 404 | The list is refetched, so a stale card disappears |
| Archive | The card is removed (only active categories are listed); "archived" notice |
| Archive 404 / 422 (already archived) | The message stays in the dialog and the list is refetched |
| Coming back from the details page | The page mounts again and refetches. An archive done there passes `archivedCategoryName` in router state for the notice, which is then cleared from history |

The create form opens with the type of the current filter (expense when "All").

## Category details (`CategoryDetails.jsx`)

Route `PATH.USER.CATEGORY_DETAILS`; it reads `categoryId` from `useParams` and calls `categoriesApi.get`, keyed by `categoryId:reloadKey` like the list.

- **Header:** icon (tinted by `color`), name, and chips for type, kind (system with a lock icon / custom), and status (active / archived). Edit and Archive appear only when `canManageCategory`.
- **Notes:**
  - system → "This is a system category… read-only: it can't be edited or archived";
  - archived custom category → "Existing transactions keep it, but it isn't offered for new ones".
- **Details list:** name, type, kind, status, workspace relation, color (swatch + hex), icon (icon + name, or "Default for its type"), identifier (`slug`), created, last updated. Rows without a value are skipped.
  - Workspace relation: system → "Built in, available in every workspace"; `workspace_id` equal to the session workspace → "Your current workspace"; otherwise "Another workspace you can access". Raw ids aren't shown.
- **Errors:**
  - 404 → "Category not available", with no retry;
  - 401 → session flow;
  - 403 / 429 / network / timeout / server → the message and "Try again".
- **Edit:** the returned category is merged into the displayed one and a "saved" notice appears. A 404 turns the page into the not-available state.
- **Archive:** on success, navigates to the list with the archived notice. A 404 shows the not-available state.

## Create / edit form (`CategoryForm`)

- One modal for create and edit, pre-filled from the category.
- **Fields:**
  - name (required, max 255);
  - type (`income` / `expense`);
  - color: "No color" + 8 preset swatches (`CATEGORY_COLORS`); an existing non-preset hex is kept as an extra swatch;
  - icon: "Default icon" (the type's icon) + preset icons (`CATEGORY_ICONS`); an existing unknown icon name is kept as an extra option.
  - Swatches and icons are radio groups (`fieldset`/`legend`, visually hidden radios with `aria-label`s), so they work with the keyboard and screen readers.
- **Client validation:** an empty (trimmed) name shows `validation.nameRequired` under the field and sends nothing; an invalid type shows `validation.typeRequired`.
- **Type change (edit only):** as soon as the type differs from the saved one, a warning explains that existing transactions will be counted under the new type. Save stays disabled until "I understand, change the type" is ticked. Changing the type again resets the tick.
- **Payload:**
  - create sends `name`, `type`, and `color`/`icon` only when chosen; the parent adds `workspace_id` from `resolveWorkspaceId()`;
  - edit sends only changed fields (`null` for a cleared color/icon), and closes without a request when nothing changed. Colors are compared case-insensitively.
- **Duplicates:** a `pendingRef` guard blocks a second submit synchronously, the parent keeps a single in-flight save promise, and the inputs and buttons are disabled while saving.
- **Errors:**
  - 422 → `errors[field]` under name/type/color/icon, plus the backend message;
  - 403 / 404 → category messages;
  - 429 / network / server / workspace → `getApiErrorMessage`;
  - 401 → nothing (session flow).
- Escape or a click on the backdrop closes the form, except while it is saving.
- It reuses the dashboard modal shell from `Accounts/components/AccountForm/AccountForm.css` (`account-form-modal*` classes), so every dashboard dialog looks the same. `CategoryForm.css` only adds the pickers and the warning.

## Archive dialog (`ArchiveCategoryDialog`)

- `role="alertdialog"`; Cancel is focused first.
- **Copy:** "Archiving is not deletion…", then three points:
  - existing transactions keep this category;
  - it won't be offered for new transactions;
  - nothing is permanently deleted.
- **Confirm** calls `POST /categories/{id}/archive` once: a `pendingRef` guard, "Archiving..." with the buttons disabled, and Escape/backdrop blocked while it runs.
- **Errors stay inside the dialog:** 422 → the backend message (already archived); 403 → forbidden; 404 → not available; 401 → session flow.
- The confirm button uses the primary style, not red, and the card's archive button is a neutral archive icon.
- It reuses the same modal shell as the form.

## System-category protection (summary)

| Layer | Behavior |
| --- | --- |
| Card | No Edit/Archive buttons; "Read-only" badge |
| List handlers | `openEditForm` / `openArchiveDialog` ignore categories where `canManageCategory` is false |
| Details | No actions; read-only note; form/dialog only mount when `canManageCategory` |
| API | No `delete` wrapper; `is_active` never PATCHed; backend 403 is mapped to `errors.forbidden` |

`isSystemCategory` / `isActiveCategory` accept `true`, `1`, `"1"` and `"true"`, so a backend that serializes booleans differently can't make a system category look editable.

## i18n and RTL

All copy is in `dashboard.categories.*` (plus `dashboard.sidebar.categories`), in both locales, with exact key parity:

| Key | Content |
| --- | --- |
| `title`, `subtitle`, `add`, `edit`, `editNamed`, `archive`, `archiveNamed`, `readOnly` | Page header and card actions |
| `createSuccess`, `updateSuccess`, `archiveSuccess` | Success notices |
| `filters.*`, `types.*`, `kinds.*`, `status.*`, `sections.*` | Chips, labels and section headings |
| `states.*` | Loading and empty states |
| `archiveDialog.*` | Archive confirmation |
| `form.*` | Form labels, the type-change warning and confirmation |
| `icons.*` | Names of the preset icons (tooltips, `aria-label`s, details page) |
| `validation.*`, `errors.*` | Client validation and 403/404 wording |
| `details.*` | Details page labels, notes and states |

- Layout uses logical properties and `text-align: start`/`end`; the back arrow is mirrored under `[dir="rtl"]`.
- User-entered names use `dir="auto"`; hex colors, slugs and unknown icon names are wrapped in `<bdi dir="ltr">`.
- Colors come from tokens (`--color-primary`, `--success-soft`, `--danger-soft`, `--warning-soft`, …); only the user-selectable preset swatches are literal hex values, because they are data stored on the category.
