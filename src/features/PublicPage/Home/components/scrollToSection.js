/*
 * Scrolls to a section of the home page and moves keyboard focus into it, so
 * a button that points at a section works for keyboard and screen-reader
 * users too, not only with the mouse. Smooth scrolling is skipped when the
 * user prefers reduced motion.
 */
export function scrollToSection(id) {
  const target = document.getElementById(id);
  if (!target) return;

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  target.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "start",
  });
  target.focus({ preventScroll: true });
}
