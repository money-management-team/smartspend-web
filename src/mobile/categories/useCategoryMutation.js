import { useCallback, useEffect, useRef, useState } from "react";

import { useIdentityGuard } from "../identity/guardContext.js";
import { useResourceStore } from "../identity/storeContext.js";
import { classifyOutcome } from "../models/categoryForm.js";

// What the app has read about categories: forgotten after a write, so the next read is a fresh one.
const isCategoryKey = (key) => key === "categories" || key.startsWith("categoryList:") || key.startsWith("category:");

const EDITING = Object.freeze({ phase: "editing", rejection: null, category: null, code: null });

/*
 * The life of one category write (create or rename):
 *
 *   editing -> submitting -> confirmed | rejected | unknown
 *
 * ("validating" is the synchronous check the form does before it calls start.)
 *
 * The rules this hook is the only place for:
 *
 *   - ONE request per logical submission. `busy` is set synchronously, before
 *     anything is awaited, so a second tap in the same turn does nothing; it is
 *     released only by a rejection (the server looked and refused: the person may
 *     edit and send again, by hand).
 *   - Nothing is ever sent again by itself: no retry after a timeout, after the
 *     network comes back, after the tab returns, in the background. There is no
 *     queue and nothing is kept in storage: the payload lives in the closure of
 *     one call.
 *   - "confirmed" needs proof in the answer (`request.prove`); an answer that
 *     is not that proof is "unknown", because the request may have been processed.
 *   - "unknown" is never shown as a failure, and after it this form sends nothing.
 *   - The identity guard is asserted in the turn the request leaves (so the token
 *     it carries is the one that was checked) and again when the answer arrives.
 *     If the identity changed, nothing is claimed here: the boundary has already
 *     replaced the screen, and cancelling is not claimed to have stopped the server.
 *   - If the person leaves while it is running, the request is not aborted (it is
 *     already on its way) and its answer is not shown to anyone; what the app held
 *     about categories is forgotten so the next view reads the truth.
 */
export function useCategoryMutation() {
  const guard = useIdentityGuard();
  const store = useResourceStore();
  const busy = useRef(false);
  const alive = useRef(true);
  const [state, setState] = useState(EDITING);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** @param {{ send: () => Promise<{ data: unknown }>, prove: (data: unknown) => object | null }} request */
  const start = useCallback(
    async (request) => {
      if (busy.current) return;
      busy.current = true;
      setState({ phase: "submitting", rejection: null, category: null, code: null });

      let outcome;

      try {
        guard.assert();
        const response = await request.send();
        guard.assert();

        const proof = request.prove(response?.data);
        outcome = proof ? { kind: "confirmed", category: proof } : { kind: "unknown", code: "UNCONFIRMED" };
      } catch (error) {
        outcome = classifyOutcome(error);
      }

      if (outcome.kind === "identity") return;

      // A write that may have happened makes everything read before it unreliable.
      if (outcome.kind !== "rejected" && !store.isDisposed()) store.drop(isCategoryKey);

      if (outcome.kind === "rejected") busy.current = false;
      if (!alive.current) return;

      if (outcome.kind === "confirmed") setState({ phase: "confirmed", rejection: null, category: outcome.category, code: null });
      else if (outcome.kind === "rejected") setState({ phase: "rejected", rejection: outcome.error, category: null, code: outcome.code });
      else setState({ phase: "unknown", rejection: null, category: null, code: outcome.code });
    },
    [guard, store],
  );

  return { ...state, submitting: state.phase === "submitting", start };
}
