import { analytics } from "./analytics.js";
import { assist } from "./assist.js";
import { auth } from "./auth.js";
import { debtsTransfers } from "./debtsTransfers.js";
import { details } from "./details.js";
import { forms } from "./forms.js";
import { guide } from "./guide.js";
import { planningDetails } from "./planningDetails.js";
import { pwa } from "./pwa.js";
import { reportsImports } from "./reportsImports.js";
import { settings } from "./settings.js";
import { tools } from "./tools.js";
import { writes } from "./writes.js";

/*
 * The strings of the screens added in the full Mobile sprint, one file per
 * feature, each `{ en: { section: … }, ar: { section: … } }`. Sections must not
 * clash with each other or with messages.js (except `titles`, which is merged).
 */
const FEATURES = [writes, debtsTransfers, reportsImports, pwa, forms, assist, tools, auth, analytics, guide, settings, details, planningDetails];

const join = (language) =>
  FEATURES.reduce((all, feature) => ({ ...all, ...feature[language], titles: { ...all.titles, ...feature[language].titles } }), { titles: {} });

export const FEATURE_MESSAGES = { en: join("en"), ar: join("ar") };

export const FEATURE_SECTIONS = Object.freeze(FEATURES.map((feature) => Object.keys(feature.en)));
