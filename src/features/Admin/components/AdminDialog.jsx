import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FiX } from "react-icons/fi";

export default function AdminDialog({ detail, onClose }) {
  const ref = useRef(null);
  const { t } = useTranslation();
  useEffect(() => {
    if (detail) ref.current.showModal();
    else ref.current.close();
  }, [detail]);

  return (
    <dialog ref={ref} className="admin-dialog" aria-labelledby="admin-dialog-title" onClose={onClose}
      onClick={(event) => { if (event.target === ref.current) onClose(); }}>
      <div className="admin-dialog__head">
        <h2 id="admin-dialog-title">{detail && t(`admin.${detail.title}`)}</h2>
        <button className="admin-icon-button" aria-label={t("admin.close")} onClick={onClose}><FiX /></button>
      </div>
      <p>{detail && t(`admin.${detail.body}`)}</p>
      <div className="admin-preview-note">{t("admin.demoOnly")}</div>
    </dialog>
  );
}
