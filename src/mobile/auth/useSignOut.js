import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuthContext } from "../../contexts/auth/useAuthContext";
import { clearPendingWritesForUser } from "../data/pendingWriteStorage.js";
import { MOBILE_SIGNIN } from "../navigation.js";
import { setSignOutNotice } from "./signOutNotice.js";

/*
 * Signing out of Mobile, through the app's one AuthProvider (`logout`): the same call the full version's sidebar
 * makes, so the request (POST /logout), what is cleared on this device (the stored session, the pending-write keys of
 * this person) and the cross-tab behaviour (other tabs hear the storage change and sign out too) are all the
 * provider's, not copied here. Nothing here goes through the financial write gate: signing out moves no money.
 *
 * The provider ends the session on this device whatever the server answers (it clears it in a `finally`), and rethrows
 * a failed request. That is what lets Mobile say truthfully what happened, in three words:
 *
 *   confirmed    POST /logout was answered with success: the server ended the session.
 *   ended        the server answered 401: it says the session was no longer valid, so there was nothing left to end.
 *   unconfirmed  anything else (no network, a timeout, a server error): this device is signed out, but SmartSpend did
 *                not confirm that the session ended on the server, and Mobile does not claim it did.
 *
 * The outcome is kept for the sign-in page to show (signOutNotice.js). While it is set, whoever signs in next (the same
 * person or another) starts at Mobile Home, never at the page the previous person left.
 *
 * A second tap while the first is on its way does nothing (a ref, not just a disabled button, so two taps in the same
 * frame cannot send two requests).
 */
export default function useSignOut() {
  const { logout, user } = useAuthContext();
  const userId = user?.id;
  const navigate = useNavigate();
  const running = useRef(false);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const signOut = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);

    let outcome = "confirmed";
    try {
      await logout();
    } catch (error) {
      outcome = error?.code === "UNAUTHENTICATED" ? "ended" : "unconfirmed";
    } finally {
      // The provider clears the full version's pending-write keys; Mobile's own (a different key prefix) are cleared here,
      // for this person, whatever the server answered, so the next person on this device never finds them.
      clearPendingWritesForUser(userId);
    }

    // The provider has cleared the session by now; sign-in is where this goes, replacing the page the person left.
    setSignOutNotice(outcome);
    navigate(MOBILE_SIGNIN, { replace: true });
    running.current = false;
    if (mounted.current) setBusy(false);
  }, [logout, navigate, userId]);

  return { signOut, busy };
}
