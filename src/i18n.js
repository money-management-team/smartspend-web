import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import Arabic from "./locales/ar/ar.json";
import English from "./locales/en/en.json";

const SUPPORTED_LANGUAGES = ["ar", "en"];

const normalizeLanguage = (value) => {
  const language = String(value || "en")
    .toLowerCase()
    .split("-")[0];

  return SUPPORTED_LANGUAGES.includes(language)
    ? language
    : "en";
};

const getInitialLanguage = () => {
  if (typeof localStorage !== "undefined") {
    const savedLanguage =
      localStorage.getItem("i18nextLng") ||
      localStorage.getItem("language");

    if (savedLanguage) {
      return normalizeLanguage(savedLanguage);
    }
  }

  if (typeof navigator !== "undefined") {
    return normalizeLanguage(navigator.language);
  }

  return "en";
};

const applyDocumentLanguage = (language) => {
  if (typeof document === "undefined") return;

  const normalized = normalizeLanguage(language);

  document.documentElement.lang = normalized;

  document.documentElement.dir =
    normalized === "ar" ? "rtl" : "ltr";

  if (document.body) {
    document.body.dir =
      normalized === "ar" ? "rtl" : "ltr";
  }
};

const initialLanguage = getInitialLanguage();

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: English,
      },

      ar: {
        translation: Arabic,
      },
    },

    lng: initialLanguage,

    supportedLngs: SUPPORTED_LANGUAGES,

    fallbackLng: "en",

    load: "languageOnly",

    cleanCode: true,

    interpolation: {
      escapeValue: false,
    },

    react: {
      useSuspense: false,
    },

    returnNull: false,

    returnEmptyString: false,

    saveMissing: import.meta.env.DEV,

    missingKeyHandler: (
      languages,
      namespace,
      key,
    ) => {
      console.warn(
        `[i18n] Missing translation key: ${key}`,
        {
          languages,
          namespace,
        },
      );
    },
  });

applyDocumentLanguage(
  i18n.resolvedLanguage ||
    i18n.language ||
    initialLanguage,
);

i18n.on(
  "languageChanged",
  (language) => {
    const normalized =
      normalizeLanguage(language);

    applyDocumentLanguage(normalized);

    if (
      typeof localStorage !==
      "undefined"
    ) {
      localStorage.setItem(
        "i18nextLng",
        normalized,
      );

      localStorage.setItem(
        "language",
        normalized,
      );
    }
  },
);

export {
  normalizeLanguage,
  SUPPORTED_LANGUAGES,
};

export default i18n;