import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import i18n from "../../i18n";

import { LanguageContext } from "./languageContext";

const normalizeLanguage = (value) => {
  return String(value || "en")
    .toLowerCase()
    .startsWith("ar")
    ? "ar"
    : "en";
};

export default function LanguageProvider({
  children,
}) {
  const [language, setLanguageState] = useState(
    () => {
      return normalizeLanguage(
        i18n.resolvedLanguage ||
          i18n.language ||
          localStorage.getItem("i18nextLng") ||
          navigator.language,
      );
    },
  );

  /*
   * مزامنة Context مع i18next
   */
  useEffect(() => {
    const handleLanguageChanged = (
      newLanguage,
    ) => {
      const normalizedLanguage =
        normalizeLanguage(newLanguage);

      setLanguageState(normalizedLanguage);

      document.documentElement.lang =
        normalizedLanguage;

      document.documentElement.dir =
        normalizedLanguage === "ar"
          ? "rtl"
          : "ltr";

      localStorage.setItem(
        "smart-spend-language",
        normalizedLanguage,
      );
    };

    i18n.on(
      "languageChanged",
      handleLanguageChanged,
    );

    handleLanguageChanged(
      i18n.resolvedLanguage ||
        i18n.language ||
        "en",
    );

    return () => {
      i18n.off(
        "languageChanged",
        handleLanguageChanged,
      );
    };
  }, []);

  /*
   * تغيير اللغة إلى لغة محددة
   */
  const setLanguage = useCallback(
    async (nextLanguage) => {
      const normalizedLanguage =
        normalizeLanguage(nextLanguage);

      await i18n.changeLanguage(
        normalizedLanguage,
      );
    },
    [],
  );

  /*
   * التبديل بين العربية والإنجليزية
   */
  const changeLanguage = useCallback(
    async () => {
      const currentLanguage =
        normalizeLanguage(
          i18n.resolvedLanguage ||
            i18n.language,
        );

      const nextLanguage =
        currentLanguage === "ar"
          ? "en"
          : "ar";

      await i18n.changeLanguage(
        nextLanguage,
      );
    },
    [],
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      changeLanguage,
    }),
    [
      language,
      setLanguage,
      changeLanguage,
    ],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}