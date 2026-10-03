# Unsaved changes protection

`hooks/useUnsavedChanges(isDirty)` returns `{ confirmDiscard, markSaved }`.

- While dirty: closing or reloading the tab shows the browser prompt (`beforeunload`), and navigating to **another path** inside the app asks for confirmation (`useBlocker`; query-only changes are not a "leave"). The text is `common.unsavedChanges.message`, shown with `window.confirm`.
- `confirmDiscard()`: for the close button, the backdrop and Escape of modal forms. True when clean or confirmed.
- `markSaved()`: called right after a successful save so that a navigation in the same tick (or the page reloading) never prompts.
- Needs a data router (`main.jsx`).

## Where it is used

- Modal forms: Account, Budget, Category, Debt (create and edit), Recurring, Savings goal, Transfer. Dirty = the form differs from a snapshot taken on mount (`JSON.stringify`). All of them change the form only from user input, so there are no false positives.
- Settings > Profile: dirty = the form differs from the saved user, so it clears when a save updates the session. The currency field is read-only and ignored.

Forms not yet covered (movement/payment/correction dialogs, the financial operation entry form) can adopt the same hook.
