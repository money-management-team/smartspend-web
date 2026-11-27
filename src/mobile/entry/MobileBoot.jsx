import { useTranslation } from "react-i18next";

/*
 * What a Mobile visitor sees while the Mobile chunk downloads. It exists only
 * on a Mobile URL (or on the way to one), never on a Desktop page, and it is
 * plain on purpose: no figures, no account names, nothing private.
 */
export default function MobileBoot() {
  const { t } = useTranslation();

  return (
    <div className="sm-root sm-boot" role="status" aria-live="polite" aria-busy="true">
      <span className="sm-boot-spinner" aria-hidden="true" />
      <span className="sm-boot-text">{t("common.loading")}</span>
    </div>
  );
}
