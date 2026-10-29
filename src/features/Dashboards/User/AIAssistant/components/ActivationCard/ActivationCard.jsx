import { useTranslation } from "react-i18next";
import {
  LuArrowRight,
  LuChartNoAxesCombined,
  LuCircleCheck,
  LuLightbulb,
  LuMessagesSquare,
  LuShieldCheck,
} from "react-icons/lu";

import "./ActivationCard.css";

const x = "dashboard.aiAssistant.extra";
const FEATURES = [
  { key: "chat", icon: LuMessagesSquare },
  { key: "insights", icon: LuLightbulb },
  { key: "forecast", icon: LuChartNoAxesCombined },
];

/*
 * Shown until the user consents. Explains what enabling does, what it
 * unlocks, and that it can be undone; enabling calls PUT /ai/settings.
 */
export default function ActivationCard({ busy, onEnable, onReviewSettings }) {
  const { t } = useTranslation();

  return (
    <section className="ai-activation" aria-labelledby="ai-activation-title">
      <div className="ai-activation__main">
        <span className="ai-activation__icon" aria-hidden="true">
          <LuShieldCheck />
        </span>

        <p className="ai-activation__label">{t(`${x}.privateLabel`)}</p>
        <h2 id="ai-activation-title">{t(`${x}.activationTitle`)}</h2>
        <p className="ai-activation__description">{t(`${x}.activationDescription`)}</p>

        <ul className="ai-activation__points">
          {["activationPointOne", "activationPointTwo"].map((key) => (
            <li key={key}>
              <LuCircleCheck aria-hidden="true" />
              <span>{t(`${x}.${key}`)}</span>
            </li>
          ))}
        </ul>

        <div className="ai-activation__actions">
          <button type="button" className="ai-button ai-button--primary" disabled={busy} onClick={onEnable}>
            <span>{busy ? t(`${x}.activating`) : t(`${x}.activate`)}</span>
            <LuArrowRight aria-hidden="true" className="ai-activation__arrow" />
          </button>
          <button type="button" className="ai-button ai-button--secondary" onClick={onReviewSettings}>
            {t(`${x}.reviewSettings`)}
          </button>
        </div>

        <small className="ai-activation__disclosure">{t(`${x}.consentDisclosure`)}</small>
      </div>

      <ul className="ai-activation__features" aria-label={t(`${x}.featuresTitle`)}>
        {FEATURES.map(({ key, icon: Icon }) => (
          <li key={key}>
            <span className="ai-activation__feature-icon" aria-hidden="true">
              <Icon />
            </span>
            <span>
              <strong>{t(`${x}.${key}`)}</strong>
              <small>{t(`${x}.${key}Feature`)}</small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
