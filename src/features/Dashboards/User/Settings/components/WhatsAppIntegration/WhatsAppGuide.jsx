import { useTranslation } from "react-i18next";
import { FaWhatsapp } from "react-icons/fa";
import { LuChevronDown, LuCircleCheck, LuCircleHelp, LuListChecks, LuShieldCheck } from "react-icons/lu";

const x = "dashboard.settings.whatsapp";

const USAGE_STEPS = [
  ["open", FaWhatsapp],
  ["record", LuListChecks],
  ["review", LuCircleCheck],
];

const FAQ = ["debit", "where", "review", "account", "disconnect", "expired"];

/* The financial rule, once per page, as one quiet row. */
export function WhatsAppSafetyRow() {
  const { t } = useTranslation();

  return (
    <p className="wa-safety">
      <LuShieldCheck aria-hidden="true" />
      <span>{t(`${x}.safety.text`)}</span>
    </p>
  );
}

/* How a linked user records an expense: three steps in one row. */
export function WhatsAppUsageSteps() {
  const { t } = useTranslation();

  return (
    <section className="wa-usage" aria-labelledby="wa-usage-title">
      <h3 id="wa-usage-title" className="wa-subhead">{t(`${x}.usage.title`)}</h3>
      <ol className="wa-usage__steps">
        {USAGE_STEPS.map(([step, Icon], index) => (
          <li key={step} className="wa-usage__step">
            <span className="wa-usage__icon" aria-hidden="true"><Icon /></span>
            <span className="wa-usage__text">
              <strong><span className="wa-usage__number">{index + 1}</span>{t(`${x}.usage.steps.${step}.title`)}</strong>
              <small>{t(`${x}.usage.steps.${step}.body`)}</small>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/*
 * Help and FAQ in one collapsed group at the end of the page: available on
 * every visit, never in the way.
 */
export function WhatsAppHelp() {
  const { t } = useTranslation();

  return (
    <details className="wa-fold wa-help" id="wa-help">
      <summary>
        <span className="wa-fold__title"><LuCircleHelp aria-hidden="true" />{t(`${x}.help.title`)}</span>
        <LuChevronDown className="wa-fold__chevron" aria-hidden="true" />
      </summary>
      <div className="wa-fold__body wa-faq">
        {FAQ.map((item) => (
          <details key={item} className="wa-faq__item">
            <summary>
              <span>{t(`${x}.faq.items.${item}.q`)}</span>
              <LuChevronDown className="wa-fold__chevron" aria-hidden="true" />
            </summary>
            <p>{t(`${x}.faq.items.${item}.a`)}</p>
          </details>
        ))}
      </div>
    </details>
  );
}
