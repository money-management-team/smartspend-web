import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getApiErrorMessage } from "../../features/Dashboards/User/api/apiClient";
import { useEmailVerification } from "./useEmailVerification";

/*
 * "Resend verification email" action: one request at a time, and a
 * `notice` ({ tone: "success" | "error", text }) describing the outcome.
 */
export function useResendVerificationEmail() {
  const { t } = useTranslation();
  const { resend } = useEmailVerification();
  const pendingRef = useRef(false);
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState(null);

  const send = async () => {
    if (pendingRef.current) return;

    pendingRef.current = true;
    setIsSending(true);
    setNotice(null);

    try {
      const response = await resend();

      setNotice({
        tone: "success",
        text:
          response.data?.already_verified === true
            ? t("auth.emailVerification.alreadyVerified")
            : response.message || t("auth.emailVerification.sent"),
      });
    } catch (error) {
      // 401: apiClient already ended the session and the guards redirect.
      if (error?.code !== "UNAUTHENTICATED") {
        setNotice({
          tone: "error",
          // 422 = the account has no email; its field message says so.
          text: error?.errors?.email?.[0] ?? getApiErrorMessage(error, t),
        });
      }
    } finally {
      pendingRef.current = false;
      setIsSending(false);
    }
  };

  return { send, isSending, notice, clearNotice: () => setNotice(null) };
}
