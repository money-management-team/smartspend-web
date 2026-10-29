import { useEffect } from "react";

/**
 * Pointer spotlight for double-bezel cards. One delegated, passive listener,
 * throttled to animation frames; it only writes two custom properties on the
 * card under the pointer. Skipped on touch screens and when motion is off.
 */
export function useSpotlight() {
  useEffect(() => {
    const fine = window.matchMedia?.("(hover: hover) and (pointer: fine)");
    if (!fine?.matches) return undefined;
    let frame = 0;
    let last = null;
    const paint = () => {
      frame = 0;
      if (!last || document.documentElement.dataset.motion === "off") return;
      const card = last.target?.closest?.(".smartspend-landing .bezel");
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${last.clientX - rect.left}px`);
      card.style.setProperty("--my", `${last.clientY - rect.top}px`);
    };
    const move = (event) => {
      last = event;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    document.addEventListener("pointermove", move, { passive: true });
    return () => {
      document.removeEventListener("pointermove", move);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
}
