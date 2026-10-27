import { createContext, useContext, useEffect } from "react";

/*
 * Lets a sheet opened by a screen (the Activity filters) make the rest of the
 * frame inert, as the shell already does for its own sheets: the app bar, the
 * page and the bottom bar cannot be reached by touch, keyboard or a screen
 * reader while a modal sheet is open.
 */
export const ShellModalContext = createContext(null);

export function useShellModal(open) {
  const register = useContext(ShellModalContext);

  useEffect(() => {
    if (!open || !register) return undefined;

    register(true);
    return () => register(false);
  }, [open, register]);
}
