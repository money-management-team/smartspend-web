import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { FaWhatsapp } from "react-icons/fa";
import { LuChevronRight, LuCircleCheck, LuInbox, LuLock, LuMessageSquareText, LuShieldCheck } from "react-icons/lu";

import ConfirmDialog from "../../../../../../components/ConfirmDialog/ConfirmDialog.jsx";
import Loading from "../../../../../../components/Loading/Loading.jsx";
import StateMessage from "../../../../../../components/StateMessage/StateMessage.jsx";
import { PATH } from "../../../../../../routes/Path.js";
import { getApiErrorMessage } from "../../../api/apiClient.js";
import { whatsappApi } from "../../../api/whatsappApi.js";
import {
  classifyWhatsAppError,
  parseIntegrationResponse,
} from "../../../FinancialOperations/whatsappContract.js";
import WhatsAppLinkFlow from "./WhatsAppLinkFlow.jsx";
import WhatsAppPreferences from "./WhatsAppPreferences.jsx";
import { formatLinkedDate, maskedDigits } from "./whatsappFormat.js";
import { getWhatsAppErrorMessage } from "./whatsappLinking.js";
import { useWhatsAppPending } from "../../../../../../contexts/whatsappPending/useWhatsAppPending.js";
import { useWhatsAppAvailability } from "./useWhatsAppAvailability.js";
import { useWhatsAppLinking } from "./useWhatsAppLinking.js";

import "./WhatsAppIntegration.css";

const x = "dashboard.settings.whatsapp";

function StatusCard({ tone, badge, title, body, children }) {
  return (
    <section className={`wa-card wa-card--${tone}`}>
      <div className="wa-card__icon" aria-hidden="true"><FaWhatsapp /></div>
      <div className="wa-card__main">
        <div className="wa-card__head">
          <h2>{title}</h2>
          <span className={`wa-badge wa-badge--${tone}`}>{badge}</span>
        </div>
        <p>{body}</p>
        {children}
      </div>
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
function DraftsEntry({ language }) {
  const { t } = useTranslation();
  const { count, ensureFresh } = useWhatsAppPending();
  useEffect(() => { ensureFresh(); }, [ensureFresh]);

  return (
    <Link className="wa-inbox" to={PATH.USER.WHATSAPP_DRAFTS}>
      <span className="wa-inbox__icon" aria-hidden="true"><LuInbox /></span>
      <span className="wa-inbox__text">
        <strong>{t(`${x}.inbox.title`)}</strong>
        <small>{t(`${x}.inbox.body`)}</small>
      </span>
      {typeof count === "number" && (
        <span className="wa-inbox__count">
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
    <StatusCard tone="off" badge={t(`${x}.status.disabled`)} title={t(`${x}.disabled.title`)} body={t(`${x}.disabled.body`)}>
      {digits && (
        <div className="wa-previous">
          <span>{t(`${x}.disabled.previous`)} <bdi dir="ltr">{digits}</bdi></span>
          <small>{t(`${x}.disabled.previousNote`)}</small>
        </div>
      )}
      <p className="wa-note">{t(`${x}.disabled.drafts`)}</p>
    </StatusCard>
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

  const link = useWhatsAppLinking({
    api,
    createPoller,
    onLinked: () => {
      setNotice(t(`${x}.flow.success`));
      reload();
    },
    onDisabled: () => reload(),
  });

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

  if (availability.loading) return <Loading message={t(`${x}.loading`)} />;

  if (availability.error || !availability.data) {
    const malformed = availability.error?.code === "MALFORMED_RESPONSE" || availability.error?.code === "NOT_FOUND";
    return (
      <StateMessage
        tone="error"
        message={malformed ? t(`${x}.errors.unsupported`) : getApiErrorMessage(availability.error, t)}
        onRetry={reload}
      />
    );
  }

  const { state, capabilities, integration } = availability.data;
  const language = i18n.language;

  return (
    <div className="wa-integration">
      <p className="wa-feedback wa-feedback--page" role="status">{notice}</p>
      {actionError && <p className="wa-error" role="alert">{actionError}</p>}

      {state === "disabled" && <Disabled integration={integration} />}

      {state === "not_linked" && (
        <>
          <StatusCard tone="idle" badge={t(`${x}.status.notLinked`)} title={t(`${x}.intro.title`)} body={t(`${x}.intro.body`)}>
            {link.state.phase === "idle" && (
              <>
                <ul className="wa-points">
                  <li><LuMessageSquareText aria-hidden="true" />{t(`${x}.intro.points.a`)}</li>
                  <li><LuShieldCheck aria-hidden="true" />{t(`${x}.intro.points.b`)}</li>
                  <li><LuCircleCheck aria-hidden="true" />{t(`${x}.intro.points.c`)}</li>
                </ul>
                {capabilities.can_link && (
                  <div className="wa-actions">
                    <button type="button" className="wa-button wa-button--whatsapp" onClick={() => { setNotice(""); link.start(); }}>
                      <FaWhatsapp aria-hidden="true" />{t(`${x}.intro.connect`)}
                    </button>
                  </div>
                )}
                <p className="wa-note wa-note--lock"><LuLock aria-hidden="true" />{t(`${x}.privacy`)}</p>
              </>
            )}
          </StatusCard>

          {link.state.phase !== "idle" && (
            <WhatsAppLinkFlow
              state={link.state}
              onConfirm={link.confirm}
              onCancel={link.cancel}
              onRestart={link.start}
            />
          )}
        </>
      )}

      {state === "linked" && integration && (
        <>
          <StatusCard tone="on" badge={t(`${x}.status.linked`)} title={t(`${x}.connected.title`)} body={t(`${x}.connected.body`)}>
            <Details integration={integration} language={language} />
          </StatusCard>

          {capabilities.can_manage_link && (
            <>
              <WhatsAppPreferences
                key={integration.generation}
                integration={integration}
                api={api}
                accounts={accounts}
                onSaved={(updated) => { replaceIntegration(updated); refresh(); }}
                onDisabled={reload}
              />

              <section className="wa-panel wa-unlink">
                <div>
                  <h3>{t(`${x}.unlink.title`)}</h3>
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
              </section>
            </>
          )}
        </>
      )}

      {capabilities.can_review_drafts && <DraftsEntry language={language} />}

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
