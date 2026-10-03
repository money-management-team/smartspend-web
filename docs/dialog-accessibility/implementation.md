# Dialog accessibility

The app's modals are per-feature elements (`role="dialog"` / `"alertdialog"`, `aria-modal="true"`) that each handle Escape and their close button. `components/DialogAccessibility/DialogAccessibility.jsx` (mounted once in `App.jsx`) adds the shared keyboard behavior without rewriting them. It watches the document (`MutationObserver`) and, for each such dialog:

- moves focus inside when it opens, unless the dialog already focused something (e.g. `autoFocus`). Preference: first form field, then the first control outside the header, then the dialog itself;
- keeps Tab and Shift+Tab inside the topmost dialog;
- marks everything around the dialog `inert` (siblings of its ancestors) and restores it on close, so the page behind is neither focusable nor announced;
- on close, returns focus to the control that opened it (the last pointer/focus target before the dialog appeared). For a nested dialog, focus returns inside the dialog underneath.

`GlassDialog` (policy dialogs) is a native `<dialog>` using `showModal()`, which already does all of this, and has no `role`, so it is not matched.

Escape and the destructive-confirmation logic stay in each dialog (for example, a pending request blocks closing).
