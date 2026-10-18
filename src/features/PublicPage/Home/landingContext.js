import { createContext, useContext } from "react";

export const LandingContext = createContext(null);

/*
 * The landing page's view of the app preferences, in the shape the approved
 * design was written against (its `useUI()`): { t, lang, theme, animated,
 * reduced, toggleLanguage, toggleTheme, toggleMotion }. Language and theme are
 * the app's own (LanguageProvider, ThemeProvider); only the motion switch is
 * local to this page.
 */
export function useLanding() {
  const context = useContext(LandingContext);
  if (!context) throw new Error("useLanding must be used inside <LandingProvider>");
  return context;
}
