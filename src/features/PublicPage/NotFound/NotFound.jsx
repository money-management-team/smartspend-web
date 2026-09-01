import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { LuArrowLeft, LuHouse } from "react-icons/lu";

import "./NotFound.css";

export default function NotFound() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${t("home.notFound.title")} | Smart Spend`;

    return () => {
      document.title = previousTitle;
    };
  }, [t]);

  return (
    <main className="not-found-page">
      <div className="not-found-page__background" aria-hidden="true">
        <span className="not-found-circle not-found-circle--one" />
        <span className="not-found-circle not-found-circle--two" />
        <span className="not-found-circle not-found-circle--three" />
        <span className="not-found-circle not-found-circle--four" />
        <span className="not-found-orbit">
          <span />
        </span>
      </div>

      <section className="not-found-page__content">
        <div className="not-found-page__code" aria-label="404">
          <span>4</span>
          <span className="not-found-page__zero">
            <span className="not-found-page__zero-core" />
          </span>
          <span>4</span>
        </div>

        <p className="not-found-page__eyebrow">
          {t("home.notFound.eyebrow")}
        </p>

        <h1>{t("home.notFound.title")}</h1>

        <p className="not-found-page__description">
          {t("home.notFound.description")}
        </p>

        <div className="not-found-page__actions">
          <Link to="/" className="home-primary-button not-found-page__home">
            <LuHouse aria-hidden="true" />
            {t("home.notFound.home")}
          </Link>

          <button
            type="button"
            className="not-found-page__back"
            onClick={() => navigate(-1)}
          >
            <LuArrowLeft aria-hidden="true" />
            {t("home.notFound.back")}
          </button>
        </div>
      </section>
    </main>
  );
}
