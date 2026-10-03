import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { LuRefreshCw } from "react-icons/lu";
import "./AiInputAllowance.css";

const P = "dashboard.financialOperations.aiInput";
export default function AiInputAllowance({
  quota,
  channels = ["voice", "receipt"],
  onSwitchToManual,
}) {
  const { t, i18n } = useTranslation();
  const { store, state } = quota;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const resetText = (at) => {
    try {
      return new Intl.DateTimeFormat(
        i18n.language === "ar" ? "ar-PS" : "en-US",
        { dateStyle: "medium", timeStyle: "short" },
      ).format(new Date(at));
    } catch {
      return "";
    }
  };
  return (
    <section className="ai-input-allowance" aria-label={t(`${P}.title`)}>
      <div className="ai-input-allowance__heading">
        <strong>{t(`${P}.title`)}</strong>
        <button
          type="button"
          onClick={() => void store.refresh()}
          disabled={state.loading}
          aria-label={t(`${P}.refresh`)}
        >
          <LuRefreshCw aria-hidden="true" />
          {t(`${P}.refresh`)}
        </button>
      </div>
      <div className="ai-input-allowance__grid" aria-live="polite">
        {channels.map((channel) => {
          const value = store.quota(channel);
          const exhausted = value?.remaining === 0;
          const minute = (state.minuteUntil[channel] ?? 0) > now;
          return (
            <div
              key={channel}
              className={`ai-input-allowance__item${exhausted ? " ai-input-allowance__item--exhausted" : ""}`}
            >
              <span>{t(`${P}.${channel}`)}</span>
              <b>
                {value ? (
                  <>
                    <bdi dir="ltr">
                      {value.remaining} / {value.limit}
                    </bdi>{" "}
                    {t(`${P}.remaining`)}
                  </>
                ) : (
                  t(`${P}.${state.loading ? "loading" : "unknown"}`)
                )}
              </b>
              {exhausted && (
                <p>
                  {t(`${P}.exhausted`)}{" "}
                  <time dateTime={value.reset_at}>
                    {t(`${P}.reset`, { time: resetText(value.reset_at) })}
                  </time>
                </p>
              )}
              {minute && <p>{t(`${P}.minute`)}</p>}
            </div>
          );
        })}
      </div>
      {state.error && (
        <p className="ai-input-allowance__notice" role="alert">
          {t(`${P}.loadFailed`)}
        </p>
      )}
      <p className="ai-input-allowance__note">{t(`${P}.policy`)}</p>
      {onSwitchToManual && (
        <button
          type="button"
          className="ai-input-allowance__manual"
          onClick={onSwitchToManual}
        >
          {t(`${P}.manual`)}
        </button>
      )}
    </section>
  );
}
