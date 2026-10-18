import { PATH } from "../../../routes/Path";

// Section ids of the home page. The landing header, footer and in-page
// buttons link to them, and so does the public navbar on the other pages.
export const HOME_SECTIONS = {
  TOP: "top",
  MAIN: "main-content",
  EXPERIENCE: "experience",
  FEATURES: "features",
  CAPTURE: "capture",
  ASSISTANT: "intelligence",
  TRUST: "trust",
  BUSINESS: "business",
  FAQ: "faq",
};

// Ids the previous home page used. Old links (bookmarks, other pages) still
// land on the matching section of the current page.
const LEGACY_SECTIONS = {
  "how-it-works": HOME_SECTIONS.CAPTURE,
  security: HOME_SECTIONS.TRUST,
  "dashboard-preview": HOME_SECTIONS.EXPERIENCE,
};

/** "/#capture": a section of the home page, from any route. */
export const getHomeSectionPath = (id) => `${PATH.HOME}#${id}`;

/** The current id for a fragment, so legacy anchors keep working. */
export const resolveHomeSection = (id) => LEGACY_SECTIONS[id] ?? id;

// The home page's demo, for links that point straight at the product preview.
export const PRODUCT_PREVIEW_ID = HOME_SECTIONS.EXPERIENCE;
