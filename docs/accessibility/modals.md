# Modal dialogs

Dialogs in the signed-in area share one keyboard and focus behaviour, provided centrally by `src/components/ModalAccessibility/` (mounted once in `DashboardLayout`) instead of being repeated in the 25+ dialog components.

## What counts as a modal

Any element with `role="dialog"` and `aria-modal="true"`, or `role="alertdialog"`. The project's form and confirmation dialogs already render this way. Native `<dialog>` elements opened with `showModal()` (the welcome and policy dialogs, `GlassDialog`) already trap focus, make the page inert and restore focus themselves, so the manager ignores them.

## Behaviour (`modalManager.js`)

For the top-most open modal:

| Need | How |
| --- | --- |
| Focus moves in on open | First focusable control, unless something inside already took focus (e.g. `autoFocus` on a Cancel button). A modal with nothing focusable gets focus itself |
| Tab and Shift+Tab stay inside | A capturing `keydown` handler wraps focus between the first and last visible control |
| Background not reachable | Everything outside the modal (the siblings of the modal and of each of its ancestors) gets `inert`: no keyboard, pointer or screen-reader access. Elements that were already inert are left alone and never "un-inerted" |
| Focus returns on close | To the control focused before the dialog opened (tracked with `focusin`), if it is still on the page and focus was lost |
| Nested dialogs | A stack: the newest is active; when it closes the previous one is active again (a discard prompt above a form) |

A `MutationObserver` on `document.body` detects dialogs opening and closing, and exits immediately when no dialog exists.

## What stays with each dialog

- **Escape and clicking the backdrop** close the dialog, handled by each dialog's own `close()`, because only the dialog knows when closing is allowed (not while a request is pending, and with unsaved edits it asks first; see [unsaved changes](../unsaved-changes/implementation.md)). Because focus is trapped inside, `Escape` reaches the dialog.
- **ARIA:** every dialog has `role`, `aria-modal`, and `aria-labelledby` pointing to its title; confirmations also have `aria-describedby`.

## ConfirmDialog

`src/components/ConfirmDialog/` is the reusable confirmation (`role="alertdialog"`), rendered in a portal so a prompt opened from inside another dialog is not clipped. Its Escape and backdrop events stop at the prompt, so they don't also close the dialog underneath.

## Mobile and RTL

Dialogs keep their existing layout. The confirmation uses logical alignment and stacks its buttons full-width (primary last) below 480 px.

## Verified

In a headless browser: focus enters the account dialog on open, the sidebar becomes inert, 14 Tab and 14 Shift+Tab presses never leave the dialog, Escape on a dirty form opens the discard prompt (focus on "Keep editing"), Escape on the prompt keeps the form, Discard closes both, focus returns to the "Add account" button and the inert attributes are removed.
