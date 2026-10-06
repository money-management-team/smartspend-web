/*
 * One place that gives every modal dialog the same keyboard behaviour, so each
 * dialog component doesn't have to repeat it (and get it slightly different).
 *
 * A "modal" is any element with role="dialog" + aria-modal="true" or
 * role="alertdialog" (the project's dialogs all render this way). Native
 * <dialog> elements opened with showModal() already do all of this themselves
 * and are not touched.
 *
 * For the top-most open modal the manager:
 *   - moves focus into it when it opens (unless a control inside it already
 *     took focus, e.g. through autoFocus);
 *   - keeps Tab / Shift+Tab inside it;
 *   - marks everything outside it `inert`, so the page behind can't be reached
 *     with the keyboard, a screen reader or a click;
 *   - gives focus back to the control that opened it once it closes.
 * Escape and backdrop clicks stay with each dialog, because only the dialog
 * knows when closing is allowed (for example, not while a request is pending).
 * Nested modals work as a stack: the newest is active, and when it closes the
 * previous one becomes active again.
 */

export const MODAL_SELECTOR =
  '[role="dialog"][aria-modal="true"], [role="alertdialog"]';

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(",");

const NEVER_INERT = new Set(["SCRIPT", "STYLE", "LINK", "TEMPLATE", "NOSCRIPT"]);

const isVisible = (element) =>
  element.getClientRects().length > 0 &&
  getComputedStyle(element).visibility !== "hidden";

export const getFocusable = (container) =>
  Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.closest("[inert]") && isVisible(element),
  );

export function startModalManager(doc = document) {
  const stack = []; // [{ element, opener }], oldest first
  const inerted = new Set();
  let lastOutsideFocus = null;

  const isInsideModal = (node) =>
    node instanceof Element && node.closest(MODAL_SELECTOR) !== null;

  const clearInert = () => {
    inerted.forEach((element) => {
      element.inert = false;
    });
    inerted.clear();
  };

  // Everything that isn't the active modal or one of its ancestors is inert.
  const applyInert = (modal) => {
    clearInert();
    if (!modal) return;

    for (let node = modal; node && node !== doc.body; node = node.parentElement) {
      const parent = node.parentElement;
      if (!parent) break;

      for (const sibling of parent.children) {
        if (
          sibling === node ||
          sibling.inert ||
          NEVER_INERT.has(sibling.tagName) ||
          sibling.hasAttribute("data-modal-ignore")
        ) {
          continue;
        }
        sibling.inert = true;
        inerted.add(sibling);
      }
    }
  };

  const focusInto = (modal) => {
    if (modal.contains(doc.activeElement)) return;

    const target =
      modal.querySelector("[autofocus], [data-autofocus]") ??
      getFocusable(modal)[0];

    if (target) {
      target.focus({ preventScroll: true });
    } else {
      modal.tabIndex = -1;
      modal.focus({ preventScroll: true });
    }
  };

  const restoreFocus = (opener) => {
    const active = doc.activeElement;
    const focusIsLost = !active || active === doc.body || !active.isConnected;

    if (
      focusIsLost &&
      opener?.isConnected &&
      !opener.closest("[inert]") &&
      typeof opener.focus === "function"
    ) {
      opener.focus({ preventScroll: true });
    }
  };

  const sync = () => {
    // Most DOM changes have nothing to do with dialogs: bail out cheaply.
    if (stack.length === 0 && !doc.querySelector(MODAL_SELECTOR)) return;

    const open = Array.from(doc.querySelectorAll(MODAL_SELECTOR));
    let changed = false;

    // Closed since last time: drop them, remembering the newest opener.
    let openerToRestore = null;
    for (let index = stack.length - 1; index >= 0; index -= 1) {
      if (!open.includes(stack[index].element)) {
        openerToRestore = stack[index].opener ?? openerToRestore;
        stack.splice(index, 1);
        changed = true;
      }
    }

    // Opened since last time (in document order, so the newest is last).
    for (const element of open) {
      if (!stack.some((entry) => entry.element === element)) {
        stack.push({ element, opener: lastOutsideFocus });
        changed = true;
      }
    }

    if (!changed) return;

    const top = stack.at(-1)?.element ?? null;
    applyInert(top);

    if (top) focusInto(top);
    else restoreFocus(openerToRestore);
  };

  const handleFocusIn = (event) => {
    if (!isInsideModal(event.target)) lastOutsideFocus = event.target;
  };

  const handleKeyDown = (event) => {
    if (event.key !== "Tab" || stack.length === 0) return;

    const modal = stack.at(-1).element;
    const focusable = getFocusable(modal);

    if (focusable.length === 0) {
      event.preventDefault();
      modal.focus({ preventScroll: true });
      return;
    }

    const first = focusable[0];
    const last = focusable.at(-1);
    const active = doc.activeElement;
    const isInside = modal.contains(active);

    if (event.shiftKey && (active === first || !isInside)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !isInside)) {
      event.preventDefault();
      first.focus();
    }
  };

  const observer = new MutationObserver(sync);
  observer.observe(doc.body, { childList: true, subtree: true });
  doc.addEventListener("focusin", handleFocusIn, true);
  doc.addEventListener("keydown", handleKeyDown, true);
  sync();

  return () => {
    observer.disconnect();
    doc.removeEventListener("focusin", handleFocusIn, true);
    doc.removeEventListener("keydown", handleKeyDown, true);
    clearInert();
    stack.length = 0;
  };
}
