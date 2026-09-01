import { useTranslation } from "react-i18next";

import {
  LuLockKeyhole,
  LuDatabase,
  LuEyeOff,
  LuActivity,
  LuShieldCheck,
} from "react-icons/lu";

const securityItems = [
  {
    key: "connections",
    icon: LuLockKeyhole,
  },
  {
    key: "storage",
    icon: LuDatabase,
  },
  {
    key: "privacy",
    icon: LuEyeOff,
  },
  {
    key: "monitoring",
    icon: LuActivity,
  },
];

export default function SecuritySection() {
  const { t } = useTranslation();

  return (
    <section
      className="home-section security-section"
      id="security"
    >
      <div className="home-container security-section__grid">
        <div className="security-section__content">
          <span className="home-badge home-badge--green">
            <LuShieldCheck />

            {t("home.security.badge")}
          </span>

          <h2>
            {t("home.security.title")}
          </h2>

          <p>
            {t("home.security.subtitle")}
          </p>
        </div>

        <div className="security-grid">
          {securityItems.map(
            ({
              key,
              icon: Icon,
            }) => (
              <article
                className="security-card"
                key={key}
              >
                <span>
                  <Icon />
                </span>

                <h3>
                  {t(
                    `home.security.items.${key}.title`,
                  )}
                </h3>

                <p>
                  {t(
                    `home.security.items.${key}.description`,
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