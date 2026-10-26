import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export const getFocusable = (container) => [...container.querySelectorAll(FOCUSABLE)];

/*
 * Keyboard behaviour of an open overlay (a sheet or the compact menu):
 * - focus moves into it when it opens;
 * - Tab and Shift+Tab stay inside it;
 * - Escape closes it;
 * - when it closes, focus goes back to the control that opened it.
 *
 * The page behind is made inert by the shell, so a screen reader and a click
 * cannot reach it either.
 *
 * `returnFocusRef` names the opener explicitly: Safari does not focus a
 * button on click, so document.activeElement alone is not a safe memory.
 */
export function useOverlayFocus({ open, containerRef, onClose, returnFocusRef }) {
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;

    const container = containerRef.current;
    const opener = returnFocusRef?.current ?? document.activeElement;

    const first = container?.querySelector("[data-sm-autofocus]") ?? (container ? getFocusable(container)[0] : null);
    (first ?? container)?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current?.();
        return;
      }

      if (event.key !== "Tab" || !container) return;

      const items = getFocusable(container);
      if (items.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === firstItem || !container.contains(active))) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && (active === lastItem || !container.contains(active))) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (opener?.isConnected && typeof opener.focus === "function") opener.focus();
    };
  }, [open, containerRef, returnFocusRef]);
}
