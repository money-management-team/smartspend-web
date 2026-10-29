import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { LuInfo, LuRefreshCw } from "react-icons/lu";
import "./AiInputAllowance.css";

const P = "dashboard.financialOperations.aiInput";
export default function AiInputAllowance({ quota, channels = ["voice", "receipt"], onSwitchToManual, compact = false }) {
  const { t, i18n } = useTranslation();
  const { store, state } = quota;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const resetText = (at) => {
    try { return new Intl.DateTimeFormat(i18n.language === "ar" ? "ar-PS" : "en-US",
      { dateStyle: "medium", timeStyle: "short" }).format(new Date(at)); }
    catch { return ""; }
  };
  const blocked = channels.some((channel) => store.quota(channel)?.remaining === 0
    || (state.minuteUntil[channel] ?? 0) > now);
  if (!compact) {
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
  return (
    <section className="ai-input-allowance ai-input-allowance--compact" aria-label={t(`${P}.title`)}>
      <div className="ai-input-allowance__line">
        <LuInfo aria-hidden="true" />
        <span>{t(`${P}.title`)}</span>
        {channels.map((channel) => {
          const value = store.quota(channel);
          return <strong key={channel} aria-live="polite">
            {channels.length > 1 && <span>{t(`${P}.${channel}`)}: </span>}
            {value ? <><bdi dir="ltr">{value.remaining} / {value.limit}</bdi> {t(`${P}.remaining`)}</>
              : t(`${P}.${state.loading ? "loading" : "unknown"}`)}
          </strong>;
        })}
        <button type="button" className="ai-input-allowance__refresh"
          onClick={() => void store.refresh()} disabled={state.loading}
          aria-label={t(`${P}.refresh`)} title={t(`${P}.refresh`)}><LuRefreshCw aria-hidden="true" /></button>
      </div>
      {channels.map((channel) => {
        const value = store.quota(channel);
        return <div key={channel}>
          {value?.remaining === 0 && <p className="ai-input-allowance__notice" role="status">
            {t(`${P}.exhausted`)} <time dateTime={value.reset_at}>{t(`${P}.reset`, { time: resetText(value.reset_at) })}</time>
          </p>}
          {(state.minuteUntil[channel] ?? 0) > now && <p className="ai-input-allowance__notice">{t(`${P}.minute`)}</p>}
        </div>;
      })}
      {state.error && <p className="ai-input-allowance__notice" role="alert">{t(`${P}.loadFailed`)}</p>}
      <details className="ai-input-allowance__details">
        <summary>{t("dashboard.financialOperations.ui.allowanceDetails")}</summary>
        <p>{t(`${P}.policy`)}</p>
      </details>
      {(blocked || state.error) && onSwitchToManual && <button type="button"
        className="ai-input-allowance__manual" onClick={onSwitchToManual}>{t(`${P}.manual`)}</button>}
    </section>
  );
}
