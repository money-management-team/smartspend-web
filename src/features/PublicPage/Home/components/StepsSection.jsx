import { useTranslation } from "react-i18next";
import { LuLink, LuUserRoundPlus, LuWalletCards } from "react-icons/lu";

const steps = [
  { key: "account", icon: LuUserRoundPlus },
  { key: "connect", icon: LuLink },
  { key: "control", icon: LuWalletCards },
];

export default function StepsSection() {
  const { t } = useTranslation();

  return (
    <section className="home-section steps-section" id="how-it-works">
      <div className="home-container">
        <header className="home-section-header">
          <span className="home-section-eyebrow">{t("home.steps.eyebrow")}</span>
          <h2>{t("home.steps.title")}</h2>
          <p>{t("home.steps.subtitle")}</p>
        </header>

        <div className="steps-shell">
          <div className="steps-shell__line" aria-hidden="true" />
          <div className="steps-grid">
            {steps.map(({ key, icon: Icon }, index) => (
              <article className="step-card" key={key}>
                <div className="step-card__top">
                  <span className="step-card__number">0{index + 1}</span>
                  <span className="step-card__icon"><Icon /></span>
                </div>
                <h3>{t(`home.steps.items.${key}.title`)}</h3>
                <p>{t(`home.steps.items.${key}.description`)}</p>
                <span className="step-card__arrow" aria-hidden="true">→</span>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
