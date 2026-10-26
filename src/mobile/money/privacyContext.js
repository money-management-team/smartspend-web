import { createContext, useContext } from "react";

export const MoneyPrivacyContext = createContext(false);

/** True when the person asked for amounts to be hidden. */
export const useMoneyHidden = () => useContext(MoneyPrivacyContext);
