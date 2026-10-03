import { useEffect } from "react";

/*
 * Keyboard behavior shared by every custom modal.
 *
 * The app's modals are plain elements (`role="dialog"` / `role="alertdialog"`
 * with `aria-modal="true"`) written per feature, each handling Escape and
 * its own close button. This component adds the part they were missing, once,
 * by watching the document for such a dialog:
 *
 * - focus moves into the dialog when it opens (unless the dialog already
 *   focused something, e.g. through `autoFocus`);
 * - Tab / Shift+Tab wrap inside the topmost dialog;
 * - everything around the dialog becomes `inert`, so the page behind it is
 *   neither focusable nor read by assistive tech;
 * - when the dialog goes away, focus returns to the control that opened it.
 *
 * Native `<dialog>` elements (GlassDialog) already do all of this through
 * `showModal()` and carry no `role`, so they are not matched here. Mount it
 * once, near the app root. It renders nothing.
 */

const DIALOG_SELECTOR =
  '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]';

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const isVisible = (element) =>
  !element.closest("[inert]") && element.getClientRects().length > 0;

const getFocusable = (container) =>
  Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isVisible);

/* Marks everything around `dialog` inert and returns what it marked. */
function makeSurroundingsInert(dialog) {
  const marked = [];
  let node = dialog;

  while (node && node !== document.body) {
    const parent = node.parentElement;
    if (!parent) break;

    Array.from(parent.children).forEach((sibling) => {
      if (sibling !== node && !sibling.inert) {
        sibling.inert = true;
        marked.push(sibling);
      }
    });

    node = parent;
  }

  return marked;
}

function focusInside(dialog) {
  if (dialog.contains(document.activeElement)) return;

  const focusable = getFocusable(dialog);
  const field = focusable.find((element) =>
    element.matches("input, select, textarea"),
  );
  const target =
    field ??
    // Skip the header's close "x" when something more useful exists.
    focusable.find((element) => !element.closest("header")) ??
    focusable[0];

  if (target) {
    target.focus({ preventScroll: true });
  } else {
    dialog.tabIndex = -1;
    dialog.focus({ preventScroll: true });
  }
}

export default function DialogAccessibility() {
  useEffect(() => {
    // Open dialogs, oldest first, each with what we did to it.
    const stack = [];
    let lastTrigger = null;

    const rememberTrigger = (event) => {
      const target =
        event.target instanceof Element
          ? event.target.closest(FOCUSABLE_SELECTOR)
          : null;
      if (target) lastTrigger = target;
    };

    const sync = () => {
      const present = Array.from(document.querySelectorAll(DIALOG_SELECTOR));

      // Closed dialogs: undo, newest first, and give focus back.
      for (let index = stack.length - 1; index >= 0; index--) {
        const entry = stack[index];
        if (present.includes(entry.dialog)) continue;

        stack.splice(index, 1);
        entry.marked.forEach((element) => {
          element.inert = false;
        });

        // Back to the opener: on the page, or inside the dialog underneath.
        const below = stack[stack.length - 1];
        if (
          entry.opener?.isConnected &&
          (!below || below.dialog.contains(entry.opener))
        ) {
          entry.opener.focus({ preventScroll: true });
        }
      }

      // New dialogs.
      present.forEach((dialog) => {
        if (stack.some((entry) => entry.dialog === dialog)) return;

        const opener =
          lastTrigger?.isConnected && !dialog.contains(lastTrigger)
            ? lastTrigger
            : null;
        stack.push({
          dialog,
          opener,
          marked: makeSurroundingsInert(dialog),
        });
        focusInside(dialog);
      });
    };

    const handleKeyDown = (event) => {
      if (event.key !== "Tab" || stack.length === 0) return;

      const { dialog } = stack[stack.length - 1];
      const focusable = getFocusable(dialog);

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (!dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("pointerdown", rememberTrigger, true);
    document.addEventListener("focusin", rememberTrigger, true);
    document.addEventListener("keydown", handleKeyDown, true);
    sync();

    return () => {
      observer.disconnect();
      document.removeEventListener("pointerdown", rememberTrigger, true);
      document.removeEventListener("focusin", rememberTrigger, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      stack.forEach((entry) =>
        entry.marked.forEach((element) => {
          element.inert = false;
        }),
      );
    };
  }, []);

  return null;
}
