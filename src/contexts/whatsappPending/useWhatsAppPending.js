import { useContext } from "react";

import { WhatsAppPendingContext } from "./whatsappPendingContext.js";

const NO_PROVIDER = Object.freeze({
  count: null,
  loading: false,
  error: null,
  refresh: () => {},
  ensureFresh: () => {},
});

/*
 * The signed-in user's WhatsApp pending-review count (see the provider).
 * Outside the provider (public pages, isolated tests) it reports "unknown"
 * and its actions do nothing, so a component never needs its own fetch.
 */
export const useWhatsAppPending = () => useContext(WhatsAppPendingContext) ?? NO_PROVIDER;
