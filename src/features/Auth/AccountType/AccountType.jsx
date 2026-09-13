import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";

import { AUTH_INTENT, getAccountTypePath, PATH } from "../../../routes/Path";

import AuthHeading from "../components/AuthHeading/AuthHeading";
import { ArrowIcon, BuildingIcon, UserIcon } from "../components/AuthIcons";
import AuthPromo from "../components/AuthPromo/AuthPromo";
import AuthSwitchPrompt from "../components/AuthSwitchPrompt/AuthSwitchPrompt";

import "./AccountType.css";

/* Where each account type continues to, for each intent. */
const DESTINATIONS = {
  [AUTH_INTENT.SIGNIN]: {
    personal: PATH.AUTH.SIGNIN,
    company: PATH.AUTH.COMPANY_SIGNIN,
  },
  [AUTH_INTENT.REGISTER]: {
    personal: PATH.AUTH.REGISTER,
    company: PATH.AUTH.COMPANY_REGISTER,
  },
};

const ACCOUNT_TYPES = [
  { type: "personal", Icon: UserIcon },
  { type: "company", Icon: BuildingIcon },
];

const PROMO_CHIPS = [0, 1, 2];

export default function AccountType() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  // Anything other than an explicit sign-in intent is treated as "get started".
  const intent =
    searchParams.get("intent") === AUTH_INTENT.SIGNIN
      ? AUTH_INTENT.SIGNIN
      : AUTH_INTENT.REGISTER;
  const otherIntent =
    intent === AUTH_INTENT.SIGNIN ? AUTH_INTENT.REGISTER : AUTH_INTENT.SIGNIN;

  return (
    <>
      <AuthPromo
        title={t("auth.accountType.promo.title")}
        subtitle={t("auth.accountType.promo.subtitle")}
      >
        <div className="auth-promo__chips">
          {PROMO_CHIPS.map((index) => (
            <span className="auth-promo__chip" key={index}>
              {t(`auth.accountType.promo.chips.${index}`)}
            </span>
          ))}
        </div>
      </AuthPromo>

      <section className="auth-panel account-type">
        <AuthHeading
          title={t(`auth.accountType.${intent}.title`)}
          subtitle={t(`auth.accountType.${intent}.subtitle`)}
        />

        <ul className="account-type__options">
          {ACCOUNT_TYPES.map(({ type, Icon }) => {
            const descriptionId = `account-type-${type}-description`;

            return (
              <li
                className={`account-type-card account-type-card--${type}`}
                key={type}
              >
                <span className="account-type-card__icon" aria-hidden="true">
                  <Icon />
                </span>

                <div className="account-type-card__copy">
                  <h2 className="account-type-card__title">
                    {t(`auth.accountType.${type}.title`)}
                  </h2>

                  <p className="account-type-card__description" id={descriptionId}>
                    {t(`auth.accountType.${type}.description`)}
                  </p>
                </div>

                {/* The link stretches over the whole card (see ::after). */}
                <Link
                  className="account-type-card__cta"
                  to={DESTINATIONS[intent][type]}
                  aria-describedby={descriptionId}
                >
                  <span>{t(`auth.accountType.${type}.cta`)}</span>
                  <ArrowIcon />
                </Link>
              </li>
            );
          })}
        </ul>

        <AuthSwitchPrompt
          prefix={t(`auth.accountType.switch.${intent}.prefix`)}
          linkLabel={t(`auth.accountType.switch.${intent}.link`)}
          to={getAccountTypePath(otherIntent)}
        />
      </section>
    </>
  );
}
