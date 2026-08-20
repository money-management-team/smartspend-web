import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  LuChevronDown,
} from "react-icons/lu";

const questions = [
  "security",
  "categories",
  "multipleAccounts",
  "freePlan",
  "aiAnalysis",
  "arabic",
];

export default function FAQSection() {
  const { t } = useTranslation();

  const [openItem, setOpenItem] =
    useState(0);

  return (
    <section
      className="home-section faq-section"
      id="faq"
    >
      <div className="home-container faq-section__container">
        <header className="home-section-header">
          <h2>
            {t("home.faq.title")}
          </h2>

          <p>
            {t("home.faq.subtitle")}
          </p>
        </header>

        <div className="faq-list">
          {questions.map(
            (key, index) => (
              <article
                className={`faq-item ${
                  openItem === index
                    ? "faq-item--open"
                    : ""
                }`}
                key={key}
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenItem(
                      openItem ===
                        index
                        ? null
                        : index,
                    )
                  }
                >
                  <span>
                    {t(
                      `home.faq.items.${key}.question`,
                    )}
                  </span>

                  <LuChevronDown />
                </button>

                {openItem === index && (
                  <div className="faq-item__answer">
                    {t(
                      `home.faq.items.${key}.answer`,
                    )}
                  </div>
                )}
              </article>
            ),
          )}
        </div>
      </div>
    </section>
  );
}