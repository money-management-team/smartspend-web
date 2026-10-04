import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useBlocker } from "react-router-dom";

import ConfirmDialog from "../ConfirmDialog/ConfirmDialog";

/*
 * Warns before unsaved edits are lost by leaving the page.
 *
 * - In-app navigation to another page is held and the user is asked first
 *   (react-router's useBlocker). Changing only the query string or hash of the
 *   same page, such as a filter, never asks.
 * - Closing or reloading the tab uses the browser's own beforeunload prompt.
 *
 * Render it while a form is mounted and pass `when`: true only for real
 * unsaved changes and never while the form is saving (a submit in flight is
 * not interrupted). A successful save makes the form clean again, so the
 * guard goes quiet without any extra bookkeeping.
 */
export default function UnsavedChangesGuard({ when }) {
  const { t } = useTranslation();

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!when) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      // Required by older browsers to show the prompt.
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [when]);

  if (blocker.state !== "blocked") return null;

  return (
    <ConfirmDialog
      title={t("common.unsavedChanges.title")}
      message={t("common.unsavedChanges.message")}
      confirmLabel={t("common.unsavedChanges.leave")}
      cancelLabel={t("common.unsavedChanges.stay")}
      onConfirm={() => blocker.proceed()}
      onCancel={() => blocker.reset()}
    />
  );
}
