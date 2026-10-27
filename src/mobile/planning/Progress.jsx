import { useTranslation } from "react-i18next";

import { MOBILE_NAMESPACE } from "../i18n/messages.js";

/*
 * A progress bar for a percentage the backend calculated (models/planning.js
 * parsePercent): the track and fill are decoration (hidden from assistive
 * technology), the percentage is real text, and `spoken` says it in words
 * ("40 percent of the limit used"). No percentage means no bar, and the line
 * says progress is not available; it never draws an empty bar that reads as
 * "nothing yet".
 */
export default function Progress({ percent, spoken, tone = "neutral" }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);

  if (!percent) return <p className="sm-text sm-muted sm-fine" data-sm-progress="unavailable">{t("planning.progressUnavailable")}</p>;

  return (
    <div className="sm-progress" data-sm-tone={tone} data-sm-full={percent.full ? "true" : undefined}>
      <span className="sm-progress-track" aria-hidden="true">
        <span className="sm-progress-fill" style={{ inlineSize: percent.bar }} />
      </span>
      <bdi dir="ltr" className="sm-progress-text" aria-hidden="true">{percent.text}%</bdi>
      <span className="sm-sr">{spoken}</span>
    </div>
  );
}
