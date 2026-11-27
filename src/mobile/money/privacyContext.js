import { createContext, useContext } from "react";

export const MoneyPrivacyContext = createContext(false);
export const MoneyPrivacyToggleContext = createContext(null);

/** True when the person asked for amounts to be hidden. */
export const useMoneyHidden = () => useContext(MoneyPrivacyContext);

/** Changes "hide amounts" (the full version's own device preference), or null outside the provider. */
export const useMoneyHiddenToggle = () => useContext(MoneyPrivacyToggleContext);
