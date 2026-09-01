import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import logo from "../../../assets/smart-spend-logo.png";

import "./PublicChrome.css";

export default function PublicFooter() {
  const { t } = useTranslation();

  return (
    <>
      <section className="home-cta-section">
        <div className="home-container">
          <div className="home-cta">
            <h2>
              {t("home.cta.title")}
            </h2>

            <p>
              {t("home.cta.subtitle")}
            </p>

            <div className="home-cta__actions">
              <Link
                to="/register"
                className="home-cta__primary"
              >
                {t("home.cta.signup")}
              </Link>

              <button
                type="button"
                className="home-cta__secondary"
              >
                {t("home.cta.sales")}
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-container home-footer__grid">
          <div className="home-footer__brand">
            <div>
              <img
                src={logo}
                alt="Smart Spend"
              />

              <strong>
                Smart Spend
              </strong>
            </div>

            <p>
              {t(
                "home.footer.description",
              )}
            </p>
          </div>

          <FooterGroup
            title={t(
              "home.footer.product",
            )}
            items={[
              t(
                "home.footer.links.features",
              ),
              t(
                "home.footer.links.pricing",
              ),
              t(
                "home.footer.links.security",
              ),
              t(
                "home.footer.links.dashboard",
              ),
            ]}
          />

          <FooterGroup
            title={t(
              "home.footer.company",
            )}
            items={[
              t(
                "home.footer.links.about",
              ),
              t(
                "home.footer.links.contact",
              ),
              t(
                "home.footer.links.support",
              ),
            ]}
          />

          <FooterGroup
            title={t(
              "home.footer.legal",
            )}
            items={[
              t(
                "home.footer.links.terms",
              ),
              t(
                "home.footer.links.privacy",
              ),
            ]}
          />
        </div>

        <div className="home-footer__copyright">
          © 2026 Smart Spend.
          {` `}
          {t(
            "home.footer.rights",
          )}
        </div>
      </footer>
    </>
  );
}

function FooterGroup({
  title,
  items,
}) {
  return (
    <div className="home-footer__group">
      <strong>
        {title}
      </strong>

      {items.map((item) => (
        <a
          href="#"
          key={item}
        >
          {item}
        </a>
      ))}
    </div>
  );
}
