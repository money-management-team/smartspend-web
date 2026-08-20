import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { ThemeContext } from "./themeContext";

const THEME_STORAGE_KEY = "theme";

const THEMES = {
  LIGHT: "light",
  DARK: "dark",
};

const getInitialTheme = () => {
  if (typeof window === "undefined") {
    return THEMES.LIGHT;
  }

  /*
   * أولاً نبحث عن Theme محفوظ مسبقاً.
   */
  const savedTheme =
    localStorage.getItem(
      THEME_STORAGE_KEY,
    );

  if (
    savedTheme === THEMES.LIGHT ||
    savedTheme === THEMES.DARK
  ) {
    return savedTheme;
  }

  /*
   * إذا لم يكن هناك Theme محفوظ
   * نستخدم إعداد الجهاز.
   */
  const prefersDark =
    window.matchMedia?.(
      "(prefers-color-scheme: dark)",
    ).matches;

  return prefersDark
    ? THEMES.DARK
    : THEMES.LIGHT;
};

export default function ThemeProvider({
  children,
}) {
  const [theme, setTheme] =
    useState(getInitialTheme);

  /*
   * كلما تغير الـ Theme:
   *
   * 1. نحفظه في localStorage
   * 2. نضيفه إلى <html>
   * 3. نحدث color-scheme
   */
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      theme,
    );

    document.documentElement.style.colorScheme =
      theme;

    localStorage.setItem(
      THEME_STORAGE_KEY,
      theme,
    );
  }, [theme]);

  const changeTheme = (
    newTheme,
  ) => {
    if (
      newTheme !== THEMES.LIGHT &&
      newTheme !== THEMES.DARK
    ) {
      return;
    }

    setTheme(newTheme);
  };

  const toggleTheme = () => {
    setTheme((currentTheme) =>
      currentTheme === THEMES.DARK
        ? THEMES.LIGHT
        : THEMES.DARK,
    );
  };

  const value = useMemo(
    () => ({
      theme,

      isDark:
        theme === THEMES.DARK,

      isLight:
        theme === THEMES.LIGHT,

      toggleTheme,
      changeTheme,
    }),
    [theme],
  );

  return (
    <ThemeContext.Provider
      value={value}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export {
  THEMES,
  THEME_STORAGE_KEY,
};