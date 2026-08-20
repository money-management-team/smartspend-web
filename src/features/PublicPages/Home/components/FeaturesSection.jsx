import { useTranslation } from "react-i18next";

import {
  LuRefreshCcw,
  LuChartNoAxesCombined,
  LuTarget,
  LuShieldCheck,
  LuBellRing,
  LuUsers,
} from "react-icons/lu";

const features = [
  {
    key: "sync",
    icon: LuRefreshCcw,
  },
  {
    key: "analytics",
    icon: LuChartNoAxesCombined,
  },
  {
    key: "goals",
    icon: LuTarget,
  },
  {
    key: "security",
    icon: LuShieldCheck,
  },
  {
    key: "alerts",
    icon: LuBellRing,
  },
  {
    key: "budgets",
    icon: LuUsers,
  },
];

export default function FeaturesSection() {
  const { t } = useTranslation();

  return (
    <section
      className="home-section features-section"
      id="features"
    >
      <div className="home-container">
        <header className="home-section-header">
          <h2>
            {t("home.features.title")}
          </h2>

          <p>
            {t("home.features.subtitle")}
          </p>
        </header>

        <div className="features-grid">
          {features.map(
            ({
              key,
              icon: Icon,
            }) => (
              <article
                className="feature-card"
                key={key}
              >
                <span className="feature-card__icon">
                  <Icon />
                </span>

                <h3>
                  {t(
                    `home.features.items.${key}.title`,
                  )}
                </h3>

                <p>
                  {t(
                    `home.features.items.${key}.description`,
                  )}
                </p>
              </article>
            ),
          )}
        </div>
      </div>
    </section>
  );
}