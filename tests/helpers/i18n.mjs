import { readFileSync } from "node:fs";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { createElement } from "react";
import { experienceMessages } from "../../src/features/Dashboards/User/Experience/experienceMessages.js";

const read = (lang) => JSON.parse(readFileSync(new URL(`../../src/locales/${lang}/${lang}.json`, import.meta.url), "utf8"));
export const locales = { en: read("en"), ar: read("ar") };

/** A fresh i18n instance with the real locale files, set to `lng`. `instance.missingKeys` lists keys looked up but absent. */
export async function createI18n(lng = "en") {
  const instance = i18next.createInstance();
  const missingKeys = [];
  await instance.use(initReactI18next).init({
    lng,
    fallbackLng: "en",
    resources: {
      en: { translation: locales.en, experience: experienceMessages.en },
      ar: { translation: locales.ar, experience: experienceMessages.ar },
    },
    interpolation: { escapeValue: false },
    returnNull: false,
    saveMissing: true,
    missingKeyHandler: (_languages, _namespace, key) => missingKeys.push(key),
  });
  instance.missingKeys = missingKeys;
  return instance;
}

export const withI18n = (instance, child) => createElement(I18nextProvider, { i18n: instance }, child);
