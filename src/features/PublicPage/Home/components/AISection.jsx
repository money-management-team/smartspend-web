import { useTranslation } from "react-i18next";

import {
  LuSparkles,
} from "react-icons/lu";

export default function AISection() {
  const { t } = useTranslation();

  return (
    <section className="home-section ai-home-section">
      <div className="home-container ai-home-section__grid">
        <div className="ai-home-section__content">
          <span className="home-badge home-badge--purple">
            <LuSparkles />

            {t("home.ai.badge")}
          </span>

          <h2>
            {t("home.ai.title")}
          </h2>

          <p>
            {t("home.ai.description")}
          </p>

          <div className="ai-home-section__buttons">
            <button
              type="button"
              className="ai-primary-button"
            >
              {t("home.ai.primary")}
            </button>

            <button
              type="button"
              className="home-secondary-button"
            >
              {t("home.ai.secondary")}
            </button>
          </div>
        </div>

        <div className="ai-insight-card">
          <div className="ai-insight-card__header">
            <span>
              <LuSparkles />
            </span>

            <p>
              {t("home.ai.cardTitle")}
            </p>
          </div>

          <div className="ai-insight-card__recommendation">
            <small>
              {t("home.ai.recommendation")}
            </small>

            <p>
              {t(
                "home.ai.recommendationText",
              )}
            </p>
          </div>

          <div className="ai-insight-card__numbers">
            <div>
              <strong>-18%</strong>
              <small>Dining</small>
            </div>

            <div>
              <strong>-4%</strong>
              <small>Transport</small>
            </div>

            <div>
              <strong>+2%</strong>
              <small>Groceries</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
