import { useContext, useMemo, useState } from "react";
import { LuBell, LuCoins, LuEyeOff, LuInfo, LuKeyRound, LuLifeBuoy, LuLock, LuLogOut, LuMail, LuMessageCircle, LuPalette, LuShieldCheck, LuUser, LuUserPen } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

import { useAuthContext } from "../../contexts/auth/useAuthContext";
import { EmailVerificationContext } from "../../contexts/emailVerification/emailVerificationContext.js";
import { PATH, getSettingsTabPath } from "../../routes/Path.js";
import { assistKeys, loadNotificationPreferences } from "../data/assistLoaders.js";
import { sessionWorkspace } from "../data/readApi.js";
import { useResource } from "../data/useResource.js";
import { isWriteOpen } from "../data/writeGate.js";
import { FormWithChoices } from "../forms/MobileWorkflow.jsx";
import { todayIn } from "../forms/validation.js";
import { WORKFLOWS } from "../forms/workflows.js";
import { useAuthWrite, useCooldown } from "../auth/useAuthWrite.js";
import useSignOut from "../auth/useSignOut.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { buildNotificationPreferences } from "../models/assist.js";
import { preferenceMessageKey } from "../models/preferenceWrites.js";
import { textOrNull } from "../models/values.js";
import { formatMoment } from "../money/format.js";
import { useMoneyHidden, useMoneyHiddenToggle } from "../money/privacyContext.js";
import { MOBILE_NOTIFICATIONS, MOBILE_PASSWORD, MOBILE_PROFILE, MOBILE_PROFILE_EDIT, MOBILE_WHATSAPP, backPathFrom } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";
import DisplayChoices from "../ui/DisplayChoices.jsx";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import LabelledGroup, { GroupLink } from "../ui/LabelledGroup.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import { emailState } from "./emailState.js";
import { usePreferenceWrite } from "./usePreferenceWrite.js";

const localeOf = (i18n) => (i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en");

// The signed-in person as the shared AuthProvider holds them. Mobile reads this; it never writes the session.
const personOf = (user) => ({ id: String(user?.id ?? ""), name: textOrNull(user?.name, 255) ?? "", email: textOrNull(user?.email, 255) ?? "", phone: textOrNull(user?.phone, 30) ?? "" });

/*
 * The email status comes from the app's EmailVerificationProvider, the single
 * owner of GET /auth/email/status. "Check again" re-reads it (a GET); sending a
 * new verification email is a write (closed), see ResendVerification below.
 * Outside that provider (it is always there in the app) the status is unknown.
 */
function EmailStatus({ verification, state }) {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const status = verification?.status ?? null;

  return (
    <div className="sm-setting" data-sm-section="email" data-sm-email={state}>
      <h3 className="sm-row-title">{t("profile.emailTitle")}</h3>
      <p className="sm-text sm-muted">{t(`profile.email.${state}`)}</p>
      {state === "verified" && status?.verifiedAt && <p className="sm-text sm-muted sm-fine"><bdi>{formatMoment(status.verifiedAt, localeOf(i18n))}</bdi></p>}
      {verification && state !== "loading" && (
        <button type="button" className="sm-button sm-button-quiet sm-button-small sm-setting-action" onClick={() => verification.refresh?.()} data-sm-action="check-email">{t("profile.checkAgain")}</button>
      )}
      {state === "unverified" && <ResendVerification verification={verification} />}
    </div>
  );
}

/*
 * Sending a new verification email (POST /auth/email/verification-notification, the write "email.resend", CLOSED). While it is
 * closed the control is disabled and says so, with the full version as the way to do it. The answers are described by their
 * code (models/authRecovery.js): "already verified" re-reads the status; a 429 waits as long as the server says; a request
 * whose outcome is unknown is said to be unknown (an email may have been sent) and waits a minute before another; nothing is
 * retried for the person. The link in the email is the backend's own address (docs/mobile/AUTH-RECOVERY.md): "Check again"
 * is how the new status is read once the person has opened it.
 */
function ResendVerification({ verification }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const { closed, busy, run } = useAuthWrite("email.resend");
  const [result, setResult] = useState(null);
  const [wait, startWait] = useCooldown();

  const send = async () => {
    if (closed || busy || wait > 0) return;
    setResult(null);
    const outcome = await run();
    if (outcome.kind === "busy") return;
    if (outcome.ok) {
      if (outcome.data?.already_verified === true) {
        setResult({ kind: "already" });
        verification?.refresh?.();
      } else {
        setResult({ kind: "sent" });
        startWait(60);
      }
    } else if (outcome.kind === "rate") {
      setResult({ kind: "rate", seconds: outcome.seconds });
      startWait(outcome.seconds);
    } else if (outcome.kind === "unknown") {
      setResult({ kind: "unknown" });
      startWait(60);
    } else {
      // A 422 here is "no email on this account" (the only refusal the endpoint documents).
      setResult({ kind: outcome.kind === "invalid" ? "noEmail" : outcome.kind === "session" || outcome.kind === "forbidden" ? outcome.kind : "failed" });
    }
  };

  return (
    <>
      {closed && (
        <>
          <p className="sm-draft-note" role="note" data-sm-note="write-closed" data-sm-write="email.resend"><LuInfo aria-hidden="true" /><span>{t("profile.resendClosed")}</span></p>
          <Link className="sm-link-row sm-setting-link" to={getSettingsTabPath("profile")}>
            <span>{t("profile.resendFull")}</span>
            <Chevron />
          </Link>
        </>
      )}
      <button type="button" className="sm-button sm-button-small sm-setting-action" onClick={send} disabled={closed || busy || wait > 0} aria-busy={busy} data-sm-action="resend-verification">
        {busy ? t("profile.resend.busy") : wait > 0 ? t("profile.resend.wait", { seconds: wait }) : t("profile.resend.action")}
      </button>
      {result && <p className="sm-text sm-muted" role={result.kind === "sent" || result.kind === "already" ? "status" : "alert"} data-sm-resend={result.kind}>{t(`profile.resend.${result.kind}`, { seconds: result.seconds })}</p>}
    </>
  );
}

/* "Hide amounts": the full version's own device preference, shown here too. Nothing leaves this device. */
function PrivacySetting() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const hidden = useMoneyHidden();
  const setHidden = useMoneyHiddenToggle();
  if (!setHidden) return null;

  return (
    <div className="sm-setting" data-sm-section="privacy">
      <label className="sm-choice">
        <input type="checkbox" checked={hidden === true} onChange={(event) => setHidden(event.target.checked)} data-sm-pref="hide-amounts" />
        <span className="sm-setting-choice">
          <span className="sm-row-title">{t("settings.hideAmounts")}</span>
          <span className="sm-row-meta">{t("settings.hideAmountsHint")}</span>
        </span>
      </label>
    </div>
  );
}

/*
 * The one notification preference there is (savings installment reminders). The switch is a draft until it is saved.
 * While the write gate keeps PATCH /notifications/preferences closed (data/writeGate.js, the default), Save is disabled
 * and says so. Once approved, Save sends the explicit value wanted (usePreferenceWrite.js) and what is shown as saved is
 * the server's answer; a refusal or an unknown outcome never shows the draft as saved.
 */
function NotificationPreferences() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const resource = useResource(assistKeys.notificationPreferences, loadNotificationPreferences);
  const saveOpen = isWriteOpen("notifications.preferences");
  const write = usePreferenceWrite();
  const prefs = useMemo(() => {
    if (resource.data === undefined) return null;
    try {
      return buildNotificationPreferences(resource.data);
    } catch {
      return null;
    }
  }, [resource.data]);
  const [draft, setDraft] = useState(null);
  const shown = draft ?? prefs?.reminders ?? false;
  const pending = prefs !== null && draft !== null && draft !== prefs.reminders;
  const messageKey = write.saving ? null : preferenceMessageKey(write.outcome);

  const saveDraft = async () => {
    const outcome = await write.save(draft);
    // Only a confirmed answer ends the draft: the switch then shows the server's saved value.
    if (outcome?.kind === "confirmed") setDraft(null);
  };

  return (
    <div className="sm-setting" data-sm-section="notification-preferences">
      {resource.loading ? (
        <Skeleton lines={2} label={t("profile.loadingPreferences")} />
      ) : resource.status === "error" || !prefs ? (
        <ErrorPanel error={resource.error ?? { code: "MALFORMED_RESPONSE" }} onRetry={resource.reload} retrying={resource.refreshing} compact />
      ) : (
        <>
          <label className="sm-choice">
            <input
              type="checkbox"
              checked={shown === true}
              disabled={prefs.reminders === null || write.saving}
              onChange={(event) => {
                setDraft(event.target.checked);
                write.reset();
              }}
              data-sm-pref="savings_installment_reminders"
              data-sm-saved={prefs.reminders === null ? "unknown" : String(prefs.reminders)}
            />
            <span>{t("profile.reminders")}</span>
          </label>
          {prefs.available === false && <p className="sm-text sm-muted sm-fine" data-sm-note="reminders-off">{t("profile.remindersUnavailable")}</p>}
          <p className="sm-text sm-muted sm-fine">{t("profile.channels")}</p>
          {saveOpen && pending && (
            <div className="sm-pref-draft" data-sm-section="preference-draft">
              <p className="sm-text">{t("profile.prefsWrite.unsaved")}</p>
              <div className="sm-actions">
                <button type="button" className="sm-button" disabled={write.saving} aria-busy={write.saving || undefined} onClick={saveDraft} data-sm-action="save-preferences">
                  {t(write.saving ? "profile.prefsWrite.saving" : "profile.save")}
                </button>
                <button type="button" className="sm-button sm-button-quiet" disabled={write.saving} onClick={() => setDraft(null)} data-sm-action="undo-preferences">{t("profile.undo")}</button>
              </div>
            </div>
          )}
          {saveOpen && messageKey && (
            <p className="sm-text sm-fine" role={write.phase === "confirmed" ? "status" : "alert"} data-sm-pref-outcome={write.phase} data-sm-pref-code={write.outcome?.code ?? undefined}>
              {messageKey === "closed" ? t("profile.prefsNotSaved") : t(`profile.prefsWrite.${messageKey}`)}
            </p>
          )}
          {!saveOpen && pending && (
            <div role="note" data-sm-note="write-closed" data-sm-write="notifications.preferences">
              <p className="sm-text">{t("profile.prefsNotSaved")}</p>
              <div className="sm-actions">
                <button type="button" className="sm-button" disabled data-sm-action="save-preferences">{t("profile.save")}</button>
                <button type="button" className="sm-button sm-button-quiet" onClick={() => setDraft(null)} data-sm-action="undo-preferences">{t("profile.undo")}</button>
              </div>
            </div>
          )}
          <Link className="sm-link-row sm-setting-link" to={getSettingsTabPath("preferences")}>
            <span>{t("profile.prefsFull")}</span>
            <Chevron />
          </Link>
        </>
      )}
    </div>
  );
}

/*
 * Sign out, last on the page. One real button that ends this session through the app's own sign-out (auth/useSignOut.js):
 * it says what it does, is disabled and busy while the request is on its way, and its progress is announced. What
 * happened is said on the sign-in page it leads to.
 */
function SignOut() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const { signOut, busy } = useSignOut();

  return (
    <LabelledGroup title={t("settings.groups.session")} icon={LuLogOut} data-sm-group="session">
      <div className="sm-setting" data-sm-section="sign-out">
        <p className="sm-text sm-muted">{t("settings.signOutHint")}</p>
        <button type="button" className="sm-button sm-button-quiet sm-signout" onClick={signOut} disabled={busy} aria-busy={busy || undefined} data-sm-action="sign-out">
          <LuLogOut aria-hidden="true" />
          <span>{t(busy ? "settings.signingOut" : "settings.signOut")}</span>
        </button>
        <p className="sm-sr" role="status" aria-live="polite">{busy ? t("settings.signingOutStatus") : ""}</p>
      </div>
    </LabelledGroup>
  );
}

/*
 * Profile and settings on Mobile, in groups: who is signed in (with the email's status), the account, appearance and
 * language, currency and region, privacy on this device, notifications, security, and help. Everything that is read comes from the shared session or an existing GET.
 * The profile and password forms can be filled in and reviewed but are saved in the full version, and they say so.
 * Signing out is real: it is the app's own sign-out, last on the page. Language and theme are the same controls as More and the app bar.
 */
export default function MobileProfile() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const { user, workspace } = useAuthContext();
  const verification = useContext(EmailVerificationContext);
  const state = emailState(verification);
  const person = personOf(user);
  const workspaceName = textOrNull(workspace?.name, 120);
  const initial = person.name ? [...person.name][0].toLocaleUpperCase() : "·";
  const timezone = textOrNull(workspace?.timezone ?? user?.timezone, 64);
  // Hide amounts exists only where the app's privacy provider does; without it there is no group to show.
  const canHideAmounts = Boolean(useMoneyHiddenToggle());

  return (
    <section className="sm-page" data-sm-screen="profile">
      <section className="sm-card sm-identity sm-profile-hero" aria-labelledby="sm-profile-who" data-sm-section="identity">
        <span className="sm-avatar sm-avatar-large" aria-hidden="true">{initial}</span>
        <div className="sm-identity-main">
          <h2 id="sm-profile-who" className="sm-identity-name sm-user-text"><span className="sm-sr">{t("profile.who")}: </span>{person.name || t("forms.notSet")}</h2>
          <p className="sm-row-meta sm-identity-email"><bdi dir="ltr">{person.email || t("forms.notSet")}</bdi></p>
          <span className="sm-chip sm-identity-chip" data-sm-chip={state}>{t(`settings.chip.${state}`)}</span>
        </div>
      </section>

      <LabelledGroup title={t("settings.groups.account")} icon={LuUser} data-sm-group="account">
        <div className="sm-setting" data-sm-section="workspace">
          <dl className="sm-stats sm-stats-stacked">
            <div className="sm-stat"><dt>{t("forms.fields.phone")}</dt><dd><bdi dir="ltr">{person.phone || t("forms.notSet")}</bdi></dd></div>
            {workspaceName && <div className="sm-stat"><dt>{t("profile.workspace")}</dt><dd><bdi dir="auto" className="sm-user-text">{workspaceName}</bdi></dd></div>}
          </dl>
        </div>
        <GroupLink to={MOBILE_PROFILE_EDIT} state={{ from: MOBILE_PROFILE }} icon={LuUserPen} title={t("settings.editProfile")} hint={t("settings.editProfileHint")} data-sm-action="profile-edit" />
      </LabelledGroup>

      <LabelledGroup title={t("settings.groups.appearance")} icon={LuPalette} data-sm-group="appearance">
        <div className="sm-setting" data-sm-section="display">
          <DisplayChoices />
          <p className="sm-draft-note" role="note" data-sm-note="device-only"><LuInfo aria-hidden="true" /><span>{t("settings.deviceNote")}</span></p>
        </div>
      </LabelledGroup>

      <LabelledGroup title={t("settings.groups.region")} icon={LuCoins} data-sm-group="region">
        {workspace?.base_currency_code && (
          <div className="sm-setting" data-sm-section="currency">
            <dl className="sm-stats sm-stats-stacked">
              <div className="sm-stat"><dt>{t("profile.baseCurrency")}</dt><dd><bdi dir="ltr">{workspace.base_currency_code}</bdi></dd></div>
            </dl>
          </div>
        )}
        <div className="sm-setting" data-sm-section="timezone">
          <dl className="sm-stats sm-stats-stacked">
            <div className="sm-stat"><dt>{t("profile.timezone")}</dt><dd><bdi dir="ltr">{timezone ?? t("forms.notSet")}</bdi></dd></div>
          </dl>
          <Link className="sm-link-row sm-setting-link" to={getSettingsTabPath("preferences")}>
            <span>{t("settings.timezoneFull")}</span>
            <Chevron />
          </Link>
        </div>
      </LabelledGroup>

      {canHideAmounts && (
        <LabelledGroup title={t("settings.groups.privacy")} icon={LuEyeOff} data-sm-group="privacy">
          <PrivacySetting />
        </LabelledGroup>
      )}

      <LabelledGroup title={t("settings.groups.notifications")} icon={LuBell} data-sm-group="notifications">
        <NotificationPreferences />
        <GroupLink to={MOBILE_NOTIFICATIONS} icon={LuBell} title={t("settings.inbox")} hint={t("settings.inboxHint")} />
        <GroupLink to={MOBILE_WHATSAPP} icon={LuMessageCircle} title={t("settings.whatsapp")} hint={t("settings.whatsappHint")} />
      </LabelledGroup>

      <LabelledGroup title={t("settings.groups.security")} icon={LuShieldCheck} data-sm-group="security">
        <GroupLink to={MOBILE_PASSWORD} state={{ from: MOBILE_PROFILE }} icon={LuKeyRound} title={t("settings.changePassword")} hint={t("settings.changePasswordHint")} data-sm-action="password-change" />
        <EmailStatus verification={verification} state={state} />
        <GroupLink to={getSettingsTabPath("security")} icon={LuShieldCheck} title={t("settings.securityFull")} hint={t("settings.securityFullHint")} />
        <div className="sm-setting" data-sm-section="session">
          <p className="sm-draft-note" role="note" data-sm-note="password-note"><LuInfo aria-hidden="true" /><span>{t("settings.passwordNote")}</span></p>
        </div>
      </LabelledGroup>

      <LabelledGroup title={t("settings.groups.help")} icon={LuLifeBuoy} data-sm-group="help">
        <GroupLink to={PATH.PUBLIC.SUPPORT} icon={LuLifeBuoy} title={t("settings.help")} />
        <GroupLink to={PATH.PUBLIC.CONTACT} icon={LuMail} title={t("settings.contact")} />
        <GroupLink to={PATH.PUBLIC.SECURITY} icon={LuLock} title={t("settings.privacy")} />
      </LabelledGroup>

      <SignOut />
    </section>
  );
}

/* The profile and password forms: the record they start from is the signed-in person (no read needed). */
export function MobileProfileForm({ workflowId }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const { user } = useAuthContext();
  const location = useLocation();
  const workflow = WORKFLOWS[workflowId];
  const record = useMemo(() => personOf(user), [user]);
  const ctx = useMemo(() => ({ today: todayIn(sessionWorkspace()?.timezone), record }), [record]);
  const backTo = backPathFrom(location.state, MOBILE_PROFILE);

  return (
    <section className="sm-page" data-sm-screen="workflow" data-sm-workflow={workflow.id}>
      <Link className="sm-link-row sm-back" to={backTo}>
        <Chevron back />
        <span>{t("forms.back")}</span>
      </Link>
      {/* The page's title is the app bar's; only what the form is for is said here. */}
      <p className="sm-text sm-muted sm-flow-intro">{t(`forms.flows.${workflow.id}.intro`)}</p>
      <FormWithChoices key={`${workflow.id}:${record.id}`} workflow={workflow} ctx={ctx} backTo={backTo} />
    </section>
  );
}
