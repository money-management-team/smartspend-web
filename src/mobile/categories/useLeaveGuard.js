import { useCallback, useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";

import { markPresentationBusy } from "../presentation/guard.js";

/*
 * Holds every in-app navigation away from a form page while `active` (unsaved
 * edits, or a request on its way): the bottom bar, the compact menu, any link,
 * Back links, the browser's Back and Forward, a keyboard-activated link, the
 * form's own Cancel. It is React Router's own blocker (the app runs on a data
 * router created at the app's entry), not a history interception of our own.
 *
 * - Only a change of page is held; the query or hash of the same page never is.
 * - The held navigation is the router's; `proceed` continues to exactly where the
 *   person was going, `reset` forgets it. A decision is taken once: a second tap
 *   on either button does nothing.
 * - While active, the automatic presentation switch (another tab choosing the
 *   full version, for instance) waits: it registers with the presentation guard.
 * - Reload, closing the tab and the OS ending the browser cannot show this dialog;
 *   for the first two the browser's own `beforeunload` prompt is armed (best
 *   effort: browsers decide whether to show it), for the third nothing can be done.
 */
export function useLeaveGuard(active) {
  const blocker = useBlocker(useCallback(({ currentLocation, nextLocation }) => active && currentLocation.pathname !== nextLocation.pathname, [active]));
  const decided = useRef(false);

  useEffect(() => {
    if (blocker.state === "blocked") decided.current = false;
  }, [blocker.state]);

  // The reason for holding ended while the question was open (the request just finished): the question is
  // withdrawn and the person stays, so they see the outcome instead of being moved on without it.
  useEffect(() => {
    if (!active && blocker.state === "blocked") blocker.reset();
  }, [active, blocker]);

  useEffect(() => {
    if (!active) return undefined;
    return markPresentationBusy();
  }, [active]);

  useEffect(() => {
    if (!active) return undefined;

    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);

  const once = (action) => () => {
    if (decided.current || blocker.state !== "blocked") return;
    decided.current = true;
    action();
  };

  return {
    blocked: blocker.state === "blocked",
    leave: once(() => blocker.proceed()),
    stay: once(() => blocker.reset()),
  };
}
