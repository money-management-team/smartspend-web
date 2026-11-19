import { useCallback, useEffect, useRef, useState } from "react";

import { sendForgotPassword, sendResetPassword, sendVerificationResend } from "../data/writeApi.js";
import { isWriteOpen } from "../data/writeGate.js";
import { failureKind, retryAfterSeconds } from "../models/authRecovery.js";

/*
 * The one place the recovery screens send from (and, with the other hooks listed in tests/mobileReadOnly.test.mjs, one of the
 * few files that may import the write facade). Each operation is CLOSED by data/writeGate.js: while it is, `closed` is true,
 * the screens do not offer to send, and `run` would throw WriteClosedError inside the facade before a request exists.
 *
 * `run` never throws. It answers { ok: true, data } or { ok: false, kind, seconds } where `kind` is models/authRecovery.js
 * failureKind and `seconds` is the wait after a 429. It answers { ok: false, kind: "busy" } to a second call while the first is
 * on its way, so a double tap or a double submit sends one request. Nothing is retried, and nothing the person typed (a
 * password, a token, an email address) is kept here or logged: it is passed to the facade and forgotten.
 */
const SENDERS = Object.freeze({
  "auth.forgotPassword": sendForgotPassword,
  "auth.resetPassword": sendResetPassword,
  "email.resend": sendVerificationResend,
});

export function useAuthWrite(operation) {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const closed = !isWriteOpen(operation);

  const run = useCallback(
    async (...args) => {
      if (running.current) return { ok: false, kind: "busy" };
      running.current = true;
      setBusy(true);
      try {
        const response = await SENDERS[operation](...args);
        return { ok: true, data: response?.data ?? null };
      } catch (error) {
        const kind = failureKind(error);
        return { ok: false, kind, seconds: kind === "rate" ? retryAfterSeconds(error) : 0 };
      } finally {
        running.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [operation],
  );

  return { closed, busy, run };
}

/*
 * A countdown in whole seconds, for the wait after a 429 or after a request that may have sent an email. In memory only:
 * leaving the screen forgets it, and the server's own limit still applies.
 */
export function useCooldown() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!until) return undefined;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= until) setUntil(0);
    }, 500);
    return () => clearInterval(timer);
  }, [until]);

  const start = useCallback((seconds) => {
    const current = Date.now();
    setNow(current);
    setUntil(current + Math.max(1, seconds) * 1000);
  }, []);

  return [until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0, start];
}
