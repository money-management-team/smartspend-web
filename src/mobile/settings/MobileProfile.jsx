import { useContext, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

import { useAuthContext } from "../../contexts/auth/useAuthContext";
import { EmailVerificationContext } from "../../contexts/emailVerification/emailVerificationContext.js";
import { PATH, getSettingsTabPath } from "../../routes/Path.js";
import { assistKeys, loadNotificationPreferences } from "../data/assistLoaders.js";
import { sessionWorkspace } from "../data/readApi.js";
import { useResource } from "../data/useResource.js";
import { FormWithChoices } from "../forms/MobileWorkflow.jsx";
import { todayIn } from "../forms/validation.js";
import { WORKFLOWS } from "../forms/workflows.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { buildNotificationPreferences } from "../models/assist.js";
import { textOrNull } from "../models/values.js";
import { formatMoment } from "../money/format.js";
import { MOBILE_MORE, MOBILE_PASSWORD, MOBILE_PROFILE, MOBILE_PROFILE_EDIT, backPathFrom } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import Skeleton from "../ui/Skeleton.jsx";

const localeOf = (i18n) => (i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en");

// The signed-in person as the shared AuthProvider holds them. Mobile reads this; it never writes the session.
const personOf = (user) => ({ id: String(user?.id ?? ""), name: textOrNull(user?.name, 255) ?? "", email: textOrNull(user?.email, 255) ?? "", phone: textOrNull(user?.phone, 30) ?? "" });

/*
 * The email status comes from the app's EmailVerificationProvider, the single
 * owner of GET /auth/email/status. "Check again" re-reads it (a GET); sending a
 * new verification email is a write, so it is offered in the full version.
 * Outside that provider (it is always there in the app) the status is unknown.
 */
function EmailStatus() {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const verification = useContext(EmailVerificationContext);
  const status = verification?.status ?? null;
  const state = !verification ? "unknown" : verification.loading ? "loading" : verification.error ? "error" : status?.verified === true ? "verified" : status?.verified === false ? "unverified" : "unknown";

  return (
    <section className="sm-card" aria-labelledby="sm-email-status" data-sm-section="email" data-sm-email={state}>
      <h2 id="sm-email-status" className="sm-card-title">{t("profile.emailTitle")}</h2>
      <p className="sm-text">{t(`profile.email.${state}`)}</p>
      {state === "verified" && status?.verifiedAt && <p className="sm-text sm-muted sm-fine"><bdi>{formatMoment(status.verifiedAt, localeOf(i18n))}</bdi></p>}
      {verification && state !== "loading" && (
        <button type="button" className="sm-button sm-button-quiet" onClick={() => verification.refresh?.()} data-sm-action="check-email">{t("profile.checkAgain")}</button>
      )}
      {state === "unverified" && (
        <>
          <p className="sm-text sm-muted sm-fine" role="note" data-sm-note="write-closed" data-sm-write="email.resend">{t("profile.resendClosed")}</p>
          <Link className="sm-link-row" to={getSettingsTabPath("profile")}>
            <span>{t("profile.resendFull")}</span>
            <Chevron />
          </Link>
        </>
      )}
    </section>
  );
}

/* The one notification preference there is (savings installment reminders): shown, changeable here, saved in the full version. */
function NotificationPreferences() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const resource = useResource(assistKeys.notificationPreferences, loadNotificationPreferences);
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

  return (
    <section className="sm-card" aria-labelledby={`${ids}-title`} data-sm-section="notification-preferences">
      <h2 id={`${ids}-title`} className="sm-card-title">{t("profile.notificationsTitle")}</h2>
      {resource.loading ? (
        <Skeleton lines={2} label={t("profile.loadingPreferences")} />
      ) : resource.status === "error" || !prefs ? (
        <ErrorPanel error={resource.error ?? { code: "MALFORMED_RESPONSE" }} onRetry={resource.reload} retrying={resource.refreshing} compact />
      ) : (
        <>
          <label className="sm-choice sm-cat-choice">
            <input type="checkbox" checked={shown === true} disabled={prefs.reminders === null} onChange={(event) => setDraft(event.target.checked)} data-sm-pref="savings_installment_reminders" />
            <span>{t("profile.reminders")}</span>
          </label>
          {prefs.available === false && <p className="sm-text sm-muted sm-fine" data-sm-note="reminders-off">{t("profile.remindersUnavailable")}</p>}
          <p className="sm-text sm-muted sm-fine">{t("profile.channels")}</p>
          {draft !== null && draft !== prefs.reminders && (
            <div role="note" data-sm-note="write-closed" data-sm-write="notifications.preferences">
              <p className="sm-text">{t("profile.prefsNotSaved")}</p>
              <div className="sm-actions">
                <button type="button" className="sm-button" disabled data-sm-action="save-preferences">{t("profile.save")}</button>
                <button type="button" className="sm-button sm-button-quiet" onClick={() => setDraft(null)} data-sm-action="undo-preferences">{t("profile.undo")}</button>
              </div>
            </div>
          )}
          <Link className="sm-link-row" to={getSettingsTabPath("preferences")}>
            <span>{t("profile.prefsFull")}</span>
            <Chevron />
          </Link>
        </>
      )}
    </section>
  );
}

/*
 * Profile and settings on Mobile. Who is signed in and in which workspace (from
 * the shared session, read only), the email status, links to the profile and
 * password forms (filled in and reviewed here; saved in the full version), the
 * notification preference, appearance (on More) and help.
 */
export default function MobileProfile() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const { user, workspace } = useAuthContext();
  const person = personOf(user);
  const workspaceName = textOrNull(workspace?.name, 120);

  return (
    <section className="sm-page" data-sm-screen="profile">
      <section className="sm-card" aria-labelledby="sm-profile-who">
        <h2 id="sm-profile-who" className="sm-card-title">{t("profile.who")}</h2>
        <dl className="sm-stats sm-stats-stacked">
          <div className="sm-stat"><dt>{t("forms.fields.name")}</dt><dd><bdi dir="auto" className="sm-user-text">{person.name || t("forms.notSet")}</bdi></dd></div>
          <div className="sm-stat"><dt>{t("forms.fields.email")}</dt><dd><bdi dir="ltr">{person.email || t("forms.notSet")}</bdi></dd></div>
          <div className="sm-stat"><dt>{t("forms.fields.phone")}</dt><dd><bdi dir="ltr">{person.phone || t("forms.notSet")}</bdi></dd></div>
        </dl>
        <Link className="sm-link-row" to={MOBILE_PROFILE_EDIT} state={{ from: MOBILE_PROFILE }} data-sm-action="profile-edit"><span>{t("forms.flows.profile-edit.link")}</span><Chevron /></Link>
        <Link className="sm-link-row" to={MOBILE_PASSWORD} state={{ from: MOBILE_PROFILE }} data-sm-action="password-change"><span>{t("forms.flows.password-change.link")}</span><Chevron /></Link>
      </section>

      <section className="sm-card" aria-labelledby="sm-profile-workspace" data-sm-section="workspace">
        <h2 id="sm-profile-workspace" className="sm-card-title">{t("profile.workspace")}</h2>
        <dl className="sm-stats sm-stats-stacked">
          {workspaceName && <div className="sm-stat"><dt>{t("forms.fields.name")}</dt><dd><bdi dir="auto" className="sm-user-text">{workspaceName}</bdi></dd></div>}
          {workspace?.base_currency_code && <div className="sm-stat"><dt>{t("profile.baseCurrency")}</dt><dd><bdi dir="ltr">{workspace.base_currency_code}</bdi></dd></div>}
          {workspace?.timezone && <div className="sm-stat"><dt>{t("profile.timezone")}</dt><dd><bdi dir="ltr">{workspace.timezone}</bdi></dd></div>}
        </dl>
      </section>

      <EmailStatus />
      <NotificationPreferences />

      <section className="sm-card" aria-labelledby="sm-profile-more">
        <h2 id="sm-profile-more" className="sm-card-title">{t("profile.moreTitle")}</h2>
        <Link className="sm-link-row" to={MOBILE_MORE}><span>{t("profile.appearance")}</span><Chevron /></Link>
        <Link className="sm-link-row" to={getSettingsTabPath("security")}><span>{t("profile.security")}</span><Chevron /></Link>
        <Link className="sm-link-row" to={PATH.PUBLIC.SUPPORT}><span>{t("profile.help")}</span><Chevron /></Link>
        <Link className="sm-link-row" to={PATH.PUBLIC.CONTACT}><span>{t("profile.contact")}</span><Chevron /></Link>
        <Link className="sm-link-row" to={PATH.PUBLIC.SECURITY}><span>{t("profile.privacy")}</span><Chevron /></Link>
      </section>
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
      <div className="sm-card sm-flow-head">
        <h2 className="sm-card-title">{t(`forms.flows.${workflow.id}.title`)}</h2>
        <p className="sm-text sm-muted">{t(`forms.flows.${workflow.id}.intro`)}</p>
      </div>
      <FormWithChoices key={`${workflow.id}:${record.id}`} workflow={workflow} ctx={ctx} backTo={backTo} />
    </section>
  );
}
