import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuFileCheck2, LuShieldCheck, LuCheck } from "react-icons/lu";
import GlassDialog from "../../../../components/AccessExperience/GlassDialog";
import AuthCheckbox from "../AuthCheckbox/AuthCheckbox";

const TABS = ["terms", "privacy"];
export function PolicyDialog({ initialTab = "terms", onAccept, onClose }) {
  const { t, i18n } = useTranslation("access");
  const [tab, setTab] = useState(initialTab),
    id = useId();
  const moveTab = (event) => {
    const index = TABS.indexOf(tab);
    let next;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
      const offset =
        (event.key === "ArrowRight" ? 1 : -1) * (i18n.dir() === "rtl" ? -1 : 1);
      next = (index + offset + TABS.length) % TABS.length;
    } else return;
    event.preventDefault();
    setTab(TABS[next]);
    event.currentTarget.querySelectorAll('[role="tab"]')[next]?.focus();
  };
  return (
    <GlassDialog
      title={t("policyTitle")}
      hint={t("policyHint")}
      kicker={t("policyKicker")}
      onClose={onClose}
    >
      <div className="access-policy__summary">
        <LuShieldCheck aria-hidden="true" />
        <span>{t("policySummary")}</span>
      </div>
      <div
        className="access-policy__tabs"
        role="tablist"
        aria-label={t("policyTitle")}
        onKeyDown={moveTab}
      >
        {TABS.map((name) => {
          const Icon = name === "terms" ? LuFileCheck2 : LuShieldCheck;
          return (
            <button
              type="button"
              key={name}
              role="tab"
              id={`${id}-${name}-tab`}
              aria-selected={tab === name}
              aria-controls={`${id}-${name}-panel`}
              tabIndex={tab === name ? 0 : -1}
              onClick={() => setTab(name)}
            >
              <Icon aria-hidden="true" />
              {t(name)}
            </button>
          );
        })}
      </div>
      {TABS.map((name) => (
        <div
          key={name}
          hidden={tab !== name}
          role="tabpanel"
          id={`${id}-${name}-panel`}
          aria-labelledby={`${id}-${name}-tab`}
          tabIndex={0}
          className="access-policy__body"
        >
          <p className="access-policy__lead">{t(`${name}Intro`)}</p>
          <ol className="access-policy__sections">
            {t(`${name}Sections`, { returnObjects: true }).map(
              (section, index) => (
                <li key={section.title}>
                  <span className="access-policy__number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div>
                    <h3>{section.title}</h3>
                    <p>{section.body}</p>
                  </div>
                </li>
              ),
            )}
          </ol>
        </div>
      ))}
      <footer className="access-dialog__footer">
        <p className="access-dialog__note">{t("consentHint")}</p>
        <div className="access-dialog__actions">
          <button
            type="button"
            className="access-button access-button--secondary"
            onClick={onClose}
          >
            {t("back")}
          </button>
          <button type="button" className="access-button" onClick={onAccept}>
            <LuCheck aria-hidden="true" />
            {t("accept")}
          </button>
        </div>
      </footer>
    </GlassDialog>
  );
}
export default function PolicyConsent({
  id,
  name,
  checked,
  onChange,
  errors,
  disabled = false,
}) {
  const { t } = useTranslation("access");
  const [panel, setPanel] = useState(null);
  const messages = Array.isArray(errors) ? errors : errors ? [errors] : [];
  const errorId = messages.length ? `${id}-error` : undefined;
  const open = (event, tab) => {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) setPanel(tab);
  };
  return (
    <>
      <div className="access-consent">
        <AuthCheckbox
          id={id}
          name={name}
          checked={checked}
          aria-label={`${t("consentPrefix")} ${t("terms")} ${t("and")} ${t("privacy")}`}
          aria-invalid={messages.length > 0 || undefined}
          aria-describedby={errorId}
          disabled={disabled}
          onChange={(event) => {
            if (event.target.checked) setPanel("terms");
            else onChange(false);
          }}
        />
        <div className="access-consent__caption">
          <label htmlFor={id}>{t("consentPrefix")}</label>{" "}
          <button
            type="button"
            className="access-policy-link"
            disabled={disabled}
            onClick={(event) => open(event, "terms")}
          >
            {t("terms")}
          </button>{" "}
          {t("and")}{" "}
          <button
            type="button"
            className="access-policy-link"
            disabled={disabled}
            onClick={(event) => open(event, "privacy")}
          >
            {t("privacy")}
          </button>
        </div>
        {errorId && (
          <div
            id={errorId}
            className="auth-checkbox__errors access-consent__errors"
          >
            {messages.map((message) => (
              <small key={message}>{message}</small>
            ))}
          </div>
        )}
      </div>
      {panel && (
        <PolicyDialog
          initialTab={panel}
          onClose={() => setPanel(null)}
          onAccept={() => {
            if (!disabled) onChange(true);
            setPanel(null);
          }}
        />
      )}
    </>
  );
}
