import { useCallback, useEffect, useReducer, useRef } from "react";

import { whatsappApi } from "../../../api/whatsappApi.js";
import {
  classifyWhatsAppError,
  parseCreatedChallengeResponse,
  parseIntegrationResponse,
} from "../../../FinancialOperations/whatsappContract.js";
import {
  createChallengePoller,
  initialLinkState,
  linkReducer,
} from "./whatsappLinking.js";

/*
 * Drives the linking flow: create a challenge, poll it, and confirm it only
 * when the user asks. State is local to the component; the link token is kept
 * in that state alone and is dropped on reset, expiry, success and unmount.
 *
 * `onLinked(integration)` runs after the backend confirmed the link.
 * `onDisabled()` runs when any call answers 409 `whatsapp_disabled`.
 */
export function useWhatsAppLinking({ onLinked, onDisabled, api = whatsappApi, createPoller = createChallengePoller } = {}) {
  const [state, dispatch] = useReducer(linkReducer, initialLinkState);
  const pollerRef = useRef(null);
  const requestRef = useRef(null);
  const busyRef = useRef(false);
  const callbacks = useRef({ onLinked, onDisabled });

  useEffect(() => {
    callbacks.current = { onLinked, onDisabled };
  });

  const stopAll = useCallback(() => {
    pollerRef.current?.stop();
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);

  // Leaving the page, or the tab, cancels everything in flight.
  useEffect(() => stopAll, [stopAll]);

  const fail = useCallback((context, error, type = "failed") => {
    if (classifyWhatsAppError(error) === "disabled") callbacks.current.onDisabled?.();
    dispatch({ type, error: { context, error } });
  }, []);

  const start = useCallback(async () => {
    if (busyRef.current) return; // one challenge request at a time
    busyRef.current = true;
    stopAll();
    dispatch({ type: "create" });

    const controller = new AbortController();
    requestRef.current = controller;

    try {
      const created = parseCreatedChallengeResponse(
        await api.createLinkChallenge({ signal: controller.signal }),
      );
      if (controller.signal.aborted) return;

      dispatch({ type: "created", challenge: created.challenge, linking: created.linking });
      if (created.challenge.sender_verified) return;

      pollerRef.current = createPoller({
        fetchChallenge: (token, options) => api.getLinkChallenge(token, options),
        onUpdate: (challenge) => dispatch({ type: "challenge", challenge }),
        onStop: (reason, error) => {
          if (reason === "deadline") dispatch({ type: "deadline" });
          else if (reason === "fatal" || reason === "transient") fail("poll", error);
        },
      });
      pollerRef.current.start(created.linking.token, { expiresAt: created.challenge.expires_at });
    } catch (error) {
      if (error?.name === "AbortError") return;
      fail("create", error);
    } finally {
      busyRef.current = false;
    }
  }, [api, createPoller, fail, stopAll]);

  const confirm = useCallback(async () => {
    const token = state.linking?.token;
    if (!token || state.phase !== "verified" || busyRef.current) return;
    busyRef.current = true;
    pollerRef.current?.stop();
    dispatch({ type: "confirm" });

    const controller = new AbortController();
    requestRef.current = controller;

    try {
      const integration = parseIntegrationResponse(
        await api.confirmLinkChallenge(token, { signal: controller.signal }),
      );
      if (controller.signal.aborted) return;
      dispatch({ type: "reset" });
      callbacks.current.onLinked?.(integration);
    } catch (error) {
      if (error?.name === "AbortError") return;
      const hopeless = ["disabled", "not_found", "unauthenticated", "forbidden"].includes(classifyWhatsAppError(error));
      fail("confirm", error, hopeless ? "failed" : "confirm-failed");
    } finally {
      busyRef.current = false;
    }
  }, [api, fail, state.linking, state.phase]);

  const cancel = useCallback(() => {
    stopAll();
    busyRef.current = false;
    dispatch({ type: "reset" });
  }, [stopAll]);

  return { state, start, confirm, cancel };
}
