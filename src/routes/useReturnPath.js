import { useLocation } from "react-router-dom";
import { getReturnPath } from "./returnTo";

/* Where to go after a successful sign-in: the saved page, else the dashboard. */
export function useReturnPath() {
  const { search } = useLocation();
  return getReturnPath(search);
}
