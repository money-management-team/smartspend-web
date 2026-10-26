import { useRef } from "react";
import { createPortal } from "react-dom";

import { useMobilePortal } from "./portalContext.js";
import { useOverlayFocus } from "./useOverlayFocus.js";

/*
 * A bottom sheet in the Mobile overlay container (role="dialog",
 * aria-modal). Escape, the backdrop and the close button dismiss it; focus
 * enters it, stays inside, and returns to `returnFocusRef` afterwards.
 */
export default function MobileSheet({ open, onClose, titleId, title, returnFocusRef, children }) {
  const container = useMobilePortal();
  const sheetRef = useRef(null);

  useOverlayFocus({ open, containerRef: sheetRef, onClose, returnFocusRef });

  if (!open || !container) return null;

  return createPortal(
    <div className="sm-sheet-layer">
      <div className="sm-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="sm-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={sheetRef}
        tabIndex={-1}
      >
        <h2 id={titleId} className="sm-sheet-title">{title}</h2>
        {children}
      </div>
    </div>,
    container,
  );
}
