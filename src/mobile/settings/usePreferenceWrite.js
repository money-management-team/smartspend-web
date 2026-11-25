import { useCallback, useEffect, useRef, useState } from "react";

import { assistKeys, loadNotificationPreferences } from "../data/assistLoaders.js";
import { sendNotificationPreferences } from "../data/writeApi.js";
import { useIdentityGuard } from "../identity/guardContext.js";
import { useResourceStore } from "../identity/storeContext.js";
import { preferenceWriteOutcome, preferencesAnswer } from "../models/preferenceWrites.js";

const IDLE = Object.freeze({ phase: "idle", outcome: null });

/*
 * Saving the savings reminder preference on Mobile. Closed by data/writeGate.js unless approved; the screen shows the
 * closed draft then, and this hook is never called.
 *
 *   idle -> saving -> confirmed | rejected | unknown
 *
 *   - ONE request at a time: `busy` is set synchronously, before anything is awaited.
 *   - The value sent is the explicit one wanted (true or false), never a toggle, so a request delivered twice leaves
 *     the same setting. Nothing is ever resent by itself; saving again by hand is safe.
 *   - What the screen shows as saved is the server's answer only: on success the answer goes into the same store entry
 *     the screen reads (resourceStore.accept). A refusal changes nothing saved. After an unknown outcome the preference
 *     is read again (a GET), so the saved state shown is the server's, whatever happened.
 *   - The identity guard is asserted in the turn the request leaves and again when the answer arrives.
 */
export function usePreferenceWrite() {
  const guard = useIdentityGuard();
  const store = useResourceStore();
  const busy = useRef(false);
  const alive = useRef(true);
  const [state, setState] = useState(IDLE);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const save = useCallback(
    async (wanted) => {
      if (busy.current) return null;
      busy.current = true;
      setState({ phase: "saving", outcome: null });

      let outcome;
      try {
        guard.assert();
        const response = await sendNotificationPreferences({ savings_installment_reminders: wanted });
        guard.assert();
        const answer = preferencesAnswer(response?.data);
        if (!answer) outcome = { kind: "unknown", code: "UNCONFIRMED" };
        else if (answer.reminders === wanted) outcome = { kind: "confirmed", answer };
        else outcome = { kind: "unknown", code: "DIFFERENT_VALUE", answer };
      } catch (error) {
        outcome = guard.check() ? preferenceWriteOutcome(error) : { kind: "identity" };
      }

      if (outcome.kind === "identity") return null;
      busy.current = false;

      if (!store.isDisposed()) {
        if (outcome.answer) store.accept(assistKeys.notificationPreferences, outcome.answer.data);
        else if (outcome.kind === "unknown") store.load(assistKeys.notificationPreferences, loadNotificationPreferences);
      }

      if (alive.current) setState({ phase: outcome.kind, outcome });
      return outcome;
    },
    [guard, store],
  );

  const reset = useCallback(() => {
    if (!busy.current) setState(IDLE);
  }, []);

  return { ...state, saving: state.phase === "saving", save, reset };
}
