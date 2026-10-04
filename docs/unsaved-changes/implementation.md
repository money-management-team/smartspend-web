# Unsaved changes protection

## Pieces (`src/components/UnsavedChanges/`, `src/components/ConfirmDialog/`)

| File | Role |
| --- | --- |
| `unsavedChanges.js` | `isFormDirty(current, baseline, fields?)`: compares after normalising (trim, `null` = `undefined` = `""`, numbers and booleans as text, lists by content), so formatting alone is never a change |
| `UnsavedChangesGuard.jsx` | For page forms. While `when` is true: holds in-app navigation to another page (`useBlocker`) and asks first, and arms the browser's `beforeunload` prompt for closing or reloading the tab |
| `useDiscardChanges.jsx` | For forms in a dialog. `requestClose()` asks before the X, Cancel, Escape or a click outside discards edits |
| `ConfirmDialog.jsx` | The prompt (`role="alertdialog"`); the safe button has initial focus |

`useBlocker` needs a data router; see the routing note in [error boundary](../error-handling/error-boundary.md#routing-note). A change of only the query string or hash on the same page (a filter, a tab) never prompts.

## Rules

- A form is dirty when its values differ from the saved baseline. After a successful save the baseline moves (Settings profile reads the updated user; dialog forms close), so the prompt stops without extra code.
- Nothing is armed while a request is in flight (`isDirty && !isSaving`), and nothing is armed when the form is clean.
- Editing a value back to the saved one makes the form clean again.

## Where it is applied

- **Page forms (`UnsavedChangesGuard`):** Settings → Profile (name, email, phone; baseline is the signed-in user) and Settings → Security change password (any field filled).
- **Dialog forms (`useDiscardChanges`):** account, budget, category, debt (create, edit, payment), transfer, recurring rule, savings goal (create, goal movement) and transaction correction. Each captures its initial values on mount and compares them on close.

Not covered: confirmation dialogs (archive, reverse, discard) and read-only screens have nothing to lose.

## Translations

`common.unsavedChanges.*` (EN and AR): title, message, discardMessage, stay, leave, keepEditing, discard.

## Tests

`tests/unsavedChanges.test.mjs` covers the dirty comparison. In a headless browser against a mocked API: leaving a dirty profile form is blocked, Stay keeps the page, Leave navigates, a clean form never prompts, the real tab navigation shows the browser prompt, and Escape on a dirty account dialog asks before discarding.
