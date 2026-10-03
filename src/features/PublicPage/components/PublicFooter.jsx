import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import logo from "../../../assets/smart-spend-logo.png";
import { PATH } from "../../../routes/Path";
import "./PublicChrome.css";

export default function PublicFooter() {
  const { t } = useTranslation();
  return (
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
            {
              label: t("home.footer.links.features"),
              to: PATH.PUBLIC.FEATURES,
            },
            { label: t("home.footer.links.pricing"), to: PATH.PUBLIC.PRICING },
            {
              label: t("home.footer.links.security"),
              to: PATH.PUBLIC.SECURITY,
            },
            {
              label: t("home.footer.links.dashboard"),
              to: PATH.USER.DASHBOARD,
            },
          ]}
        />
        <FooterGroup
          title={t("home.footer.company")}
          items={[
            { label: t("home.footer.links.about"), to: PATH.PUBLIC.ABOUT },
            { label: t("home.footer.links.contact"), to: PATH.PUBLIC.CONTACT },
            { label: t("home.footer.links.support"), to: PATH.PUBLIC.SUPPORT },
          ]}
        />
        <FooterGroup
          title={t("home.footer.legal")}
          items={[
            { label: t("home.footer.links.terms"), href: "/terms.html" },
            { label: t("home.footer.links.privacy"), href: "/privacy.html" },
          ]}
        />
      </div>
      <div className="home-footer__copyright">
        © {new Date().getFullYear()} Smart Spend. {t("home.footer.rights")}
      </div>
    </footer>
  );
}

function FooterGroup({ title, items }) {
  return (
    <div className="home-footer__group">
      <strong>{title}</strong>
      {items.map((item) =>
        item.to ? (
          <Link to={item.to} key={item.to}>
            {item.label}
          </Link>
        ) : (
          <a href={item.href} key={item.href}>
            {item.label}
          </a>
        ),
      )}
    </div>
  );
}
