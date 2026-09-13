import { useEffect, useEffectEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useParams } from "react-router-dom";

import { useAuthContext } from "../../../contexts/auth/useAuthContext";
import { useEmailVerification } from "../../../contexts/emailVerification/useEmailVerification";
import { useResendVerificationEmail } from "../../../contexts/emailVerification/useResendVerificationEmail";
import { PATH } from "../../../routes/Path";
import { authApi } from "../../Dashboards/User/api/authApi";
import { getApiErrorMessage } from "../../Dashboards/User/api/apiClient";

import AuthAlert from "../components/AuthAlert/AuthAlert";
import AuthBackLink from "../components/AuthBackLink/AuthBackLink";
import AuthButton from "../components/AuthButton/AuthButton";
import AuthHeading from "../components/AuthHeading/AuthHeading";
import { CheckIcon, MailIcon } from "../components/AuthIcons";
import AuthPromo from "../components/AuthPromo/AuthPromo";

// Problems with the link itself; asking for a new link is the way forward.
const LINK_ERROR_KEYS = {
  FORBIDDEN: "auth.verifyEmail.errors.invalidLink",
  NOT_FOUND: "auth.verifyEmail.errors.notFound",
  VALIDATION_ERROR: "auth.verifyEmail.errors.emailChanged",
};

/*
 * One request per link, even when an effect runs twice (StrictMode) or the
 * page remounts: verifying again would report "already verified" instead of
 * the real outcome. Failed attempts are forgotten so "Try again" re-sends.
 */
const verificationRequests = new Map();

function verifyEmailOnce(link) {
  if (!verificationRequests.has(link.key)) {
    verificationRequests.set(
      link.key,
      authApi.verifyEmail(link).catch((error) => {
        verificationRequests.delete(link.key);
        throw error;
      }),
    );
  }

  return verificationRequests.get(link.key);
}

export default function VerifyEmail() {
  const { t } = useTranslation();
  const { id = "", hash = "" } = useParams();
  const { search } = useLocation();
  const { isAuthenticated } = useAuthContext();
  const { refresh: refreshEmailStatus } = useEmailVerification();
  const resendAction = useResendVerificationEmail();

  const query = new URLSearchParams(search);
  const isLinkComplete = Boolean(
    id && hash && query.get("expires") && query.get("signature"),
  );
  const linkKey = `${id}/${hash}${search}`;

  const [outcome, setOutcome] = useState({ key: null });
  const [attempt, setAttempt] = useState(0);

  const onVerified = useEffectEvent(() => {
    // Signed in: update the shared status so the dashboard warning goes away.
    if (isAuthenticated) refreshEmailStatus();
  });

  useEffect(() => {
    if (!isLinkComplete) return undefined;

    let active = true;

    verifyEmailOnce({ key: linkKey, id, hash, search })
      .then((response) => {
        if (!active) return;
        setOutcome({
          key: linkKey,
          phase: "success",
          alreadyVerified: response.data?.already_verified === true,
        });
        onVerified();
      })
      .catch((error) => {
        if (active) setOutcome({ key: linkKey, phase: "error", error });
      });

    return () => {
      active = false;
    };
  }, [attempt, hash, id, isLinkComplete, linkKey, search]);

  const phase = !isLinkComplete
    ? "invalid"
    : outcome.key === linkKey
      ? outcome.phase
      : "loading";

  const retry = () => {
    setOutcome({ key: null });
    setAttempt((current) => current + 1);
  };

  const homePath = isAuthenticated ? PATH.USER.DASHBOARD : PATH.AUTH.SIGNIN;
  const homeLabel = t(
    isAuthenticated
      ? "auth.verifyEmail.actions.dashboard"
      : "auth.verifyEmail.actions.signin",
  );

  let heading;
  let body;
  let showBackLink = false;

  if (phase === "loading") {
    heading = (
      <AuthHeading
        icon={<MailIcon />}
        title={t("auth.verifyEmail.loading.title")}
        subtitle={t("auth.verifyEmail.loading.subtitle")}
      />
    );
    body = (
      <AuthButton
        type="button"
        loading
        loadingLabel={t("auth.verifyEmail.loading.label")}
      />
    );
  } else if (phase === "success") {
    const variant = outcome.alreadyVerified ? "alreadyVerified" : "success";

    heading = (
      <AuthHeading
        tone="success"
        icon={<CheckIcon />}
        title={t(`auth.verifyEmail.${variant}.title`)}
        subtitle={t(`auth.verifyEmail.${variant}.subtitle`)}
      />
    );
    body = <AuthButton to={homePath}>{homeLabel}</AuthButton>;
  } else {
    const errorCode = outcome.error?.code;
    const isLinkProblem =
      phase === "invalid" || Boolean(LINK_ERROR_KEYS[errorCode]);
    // A guest with a bad link already gets "Sign in" as the main action.
    showBackLink = isAuthenticated || !isLinkProblem;
    const message =
      phase === "invalid"
        ? t(LINK_ERROR_KEYS.FORBIDDEN)
        : LINK_ERROR_KEYS[errorCode]
          ? t(LINK_ERROR_KEYS[errorCode])
          : getApiErrorMessage(outcome.error, t);

    heading = (
      <AuthHeading
        icon={<MailIcon />}
        title={t("auth.verifyEmail.error.title")}
      />
    );
    body = (
      <>
        <AuthAlert>{message}</AuthAlert>

        {resendAction.notice && (
          <AuthAlert
            variant={resendAction.notice.tone === "success" ? "success" : "error"}
          >
            {resendAction.notice.text}
          </AuthAlert>
        )}

        {!isLinkProblem ? (
          // Network, timeout, rate limit, server: the same link may still work.
          <AuthButton type="button" onClick={retry}>
            {t("common.retry")}
          </AuthButton>
        ) : isAuthenticated ? (
          <AuthButton
            type="button"
            onClick={resendAction.send}
            loading={resendAction.isSending}
            loadingLabel={t("auth.emailVerification.sending")}
          >
            {t("auth.emailVerification.resend")}
          </AuthButton>
        ) : (
          <AuthButton to={PATH.AUTH.SIGNIN}>
            {t("auth.verifyEmail.actions.signinToResend")}
          </AuthButton>
        )}
      </>
    );
  }

  return (
    <>
      <AuthPromo
        title={t("auth.verifyEmail.promo.title")}
        subtitle={t("auth.verifyEmail.promo.subtitle")}
      />

      <section className="auth-panel" aria-busy={phase === "loading"}>
        {heading}

        <div className="auth-form">{body}</div>

        {showBackLink && <AuthBackLink to={homePath}>{homeLabel}</AuthBackLink>}
      </section>
    </>
  );
}
