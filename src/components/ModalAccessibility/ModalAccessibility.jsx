import { useEffect } from "react";

import { startModalManager } from "./modalManager";

/*
 * Mount once inside an area whose dialogs should behave as modals (the
 * dashboard layout). Renders nothing; see modalManager.js for the behaviour.
 */
export default function ModalAccessibility() {
  useEffect(() => startModalManager(document), []);

  return null;
}
