import { writes } from "./writes.js";

/*
 * The strings of the screens added in the full Mobile sprint, one file per
 * feature, each `{ en: { section: … }, ar: { section: … } }`. Sections must not
 * clash with each other or with messages.js (except `titles`, which is merged).
 */
const FEATURES = [writes];

const join = (language) =>
  FEATURES.reduce((all, feature) => ({ ...all, ...feature[language], titles: { ...all.titles, ...feature[language].titles } }), { titles: {} });

export const FEATURE_MESSAGES = { en: join("en"), ar: join("ar") };

export const FEATURE_SECTIONS = Object.freeze(FEATURES.map((feature) => Object.keys(feature.en)));
