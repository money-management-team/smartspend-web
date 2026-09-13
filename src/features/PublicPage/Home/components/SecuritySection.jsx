import { useTranslation } from "react-i18next";
import {
  LuActivity,
  LuDatabase,
  LuEyeOff,
  LuLockKeyhole,
  LuShieldCheck,
} from "react-icons/lu";

const securityItems = [
  { key: "connections", icon: LuLockKeyhole },
  { key: "storage", icon: LuDatabase },
  { key: "privacy", icon: LuEyeOff },
  { key: "monitoring", icon: LuActivity },
];

export default function SecuritySection() {
  const { t } = useTranslation();

  return (
    <section className="home-section security-section" id="security">
      <div className="home-container security-section__grid">
        <div className="security-section__content">
          <span className="home-badge home-badge--green">
            <LuShieldCheck />
            {t("home.security.badge")}
          </span>
          <h2>{t("home.security.title")}</h2>
          <p>{t("home.security.subtitle")}</p>

          <div className="security-visual" aria-hidden="true">
            <div className="security-visual__rings">
              <span className="security-visual__ring security-visual__ring--one" />
              <span className="security-visual__ring security-visual__ring--two" />
              <span className="security-visual__ring security-visual__ring--three" />
              <span className="security-visual__shield"><LuShieldCheck /></span>
            </div>
            <div className="security-visual__status">
              <span className="security-visual__status-dot" />
              <div><strong>{t("home.security.statusTitle")}</strong><small>{t("home.security.statusText")}</small></div>
            </div>
          </div>
        </div>

        <div className="security-grid">
          {securityItems.map(({ key, icon: Icon }) => (
            <article className="security-card" key={key}>
              <span className="security-card__icon"><Icon /></span>
              <div>
                <h3>{t(`home.security.items.${key}.title`)}</h3>
                <p>{t(`home.security.items.${key}.description`)}</p>
              </div>
              <span className="security-card__check">✓</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
