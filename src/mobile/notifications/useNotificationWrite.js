import { useCallback, useEffect, useRef, useState } from "react";

import { keys, loadUnreadCount } from "../data/loaders.js";
import { sendNotificationRead, sendNotificationsReadAll } from "../data/writeApi.js";
import { useIdentityGuard } from "../identity/guardContext.js";
import { useResourceStore } from "../identity/storeContext.js";
import { notificationWriteOutcome, readAllProof, readProof } from "../models/notificationWrites.js";

const IDLE = Object.freeze({ phase: "idle", target: null, outcome: null });

/*
 * Marking notifications read on Mobile: one at a time, or all of them. Both writes are closed by data/writeGate.js
 * unless approved; the screen shows the closed explanation then, and this hook is never called.
 *
 *   idle -> sending -> confirmed | rejected | unknown
 *
 * The rules this hook is the only place for:
 *   - ONE request at a time for the whole screen. `busy` is set synchronously, before anything is awaited, so a
 *     second tap (on the same row, another row, or Mark all) does nothing until the answer arrives.
 *   - Nothing is ever sent again by itself: no retry after a timeout, after the network comes back or in the
 *     background. Both writes are "same-result" on the backend, so a person may try again by hand.
 *   - The unread count shown afterwards is the server's own, from the write's answer (models/notificationWrites.js);
 *     it is never decremented here. The rows are read again so their read state is the server's too.
 *   - After an unknown outcome or a 404, what the screen holds may be out of date: the unread count and the rows are
 *     read again (GETs). After a 403, 429 or a closed gate nothing changed and nothing is re-read.
 *   - The identity guard is asserted in the turn the request leaves and again when the answer arrives. If the identity
 *     changed, nothing is claimed: the app's boundary has already replaced the screen.
 */
export function useNotificationWrite({ onRowsStale } = {}) {
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

  const run = useCallback(
    async (target, send, prove) => {
      if (busy.current) return;
      busy.current = true;
      setState({ phase: "sending", target, outcome: null });

      let outcome;
      try {
        guard.assert();
        const response = await send();
        guard.assert();
        const proof = prove(response?.data);
        outcome = proof ? { kind: "confirmed", target, proof } : { kind: "unknown", target, code: "UNCONFIRMED" };
      } catch (error) {
        outcome = guard.check() ? { ...notificationWriteOutcome(error), target } : { kind: "identity" };
      }

      if (outcome.kind === "identity") return;
      busy.current = false;

      if (!store.isDisposed()) {
        if (outcome.kind === "confirmed") store.accept(keys.unreadCount, { unread_count: outcome.proof.unreadCount });
        else if (outcome.kind === "unknown" || outcome.code === "NOT_FOUND") store.load(keys.unreadCount, loadUnreadCount);
      }
      if (outcome.kind === "confirmed" || outcome.kind === "unknown" || outcome.code === "NOT_FOUND") onRowsStale?.();

      if (alive.current) setState({ phase: outcome.kind, target, outcome });
    },
    [guard, store, onRowsStale],
  );

  const markRead = useCallback((id) => run(String(id), () => sendNotificationRead(id), (data) => readProof(data, id)), [run]);
  const markAllRead = useCallback(() => run("all", () => sendNotificationsReadAll(), readAllProof), [run]);

  return { ...state, sending: state.phase === "sending", markRead, markAllRead };
}
