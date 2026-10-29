import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { FaWhatsapp } from "react-icons/fa";
import { LuChevronDown, LuInbox, LuLock, LuSettings2, LuSmartphone } from "react-icons/lu";

import ConfirmDialog from "../../../../../../components/ConfirmDialog/ConfirmDialog.jsx";
import StateMessage from "../../../../../../components/StateMessage/StateMessage.jsx";
import { PATH } from "../../../../../../routes/Path.js";
import { getApiErrorMessage } from "../../../api/apiClient.js";
import { whatsappApi } from "../../../api/whatsappApi.js";
import {
  classifyWhatsAppError,
  parseIntegrationResponse,
} from "../../../FinancialOperations/whatsappContract.js";
import WhatsAppChatPreview from "./WhatsAppChatPreview.jsx";
import { WhatsAppHelp, WhatsAppSafetyRow, WhatsAppUsageSteps } from "./WhatsAppGuide.jsx";
import WhatsAppLinkFlow from "./WhatsAppLinkFlow.jsx";
import WhatsAppPreferences from "./WhatsAppPreferences.jsx";
import { formatLinkedDate, maskedDigits } from "./whatsappFormat.js";
import { buildWhatsAppChatLink, getWhatsAppErrorMessage } from "./whatsappLinking.js";
import { useWhatsAppPending } from "../../../../../../contexts/whatsappPending/useWhatsAppPending.js";
import { useWhatsAppAvailability } from "./useWhatsAppAvailability.js";
import { useWhatsAppLinking } from "./useWhatsAppLinking.js";

import "./WhatsAppIntegration.css";

const x = "dashboard.settings.whatsapp";

const BADGE = {
  disabled: ["off", "status.disabled"],
  not_linked: ["idle", "status.notLinked"],
  linked: ["on", "status.linked"],
};

/*
 * Page introduction, small on purpose: the Settings page already has the
 * large header, so this only names the feature and shows where the user
 * stands.
 */
function Intro({ state }) {
  const { t } = useTranslation();
  const [tone, badge] = BADGE[state];

  return (
    <header className="wa-intro">
      <span className="wa-intro__mark" aria-hidden="true"><FaWhatsapp /></span>
      <div className="wa-intro__text">
        <h2>{t(`${x}.page.title`)}</h2>
        <p>{t(`${x}.page.subtitle`)}</p>
      </div>
      <span className={`wa-badge wa-badge--${tone}`}>{t(`${x}.${badge}`)}</span>
    </header>
  );
}

/*
 * The draft inbox. `action` is the button form used in the connection card;
 * otherwise it is a quiet row. It depends on `can_review_drafts`, not on the
 * link state: drafts already received stay reviewable. The count is the
 * shared backend count (no request of its own), shown only when non-zero.
 */
function DraftsLink({ language, variant = "row", primary = false }) {
  const { t } = useTranslation();
  const { count, ensureFresh } = useWhatsAppPending();
  useEffect(() => { ensureFresh(); }, [ensureFresh]);

  const label = variant === "action" ? t(`${x}.inbox.action`) : t(`${x}.inbox.title`);
  const className = variant === "action"
    ? `wa-inbox wa-button ${primary ? "wa-button--primary" : "wa-button--secondary"}`
    : "wa-inbox wa-inbox--row";

  return (
    <Link className={className} to={PATH.USER.WHATSAPP_DRAFTS}>
      <LuInbox className="wa-inbox__icon" aria-hidden="true" />
      <span className="wa-inbox__label">{label}</span>
      {typeof count === "number" && count > 0 && (
        <span className="wa-inbox__count">
          <bdi dir="ltr">{new Intl.NumberFormat(language).format(count)}</bdi>
          <span className="wa-sr-only"> {t(`${x}.inbox.pending`)}</span>
        </span>
      )}
    </Link>
  );
}

function ConnectionCard({ integration, chatLink, canReviewDrafts, language }) {
  const { t } = useTranslation();
  const digits = maskedDigits(integration?.phone_last_digits);
  const linkedOn = integration ? formatLinkedDate(integration.linked_at, language) : null;

  return (
    <section className="wa-card wa-connection" aria-labelledby="wa-connection-title">
      <div className="wa-connection__info">
        <span className="wa-connection__icon" aria-hidden="true">
          <FaWhatsapp />
          <span className="wa-connection__dot" />
        </span>
        <div className="wa-connection__text">
          <h3 id="wa-connection-title">{t(`${x}.connected.title`)}</h3>
          <p>{t(`${x}.connected.body`)}</p>
          {(digits || linkedOn) && (
            <dl className="wa-meta">
              {digits && (
                <div><dt>{t(`${x}.connected.number`)}</dt><dd><bdi dir="ltr">{digits}</bdi></dd></div>
              )}
              {linkedOn && <div><dt>{t(`${x}.connected.linkedOn`)}</dt><dd>{linkedOn}</dd></div>}
            </dl>
          )}
        </div>
      </div>

      <div className="wa-connection__actions">
        {chatLink && (
          <a
            className="wa-button wa-button--primary wa-button--chat"
            href={chatLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaWhatsapp aria-hidden="true" />
            {t(`${x}.connected.openChat`)}
            <span className="wa-sr-only"> {t(`${x}.connected.newTab`)}</span>
          </a>
        )}
        {canReviewDrafts && <DraftsLink language={language} variant="action" primary={!chatLink} />}
      </div>

      {!chatLink && (
        <p className="wa-hint wa-connection__hint">
          <LuSmartphone aria-hidden="true" />{t(`${x}.connected.openHint`)}
        </p>
      )}
    </section>
  );
}

function OnboardingSteps() {
  const { t } = useTranslation();

  return (
    <ol className="wa-steps-mini" aria-label={t(`${x}.onboarding.title`)}>
      {["a", "b", "c"].map((step, index) => (
        <li key={step}>
          <span className="wa-steps-mini__number" aria-hidden="true">{index + 1}</span>
          <span>
            <strong>{t(`${x}.onboarding.steps.${step}.title`)}</strong>
            <small>{t(`${x}.onboarding.steps.${step}.body`)}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Disabled({ integration }) {
  const { t } = useTranslation();
  const digits = integration?.linked ? maskedDigits(integration.phone_last_digits) : null;

  return (
    <section className="wa-card wa-disabled" aria-labelledby="wa-disabled-title">
      <h3 id="wa-disabled-title">{t(`${x}.disabled.title`)}</h3>
      <p>{t(`${x}.disabled.body`)}</p>
      {digits && (
        <p className="wa-previous">
          <span>{t(`${x}.disabled.previous`)} <bdi dir="ltr">{digits}</bdi></span>
          <small>{t(`${x}.disabled.previousNote`)}</small>
        </p>
      )}
      <p className="wa-hint">{t(`${x}.disabled.drafts`)}</p>
    </section>
  );
}

/* Placeholder with the page's own shape while availability loads. */
function Skeleton() {
  const { t } = useTranslation();

  return (
    <div className="wa-integration wa-integration--loading" role="status" aria-busy="true">
      <span className="wa-sr-only">{t(`${x}.loading`)}</span>
      <div className="wa-skeleton wa-skeleton--intro" aria-hidden="true">
        <span className="wa-skeleton__block" />
        <span className="wa-skeleton__lines"><span /><span /></span>
      </div>
      <div className="wa-skeleton wa-skeleton--card" aria-hidden="true">
        <span className="wa-skeleton__lines"><span /><span /><span /></span>
        <span className="wa-skeleton__button" />
      </div>
    </div>
  );
}

// `api`, `accounts` and `createPoller` default to the real adapters; they are
// props so tests can run the real component against fakes.
export default function WhatsAppIntegration({ api = whatsappApi, accounts, createPoller }) {
  const { t, i18n } = useTranslation();
  const availability = useWhatsAppAvailability(api);
  const { reload, refresh, replaceIntegration } = availability;
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const unlinkingRef = useRef(false);
  const flowRef = useRef(null);

  const link = useWhatsAppLinking({
    api,
    createPoller,
    onLinked: () => {
      setNotice(t(`${x}.flow.success`));
      reload();
    },
    onDisabled: () => reload(),
  });

  // Starting the flow moves focus to it, so keyboard and screen reader users
  // land on the next thing to do instead of the button that just disappeared.
  const flowOpen = link.state.phase !== "idle";
  useEffect(() => {
    if (flowOpen) flowRef.current?.focus({ preventScroll: false });
  }, [flowOpen]);

  async function unlink() {
    if (unlinkingRef.current) return;
    unlinkingRef.current = true;
    setUnlinking(true);
    setActionError("");
    setConfirmUnlink(false);

    try {
      parseIntegrationResponse(await api.unlink());
      setNotice(t(`${x}.unlink.done`));
      reload(); // availability is re-read; nothing is deleted locally
    } catch (error) {
      const kind = classifyWhatsAppError(error);
      setActionError(getWhatsAppErrorMessage(error, t, "unlink"));
      setSettingsOpen(true); // the failed action lives there: keep it in view
      if (kind === "disabled" || kind === "conflict") reload();
    } finally {
      unlinkingRef.current = false;
      setUnlinking(false);
    }
  }

  if (availability.loading) return <Skeleton />;

  if (availability.error || !availability.data) {
    const malformed = availability.error?.code === "MALFORMED_RESPONSE" || availability.error?.code === "NOT_FOUND";
    return (
      <div className="wa-integration">
        <StateMessage
          tone="error"
          message={malformed ? t(`${x}.errors.unsupported`) : getApiErrorMessage(availability.error, t)}
          onRetry={reload}
        />
      </div>
    );
  }

  const { state, capabilities, integration } = availability.data;
  const language = i18n.language;
  const connected = state === "linked";
  const chatLink = connected
    ? buildWhatsAppChatLink(availability.data.public_number, t(`${x}.connected.chatGreeting`))
    : null;
  const canManage = connected && Boolean(integration) && capabilities.can_manage_link;
  const settingsSummary = canManage
    ? [
        integration.language ? t(`${x}.prefs.languages.${integration.language}`, { defaultValue: integration.language }) : null,
        integration.default_account?.name ?? (integration.default_account_id == null ? t(`${x}.connected.noAccount`) : null),
      ].filter(Boolean).join(" · ")
    : "";

  return (
    <div className="wa-integration" data-state={state}>
      <Intro state={state} />

      <p className="wa-feedback wa-feedback--page" role="status">{notice}</p>
      {actionError && <p className="wa-error" role="alert">{actionError}</p>}

      {state === "disabled" && (
        <>
          <Disabled integration={integration} />
          {capabilities.can_review_drafts && <DraftsLink language={language} />}
        </>
      )}

      {state === "not_linked" && (
        <section className="wa-card wa-onboard" aria-labelledby="wa-onboard-title">
          <div className="wa-onboard__main">
            {flowOpen ? (
              <div className="wa-flow" ref={flowRef} tabIndex={-1}>
                <h3 id="wa-onboard-title" className="wa-sr-only">{t(`${x}.onboarding.title`)}</h3>
                <WhatsAppLinkFlow
                  state={link.state}
                  onConfirm={link.confirm}
                  onCancel={link.cancel}
                  onRestart={link.start}
                />
              </div>
            ) : (
              <>
                <span className="wa-onboard__eyebrow">{t(`${x}.hero.eyebrow`)}</span>
                <h3 id="wa-onboard-title">{t(`${x}.intro.title`)}</h3>
                <p className="wa-onboard__lead">{t(`${x}.intro.body`)}</p>
                {capabilities.can_link && (
                  <div className="wa-onboard__cta">
                    <button
                      type="button"
                      className="wa-button wa-button--primary wa-button--lg"
                      onClick={() => { setNotice(""); link.start(); }}
                    >
                      <FaWhatsapp aria-hidden="true" />{t(`${x}.intro.connect`)}
                    </button>
                  </div>
                )}
                <OnboardingSteps />
                <p className="wa-hint wa-hint--lock"><LuLock aria-hidden="true" />{t(`${x}.privacy`)}</p>
              </>
            )}
          </div>
          <div className="wa-onboard__art">
            <WhatsAppChatPreview />
          </div>
        </section>
      )}

      {connected && (
        <>
          <ConnectionCard
            integration={integration}
            chatLink={chatLink}
            canReviewDrafts={capabilities.can_review_drafts}
            language={language}
          />
          <WhatsAppUsageSteps />
        </>
      )}

      <WhatsAppSafetyRow />

      {canManage && (
        <details
          className="wa-fold wa-settings"
          open={settingsOpen}
          onToggle={(event) => setSettingsOpen(event.currentTarget.open)}
        >
          <summary>
            <span className="wa-fold__title"><LuSettings2 aria-hidden="true" />{t(`${x}.settings.title`)}</span>
            {settingsSummary && <span className="wa-fold__meta">{settingsSummary}</span>}
            <LuChevronDown className="wa-fold__chevron" aria-hidden="true" />
          </summary>
          <div className="wa-fold__body">
            <WhatsAppPreferences
              key={integration.generation}
              integration={integration}
              api={api}
              accounts={accounts}
              onSaved={(updated) => { replaceIntegration(updated); refresh(); }}
              onDisabled={reload}
            />
            <div className="wa-unlink">
              <p>
                <strong>{t(`${x}.unlink.title`)}</strong>
                <span>{t(`${x}.unlink.body`)}</span>
              </p>
              <button
                type="button"
                className="wa-button wa-button--danger"
                onClick={() => setConfirmUnlink(true)}
                disabled={unlinking}
                aria-busy={unlinking}
              >
                {unlinking ? t(`${x}.unlink.working`) : t(`${x}.unlink.action`)}
              </button>
            </div>
          </div>
        </details>
      )}

      {state === "not_linked" && capabilities.can_review_drafts && <DraftsLink language={language} />}

      <WhatsAppHelp />

      {confirmUnlink && (
        <ConfirmDialog
          title={t(`${x}.unlink.confirmTitle`)}
          message={t(`${x}.unlink.confirmBody`)}
          confirmLabel={t(`${x}.unlink.confirm`)}
          cancelLabel={t(`${x}.unlink.cancel`)}
          onConfirm={unlink}
          onCancel={() => setConfirmUnlink(false)}
        />
      )}
    </div>
  );
}
