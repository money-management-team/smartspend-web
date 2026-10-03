import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AUTH_INTENT, getAccountTypePath, PATH } from "../../../routes/Path";
import AuthHeading from "../components/AuthHeading/AuthHeading";
import AuthPromo from "../components/AuthPromo/AuthPromo";

export default function CompanyUnavailable() {
  const { t } = useTranslation();
  return <>
    <AuthPromo title={t("auth.companyUnavailable.title")} subtitle={t("auth.companyUnavailable.description")} />
    <section className="auth-panel">
      <AuthHeading title={t("auth.companyUnavailable.title")} subtitle={t("auth.companyUnavailable.description")} />
      <p role="status">{t("auth.companyUnavailable.detail")}</p>
      <p><Link to={PATH.AUTH.REGISTER}>{t("auth.companyUnavailable.personal")}</Link></p>
      <p><Link to={getAccountTypePath(AUTH_INTENT.SIGNIN)}>{t("auth.companyUnavailable.back")}</Link></p>
    </section>
  </>;
}
