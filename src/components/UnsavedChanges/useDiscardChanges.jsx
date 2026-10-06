import { useState } from "react";
import { useTranslation } from "react-i18next";

import ConfirmDialog from "../ConfirmDialog/ConfirmDialog";

/*
 * For forms shown in a dialog: closing (the X, Cancel, Escape or a click
 * outside) with unsaved edits asks before discarding them.
 *
 *   const { requestClose, discardDialog } = useDiscardChanges({ isDirty, onClose });
 *   ...
 *   <button onClick={requestClose}>...</button>
 *   {discardDialog}
 *
 * `onClose` is the form's existing close handler, including its own guard
 * against closing while a request is pending. A clean form closes at once.
 */
export default function useDiscardChanges({ isDirty, onClose }) {
  const { t } = useTranslation();
  const [isAsking, setIsAsking] = useState(false);

  const requestClose = () => {
    if (isDirty) setIsAsking(true);
    else onClose();
  };

  const discardDialog = isAsking ? (
    <ConfirmDialog
      title={t("common.unsavedChanges.title")}
      message={t("common.unsavedChanges.discardMessage")}
      confirmLabel={t("common.unsavedChanges.discard")}
      cancelLabel={t("common.unsavedChanges.keepEditing")}
      onConfirm={() => {
        setIsAsking(false);
        onClose();
      }}
      onCancel={() => setIsAsking(false)}
    />
  ) : null;

  return { requestClose, discardDialog };
}
