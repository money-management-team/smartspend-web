import { useTranslation } from "react-i18next";

import { PATH } from "../../../routes/Path";

import AuthButton from "../components/AuthButton/AuthButton";
import AuthHeading from "../components/AuthHeading/AuthHeading";
import { CheckIcon } from "../components/AuthIcons";
import AuthPromo from "../components/AuthPromo/AuthPromo";
import AuthSteps from "../components/AuthSteps/AuthSteps";

export default function PasswordChanged() {
  const { t } = useTranslation();

  return (
    <>
      <AuthPromo
        title={t("auth.passwordChanged.promo.title")}
        subtitle={t("auth.passwordChanged.promo.subtitle")}
      />

      <section className="auth-panel">
        <AuthSteps current={4} />

        <AuthHeading
          tone="success"
          icon={<CheckIcon />}
          title={t("auth.passwordChanged.title")}
          subtitle={t("auth.passwordChanged.subtitle")}
        />

        <div className="auth-form">
          <AuthButton to={PATH.AUTH.SIGNIN}>
            {t("auth.passwordChanged.back")}
          </AuthButton>
        </div>
      </section>
    </>
  );
}
