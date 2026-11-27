import { createContext, useContext } from "react";

export const StoreContext = createContext(null);

/** The in-memory data store of the current identity scope. */
export function useResourceStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("Mobile data is only available inside the identity boundary.");
  return store;
}

// A full reload starts the app again from whatever browser storage says now.
export const reloadPage = () => window.location.reload();
