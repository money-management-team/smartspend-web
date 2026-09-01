import { useTranslation } from "react-i18next";

import { LuUserRoundPlus, LuLink, LuWalletCards } from "react-icons/lu";

const steps = [
  {
    key: "account",
    icon: LuUserRoundPlus,
  },
  {
    key: "connect",
    icon: LuLink,
  },
  {
    key: "control",
    icon: LuWalletCards,
  },
];

export default function StepsSection() {
  const { t } = useTranslation();

  return (
    <section className="home-section steps-section" id="how-it-works">
      <div className="home-container">
        <header className="home-section-header">
          <h2>{t("home.steps.title")}</h2>

          <p>{t("home.steps.subtitle")}</p>
        </header>

        <div className="steps-grid">
          {steps.map(({ key, icon: Icon }, index) => (
            <article className="step-card" key={key}>
              <span className="step-card__number">{index + 1}</span>

              <span className="step-card__icon">
                <Icon />
              </span>

              <h3>{t(`home.steps.items.${key}.title`)}</h3>

              <p>{t(`home.steps.items.${key}.description`)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
