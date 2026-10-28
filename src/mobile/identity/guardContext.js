import { createContext, useContext } from "react";

export const GuardContext = createContext(null);

/*
 * The identity guard of the current identity scope. A write checks it right
 * before the request leaves and right after the answer arrives (the store does
 * the same for reads); a screen never gets a way to reset it.
 */
export function useIdentityGuard() {
  const guard = useContext(GuardContext);
  if (!guard) throw new Error("The identity guard is only available inside the identity boundary.");
  return guard;
}
