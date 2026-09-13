import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuChevronDown, LuSparkles } from "react-icons/lu";

const questions = ["security", "categories", "multipleAccounts", "freePlan", "aiAnalysis", "arabic"];

export default function FAQSection() {
  const { t } = useTranslation();
  const [openItem, setOpenItem] = useState(0);

  return (
    <section className="home-section faq-section" id="faq">
      <div className="home-container faq-section__grid">
        <div className="faq-section__intro">
          <span className="home-section-eyebrow"><LuSparkles /> {t("home.faq.eyebrow")}</span>
          <h2>{t("home.faq.title")}</h2>
          <p>{t("home.faq.subtitle")}</p>
          <div className="faq-section__note">{t("home.faq.note")}</div>
        </div>

        <div className="faq-list">
          {questions.map((key, index) => (
            <article className={`faq-item ${openItem === index ? "faq-item--open" : ""}`} key={key}>
              <button
                type="button"
                aria-expanded={openItem === index}
                aria-controls={`faq-answer-${key}`}
                onClick={() => setOpenItem(openItem === index ? null : index)}
              >
                <span>{t(`home.faq.items.${key}.question`)}</span>
                <span className="faq-item__chevron"><LuChevronDown /></span>
              </button>

              <div className="faq-item__answer-wrap" data-open={openItem === index}>
                <div className="faq-item__answer" id={`faq-answer-${key}`}>
                  {t(`home.faq.items.${key}.answer`)}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
