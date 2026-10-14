import { useTranslation } from "react-i18next";
import { FaWhatsapp } from "react-icons/fa";
import {
  LuChevronDown,
  LuCircleCheck,
  LuFileClock,
  LuHandCoins,
  LuListChecks,
  LuShieldCheck,
  LuSquareMousePointer,
} from "react-icons/lu";

const x = "dashboard.settings.whatsapp";

const HOW_STEPS = [
  ["open", FaWhatsapp],
  ["choose", LuSquareMousePointer],
  ["amount", LuListChecks],
  ["save", LuFileClock],
  ["review", LuCircleCheck],
];

const FAQ = ["debit", "where", "review", "account", "disconnect", "expired"];

/* The one financial rule, stated once on the page. */
export function WhatsAppTrustNote() {
  const { t } = useTranslation();

  return (
    <section className="wa-trust" aria-labelledby="wa-trust-title">
      <span className="wa-trust__icon" aria-hidden="true"><LuShieldCheck /></span>
      <div>
        <h3 id="wa-trust-title">{t(`${x}.trust.title`)}</h3>
        <p>{t(`${x}.trust.body`)}</p>
      </div>
    </section>
  );
}

function HowSteps() {
  const { t } = useTranslation();

  return (
    <>
      <ol className="wa-how__steps">
        {HOW_STEPS.map(([step, Icon], index) => (
          <li key={step} className="wa-how__step">
            <span className="wa-how__icon" aria-hidden="true">
              <Icon />
              <span className="wa-how__number">{index + 1}</span>
            </span>
            <strong>{t(`${x}.how.steps.${step}.title`)}</strong>
            <span>{t(`${x}.how.steps.${step}.body`)}</span>
          </li>
        ))}
      </ol>
      <p className="wa-how__note">
        <LuHandCoins aria-hidden="true" />
        {t(`${x}.how.accountNote`)}
      </p>
    </>
  );
}

/*
 * The real expense flow in five steps. For a linked user it is folded away
 * behind a question (progressive disclosure); otherwise it is open.
 */
export function WhatsAppHowItWorks({ collapsed = false }) {
  const { t } = useTranslation();

  if (collapsed) {
    return (
      <details className="wa-disclosure wa-how" id="wa-how">
        <summary>
          <span>{t(`${x}.how.toggle`)}</span>
          <LuChevronDown className="wa-disclosure__chevron" aria-hidden="true" />
        </summary>
        <div className="wa-disclosure__body">
          <HowSteps />
        </div>
      </details>
    );
  }

  return (
    <section className="wa-section wa-how" id="wa-how" aria-labelledby="wa-how-title">
      <header className="wa-section__head">
        <h3 id="wa-how-title">{t(`${x}.how.title`)}</h3>
        <p>{t(`${x}.how.subtitle`)}</p>
      </header>
      <HowSteps />
    </section>
  );
}

export function WhatsAppFaq() {
  const { t } = useTranslation();

  return (
    <section className="wa-section wa-faq" id="wa-faq" aria-labelledby="wa-faq-title">
      <header className="wa-section__head">
        <h3 id="wa-faq-title">{t(`${x}.faq.title`)}</h3>
      </header>
      <div className="wa-faq__list">
        {FAQ.map((item) => (
          <details key={item} className="wa-disclosure wa-faq__item">
            <summary>
              <span>{t(`${x}.faq.items.${item}.q`)}</span>
              <LuChevronDown className="wa-disclosure__chevron" aria-hidden="true" />
            </summary>
            <p className="wa-disclosure__body">{t(`${x}.faq.items.${item}.a`)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
