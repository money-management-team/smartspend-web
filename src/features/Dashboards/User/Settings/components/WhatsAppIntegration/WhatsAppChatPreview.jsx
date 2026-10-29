import { useTranslation } from "react-i18next";
import { FaWhatsapp } from "react-icons/fa";
import { LuCheckCheck, LuCircleCheck, LuList } from "react-icons/lu";

const x = "dashboard.settings.whatsapp.preview";

/* A quick-amount row as the bot shows it; the same in both languages. */
const EXAMPLE_AMOUNT = "50 ₪";

/*
 * A static illustration of the interactive (v2) WhatsApp conversation, built
 * from the same wording the backend sends. It is not a chat: there are no
 * buttons or links, it is labelled "Example", and assistive technology gets a
 * one-sentence description instead of the bubbles.
 */
export default function WhatsAppChatPreview() {
  const { t } = useTranslation();

  return (
    <figure className="wa-chat" aria-label={t(`${x}.description`)}>
      <span className="wa-chat__label">{t(`${x}.label`)}</span>

      <div className="wa-chat__phone" aria-hidden="true">
        <div className="wa-chat__bar">
          <span className="wa-chat__avatar"><FaWhatsapp /></span>
          <span className="wa-chat__who">
            <strong>{t(`${x}.title`)}</strong>
            <small>{t(`${x}.subtitle`)}</small>
          </span>
        </div>

        <div className="wa-chat__thread">
          <p className="wa-bubble wa-bubble--out">{t(`${x}.hi`)}<Ticks /></p>

          <div className="wa-bubble wa-bubble--in">
            <strong>{t(`${x}.title`)}</strong>
            <span>{t(`${x}.menu`)}</span>
            <span className="wa-bubble__replies">
              <span className="wa-bubble__reply wa-bubble__reply--picked">{t(`${x}.expense`)}</span>
              <span className="wa-bubble__reply">{t(`${x}.drafts`)}</span>
              <span className="wa-bubble__reply">{t(`${x}.help`)}</span>
            </span>
          </div>

          <p className="wa-bubble wa-bubble--out">
            <LuList className="wa-bubble__glyph" /><bdi dir="ltr">{EXAMPLE_AMOUNT}</bdi> · {t(`${x}.category`)}<Ticks />
          </p>

          <div className="wa-bubble wa-bubble--in">
            <strong>{t(`${x}.summaryTitle`)}</strong>
            <span>{t(`${x}.summaryLine`)}</span>
            <span className="wa-bubble__replies">
              <span className="wa-bubble__reply wa-bubble__reply--picked">{t(`${x}.save`)}</span>
            </span>
          </div>

          <div className="wa-bubble wa-bubble--in wa-bubble--done">
            <LuCircleCheck className="wa-bubble__check" />
            <span>
              <strong>{t(`${x}.saved`)}</strong>
              <span>{t(`${x}.savedNote`)}</span>
            </span>
          </div>
        </div>
      </div>
    </figure>
  );
}

function Ticks() {
  return <LuCheckCheck className="wa-bubble__ticks" />;
}
