import { useContext } from "react";

import { ThemeContext } from "./themeContext";

export function useThemeContext() {
  const context =
    useContext(ThemeContext);

  if (!context) {
    throw new Error(
      "useThemeContext must be used inside ThemeProvider",
    );
  }

  return context;
}