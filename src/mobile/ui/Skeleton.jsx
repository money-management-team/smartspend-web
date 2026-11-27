import { useTranslation } from "react-i18next";

import { MOBILE_NAMESPACE } from "../i18n/messages.js";

/* Grey placeholder lines while a first read runs: no numbers, and announced once as "Loading". */
export default function Skeleton({ lines = 3, label }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);

  return (
    <div className="sm-skeleton" role="status" aria-busy="true" aria-live="polite">
      <span className="sm-sr">{label ?? t("loading")}</span>
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} className={`sm-skeleton-line${index === 0 ? " sm-skeleton-first" : ""}`} aria-hidden="true" />
      ))}
    </div>
  );
}
