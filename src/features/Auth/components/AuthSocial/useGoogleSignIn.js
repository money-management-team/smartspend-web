import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../../../../contexts/auth/useAuthContext";
import { getApiErrorMessage } from "../../../Dashboards/User/api/apiClient";
import { useReturnPath } from "../../../../routes/useReturnPath";

// Google credentials stay in memory and are dropped on cancellation/unmount.
// Only the explicit policy action can resume a consent-required response.
export default function useGoogleSignIn({
  remember = true,
  acceptedPolicies = false,
  onError,
  onAccepted,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const returnPath = useReturnPath();
  const { loginWithGoogle } = useAuthContext();
  const [busy, setBusy] = useState(false);
  const [needsConsent, setNeedsConsent] = useState(false);
  const intent = useRef(null);
  const inFlight = useRef(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      inFlight.current?.abort();
      inFlight.current = null;
      intent.current = null;
    };
  }, []);

  const submit = async (idToken, consent, rememberChoice) => {
    if (!mounted.current || inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setBusy(true);
    setNeedsConsent(false);
    onError("");
    try {
      await loginWithGoogle(idToken, {
        acceptedPolicies: consent,
        remember: rememberChoice,
        signal: controller.signal,
      });
      if (!mounted.current || controller.signal.aborted) return;
      intent.current = null;
      navigate(returnPath, { replace: true });
    } catch (error) {
      if (
        !mounted.current ||
        controller.signal.aborted ||
        error?.name === "AbortError"
      )
        return;
      if (
        error?.status === 422 &&
        error?.payload?.code === "google_consent_required"
      ) {
        intent.current = { idToken, remember: rememberChoice };
        setNeedsConsent(true);
      } else {
        intent.current = null;
        onError(error?.errors?.id_token?.[0] ?? getApiErrorMessage(error, t));
      }
    } finally {
      if (inFlight.current === controller) {
        inFlight.current = null;
        if (mounted.current) setBusy(false);
      }
    }
  };

  return {
    busy,
    needsConsent,
    handleCredential: (idToken) => {
      if (!needsConsent)
        return submit(idToken, acceptedPolicies === true, remember);
    },
    acceptConsent: () => {
      const current = intent.current;
      if (!current || inFlight.current) return;
      onAccepted?.();
      return submit(current.idToken, true, current.remember);
    },
    cancelConsent: () => {
      intent.current = null;
      setNeedsConsent(false);
    },
  };
}
