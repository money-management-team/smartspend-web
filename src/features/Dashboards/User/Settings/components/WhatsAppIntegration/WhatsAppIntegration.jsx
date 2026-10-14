import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { FaWhatsapp } from "react-icons/fa";
import {
  LuChevronRight,
  LuCircleCheck,
  LuInbox,
  LuLock,
  LuMessageSquareText,
  LuSettings2,
  LuShieldCheck,
  LuSmartphone,
} from "react-icons/lu";

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
import { WhatsAppFaq, WhatsAppHowItWorks, WhatsAppTrustNote } from "./WhatsAppGuide.jsx";
import WhatsAppLinkFlow from "./WhatsAppLinkFlow.jsx";
import WhatsAppPreferences from "./WhatsAppPreferences.jsx";
import { formatLinkedDate, maskedDigits } from "./whatsappFormat.js";
import { getWhatsAppErrorMessage } from "./whatsappLinking.js";
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
 * The page header: what the integration does, where the user stands, and the
 * one primary action for that state (passed as `action`). A linked user gets
 * the compact form: the value is known, the chat example moves into the
 * folded "how it works".
 */
function Hero({ state, compact, action }) {
  const { t } = useTranslation();
  const [tone, badge] = BADGE[state];

  return (
    <section className={`wa-hero${compact ? " wa-hero--compact" : ""}`} aria-labelledby="wa-hero-title">
      <div className="wa-hero__copy">
        <div className="wa-hero__top">
          <span className="wa-hero__eyebrow"><FaWhatsapp aria-hidden="true" />{t(`${x}.hero.eyebrow`)}</span>
          <span className={`wa-badge wa-badge--${tone}`}>{t(`${x}.${badge}`)}</span>
        </div>
        <h2 id="wa-hero-title">{t(`${x}.intro.title`)}</h2>
        <p className="wa-hero__lead">{t(`${x}.intro.body`)}</p>

        {!compact && (
          <ul className="wa-points">
            <li><LuMessageSquareText aria-hidden="true" />{t(`${x}.intro.points.a`)}</li>
            <li><LuShieldCheck aria-hidden="true" />{t(`${x}.intro.points.b`)}</li>
            <li><LuCircleCheck aria-hidden="true" />{t(`${x}.intro.points.c`)}</li>
          </ul>
        )}

        {action && <div className="wa-actions wa-hero__actions">{action}</div>}
      </div>

      {!compact && (
        <div className="wa-hero__art">
          <WhatsAppChatPreview />
        </div>
      )}
    </section>
  );
}

function OnboardingSteps() {
  const { t } = useTranslation();

  return (
    <section className="wa-panel wa-onboarding" aria-labelledby="wa-onboarding-title">
      <h3 id="wa-onboarding-title">{t(`${x}.onboarding.title`)}</h3>
      <ol className="wa-onboarding__steps">
        {["a", "b", "c"].map((step, index) => (
          <li key={step}>
            <span className="wa-onboarding__number" aria-hidden="true">{index + 1}</span>
            <span>
              <strong>{t(`${x}.onboarding.steps.${step}.title`)}</strong>
              <small>{t(`${x}.onboarding.steps.${step}.body`)}</small>
            </span>
          </li>
        ))}
      </ol>
      <p className="wa-note wa-note--lock"><LuLock aria-hidden="true" />{t(`${x}.privacy`)}</p>
    </section>
  );
}

function Details({ integration, language }) {
  const { t } = useTranslation();
  const digits = maskedDigits(integration.phone_last_digits);
  const linkedOn = formatLinkedDate(integration.linked_at, language);
  const accountName = integration.default_account?.name ?? null;

  return (
    <dl className="wa-details">
      {digits && (
        <div><dt>{t(`${x}.connected.number`)}</dt><dd><bdi dir="ltr">{digits}</bdi></dd></div>
      )}
      {integration.language && (
        <div>
          <dt>{t(`${x}.connected.language`)}</dt>
          <dd>{t(`${x}.prefs.languages.${integration.language}`, { defaultValue: integration.language })}</dd>
        </div>
      )}
      <div>
        <dt>{t(`${x}.connected.account`)}</dt>
        <dd>{accountName ?? (integration.default_account_id != null
          ? t(`${x}.connected.accountSet`)
          : t(`${x}.connected.noAccount`))}</dd>
      </div>
      {linkedOn && <div><dt>{t(`${x}.connected.linkedOn`)}</dt><dd>{linkedOn}</dd></div>}
    </dl>
  );
}

/*
 * Entry to the draft inbox. It depends on `can_review_drafts`, not on whether
 * WhatsApp is enabled or linked: drafts already received stay reviewable. The
 * count is the backend's global pending count, never a count of loaded rows.
 */
function DraftsEntry({ language, featured = false }) {
  const { t } = useTranslation();
  const { count, ensureFresh } = useWhatsAppPending();
  useEffect(() => { ensureFresh(); }, [ensureFresh]);

  return (
    <Link className={`wa-inbox${featured ? " wa-inbox--featured" : ""}`} to={PATH.USER.WHATSAPP_DRAFTS}>
      <span className="wa-inbox__icon" aria-hidden="true"><LuInbox /></span>
      <span className="wa-inbox__text">
        <strong>{t(`${x}.inbox.title`)}</strong>
        <small>{t(`${x}.inbox.body`)}</small>
      </span>
      {typeof count === "number" && (
        <span className={`wa-inbox__count${count > 0 ? " wa-inbox__count--active" : ""}`}>
          <bdi dir="ltr">{new Intl.NumberFormat(language).format(count)}</bdi>
          <span className="wa-sr-only"> {t(`${x}.inbox.pending`)}</span>
        </span>
      )}
      <LuChevronRight className="wa-inbox__chevron" aria-hidden="true" />
    </Link>
  );
}

function Disabled({ integration }) {
  const { t } = useTranslation();
  const digits = integration?.linked ? maskedDigits(integration.phone_last_digits) : null;

  return (
    <section className="wa-panel wa-panel--muted wa-disabled" aria-labelledby="wa-disabled-title">
      <h3 id="wa-disabled-title">{t(`${x}.disabled.title`)}</h3>
      <p>{t(`${x}.disabled.body`)}</p>
      {digits && (
        <div className="wa-previous">
          <span>{t(`${x}.disabled.previous`)} <bdi dir="ltr">{digits}</bdi></span>
          <small>{t(`${x}.disabled.previousNote`)}</small>
        </div>
      )}
      <p className="wa-note">{t(`${x}.disabled.drafts`)}</p>
    </section>
  );
}

/* Placeholder with the page's own shape while availability loads. */
function Skeleton() {
  const { t } = useTranslation();

  return (
    <div className="wa-integration wa-integration--loading" role="status" aria-busy="true">
      <span className="wa-sr-only">{t(`${x}.loading`)}</span>
      <div className="wa-skeleton wa-skeleton--hero" aria-hidden="true">
        <span className="wa-skeleton__line wa-skeleton__line--short" />
        <span className="wa-skeleton__line wa-skeleton__line--title" />
        <span className="wa-skeleton__line" />
        <span className="wa-skeleton__line wa-skeleton__line--mid" />
        <span className="wa-skeleton__pill" />
      </div>
      <div className="wa-skeleton wa-skeleton--row" aria-hidden="true">
        <span className="wa-skeleton__line wa-skeleton__line--mid" />
        <span className="wa-skeleton__line" />
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
  const linked = state === "linked" && Boolean(integration);

  const connectAction = state === "not_linked" && capabilities.can_link && !flowOpen ? (
    <button
      type="button"
      className="wa-button wa-button--primary wa-button--lg"
      onClick={() => { setNotice(""); link.start(); }}
    >
      <FaWhatsapp aria-hidden="true" />{t(`${x}.intro.connect`)}
    </button>
  ) : null;

  return (
    <div className="wa-integration" data-state={state}>
      <p className="wa-feedback wa-feedback--page" role="status">{notice}</p>
      {actionError && <p className="wa-error" role="alert">{actionError}</p>}

      <Hero state={state} compact={linked} action={connectAction} />

      {state === "disabled" && <Disabled integration={integration} />}

      {state === "not_linked" && (flowOpen ? (
        <div className="wa-flow" ref={flowRef} tabIndex={-1}>
          <WhatsAppLinkFlow
            state={link.state}
            onConfirm={link.confirm}
            onCancel={link.cancel}
            onRestart={link.start}
          />
        </div>
      ) : (
        <OnboardingSteps />
      ))}

      {linked && (
        <div className="wa-connected">
          <section className="wa-panel wa-status" aria-labelledby="wa-status-title">
            <span className="wa-status__icon" aria-hidden="true">
              <FaWhatsapp />
              <span className="wa-status__pulse" />
            </span>
            <div className="wa-status__main">
              <h3 id="wa-status-title">{t(`${x}.connected.title`)}</h3>
              <p>{t(`${x}.connected.body`)}</p>
              <Details integration={integration} language={language} />
              <p className="wa-hint"><LuSmartphone aria-hidden="true" />{t(`${x}.connected.openHint`)}</p>
            </div>
          </section>

          {capabilities.can_review_drafts && <DraftsEntry language={language} featured />}
        </div>
      )}

      {/* With WhatsApp off, the inbox is the one thing left to do, so it stays near the top. */}
      {state === "disabled" && capabilities.can_review_drafts && <DraftsEntry language={language} />}

      <WhatsAppTrustNote />

      {state !== "disabled" && <WhatsAppHowItWorks collapsed={linked} />}

      {linked && capabilities.can_manage_link && (
        <section className="wa-section wa-manage" aria-labelledby="wa-manage-title">
          <header className="wa-section__head">
            <h3 id="wa-manage-title"><LuSettings2 aria-hidden="true" />{t(`${x}.manage.title`)}</h3>
            <p>{t(`${x}.manage.body`)}</p>
          </header>

          <WhatsAppPreferences
            key={integration.generation}
            integration={integration}
            api={api}
            accounts={accounts}
            onSaved={(updated) => { replaceIntegration(updated); refresh(); }}
            onDisabled={reload}
          />

          <div className="wa-unlink">
            <div>
              <h4>{t(`${x}.unlink.title`)}</h4>
              <p>{t(`${x}.unlink.body`)}</p>
            </div>
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
        </section>
      )}

      <WhatsAppFaq />

      {/*
        Everywhere else the inbox stays reachable, last: before linking (drafts
        from an earlier link), or if the backend says linked without details.
      */}
      {!linked && state !== "disabled" && capabilities.can_review_drafts && <DraftsEntry language={language} />}

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
