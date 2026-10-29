import { useTranslation } from "react-i18next";
import { AUTH_INTENT, getAccountTypePath, PATH } from "../../../routes/Path";
import AuthButton from "../components/AuthButton/AuthButton";
import AuthHeading from "../components/AuthHeading/AuthHeading";
import {
  ArrowIcon,
  BuildingIcon,
  CheckIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserIcon,
} from "../components/AuthIcons";
import AuthPromo from "../components/AuthPromo/AuthPromo";

import { Link } from "react-router-dom";

import "./CompanyUnavailable.css";

const ROADMAP = [0, 1, 2];
const PROMO_CHIPS = [0, 1, 2];

export default function CompanyUnavailable() {
  const { t } = useTranslation();

  return (
    <>
      <AuthPromo
        title={t("auth.companyUnavailable.promo.title")}
        subtitle={t("auth.companyUnavailable.promo.subtitle")}
      >
        <div className="auth-promo__chips">
          {PROMO_CHIPS.map((index) => (
            <span className="auth-promo__chip" key={index}>
              {t(`auth.companyUnavailable.promo.chips.${index}`)}
            </span>
          ))}
        </div>
      </AuthPromo>

      <section className="auth-panel company-unavailable">
        <div className="company-unavailable__visual" aria-hidden="true">
          <span className="company-unavailable__pulse" />
          <span className="company-unavailable__icon">
            <BuildingIcon />
          </span>
          <span className="company-unavailable__spark">
            <SparklesIcon />
          </span>
        </div>

        <span className="company-unavailable__badge">
          <span className="company-unavailable__dot" aria-hidden="true" />
          {t("auth.companyUnavailable.badge")}
        </span>

        <AuthHeading
          title={t("auth.companyUnavailable.title")}
          subtitle={t("auth.companyUnavailable.description")}
        />

        <p className="company-unavailable__detail" role="status">
          {t("auth.companyUnavailable.detail")}
        </p>

        <div className="company-unavailable__roadmap">
          <h3 className="company-unavailable__roadmap-title">
            <ShieldCheckIcon />
            {t("auth.companyUnavailable.roadmap.title")}
          </h3>

          <ul className="company-unavailable__list">
            {ROADMAP.map((index) => (
              <li key={index}>
                <span className="company-unavailable__check" aria-hidden="true">
                  <CheckIcon />
                </span>
                {t(`auth.companyUnavailable.roadmap.items.${index}`)}
              </li>
            ))}
          </ul>
        </div>

        <div className="company-unavailable__actions">
          <AuthButton to={PATH.AUTH.REGISTER}>
            <UserIcon />
            {t("auth.companyUnavailable.personal")}
          </AuthButton>

          <Link
            className="company-unavailable__back"
            to={getAccountTypePath(AUTH_INTENT.SIGNIN)}
          >
            <ArrowIcon />
            {t("auth.companyUnavailable.back")}
          </Link>
        </div>
      </section>
    </>
  );
}
