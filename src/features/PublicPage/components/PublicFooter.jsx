import { useTranslation } from "react-i18next";

import logo from "../../../assets/smart-spend-logo.png";

import "./PublicChrome.css";

export default function PublicFooter() {
  const { t } = useTranslation();

  return (
    <>
      <footer className="home-footer">
        <div className="home-container home-footer__grid">
          <div className="home-footer__brand">
            <div>
              <img src={logo} alt="Smart Spend" />

              <strong>Smart Spend</strong>
            </div>

            <p>{t("home.footer.description")}</p>
          </div>

          <FooterGroup
            title={t("home.footer.product")}
            items={[
              t("home.footer.links.features"),
              t("home.footer.links.pricing"),
              t("home.footer.links.security"),
              t("home.footer.links.dashboard"),
            ]}
          />

          <FooterGroup
            title={t("home.footer.company")}
            items={[
              t("home.footer.links.about"),
              t("home.footer.links.contact"),
              t("home.footer.links.support"),
            ]}
          />

          <FooterGroup
            title={t("home.footer.legal")}
            items={[
              t("home.footer.links.terms"),
              t("home.footer.links.privacy"),
            ]}
          />
        </div>

        <div className="home-footer__copyright">
          © 2026 Smart Spend.
          {` `}
          {t("home.footer.rights")}
        </div>
      </footer>
    </>
  );
}

function FooterGroup({ title, items }) {
  return (
    <div className="home-footer__group">
      <strong>{title}</strong>

      {items.map((item) => (
        <a href="#" key={item}>
          {item}
        </a>
      ))}
    </div>
  );
}
