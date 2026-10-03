import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useBlocker } from "react-router-dom";

/*
 * Warns before unsaved form changes are lost.
 *
 * While `isDirty` is true:
 * - closing or reloading the tab shows the browser's own prompt
 *   (`beforeunload`; browsers ignore custom text there);
 * - moving to another page inside the app asks for confirmation. Changing
 *   only the query string or hash of the same page is not a "leave".
 *
 * It returns:
 * - `confirmDiscard()`, for closing a modal or cancelling a form by hand:
 *   `true` when there is nothing to lose or the user agrees to discard;
 * - `markSaved()`, to call right after a successful save. From then on
 *   nothing prompts, even if the page navigates in the same tick, before the
 *   form has re-rendered as clean.
 *
 * For a form that stays on screen after saving, make `isDirty` false by
 * comparing it with the saved values instead.
 * Needs a data router (see main.jsx).
 */
export function useUnsavedChanges(isDirty) {
  const { t } = useTranslation();
  const message = t("common.unsavedChanges.message");
  const savedRef = useRef(false);

  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) =>
        isDirty &&
        !savedRef.current &&
        currentLocation.pathname !== nextLocation.pathname,
      [isDirty],
    ),
  );

  useEffect(() => {
    if (blocker.state !== "blocked") return;

    if (window.confirm(message)) blocker.proceed();
    else blocker.reset();
  }, [blocker, message]);

  useEffect(() => {
    if (!isDirty) return undefined;

    const handleBeforeUnload = (event) => {
      if (savedRef.current) return;
      event.preventDefault();
      // Required by older browsers to show the prompt.
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const confirmDiscard = useCallback(
    () => !isDirty || savedRef.current || window.confirm(message),
    [isDirty, message],
  );
  const markSaved = useCallback(() => {
    savedRef.current = true;
  }, []);

  return { confirmDiscard, markSaved };
}
