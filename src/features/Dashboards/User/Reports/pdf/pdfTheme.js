import { Font } from "@react-pdf/renderer";

/*
 * The Smart Spend identity for exported PDFs, in one place. The values are
 * the ones in src/index.css (light theme): brand/semantic colours and the
 * neutral scale. The *Soft tints are those tokens' --*-soft alphas flattened
 * onto white, so they print the same everywhere.
 */
export const PDF_COLORS = {
  primary: "#2563EB",
  success: "#16A34A",
  warning: "#EA580C",
  danger: "#DC2626",
  insights: "#9333EA",

  primarySoft: "#EEF3FD",
  successSoft: "#EAF7EF",
  warningSoft: "#FDF0E9",
  dangerSoft: "#FCEEEE",
  insightsSoft: "#F5EDFD",

  background: "#F9FAFB",
  surface: "#FFFFFF",
  soft: "#F3F4F6",
  border: "#E5E7EB",
  textStrong: "#111827",
  textMain: "#374151",
  textSecondary: "#4B5563",
  textMuted: "#6B7280",
};

// Semantic tone → { color, soft }. "neutral" is the default everywhere.
export const PDF_TONES = {
  primary: { color: PDF_COLORS.primary, soft: PDF_COLORS.primarySoft },
  success: { color: PDF_COLORS.success, soft: PDF_COLORS.successSoft },
  warning: { color: PDF_COLORS.warning, soft: PDF_COLORS.warningSoft },
  danger: { color: PDF_COLORS.danger, soft: PDF_COLORS.dangerSoft },
  insights: { color: PDF_COLORS.insights, soft: PDF_COLORS.insightsSoft },
  neutral: { color: PDF_COLORS.textSecondary, soft: PDF_COLORS.soft },
};

export const getTone = (tone) => PDF_TONES[tone] ?? PDF_TONES.neutral;

// Tajawal for titles and large figures, Cairo for everything else — the
// same split as the web UI.
export const PDF_FONTS = {
  heading: "Tajawal",
  body: "Cairo",
};

// Page geometry, in points (A4 is 595.28 × 841.89).
export const PDF_PAGE = {
  size: "A4",
  height: { portrait: 841.89, landscape: 595.28 },
  paddingTop: 34,
  paddingHorizontal: 32,
  paddingBottom: 56,
  // Distance from the bottom edge to the top of the footer rule.
  footerOffset: 40,
};

// Tokens that never join into long unbreakable runs are left alone; only a
// very long token (a pasted reference, a URL) may break across lines.
const MAX_WORD_LENGTH = 22;

/*
 * Registers the bundled Cairo / Tajawal files (`fonts` from pdfAssets.js).
 * The fonts ship with the app (src/assets/fonts, SIL OFL 1.1), so generating
 * a PDF never depends on Google Fonts being reachable.
 *
 * Call it before every document: react-pdf keeps shaping state on a loaded
 * font, and reusing one across documents dropped Arabic letters from later
 * PDFs (e.g. the initial "ت" of "تحويل"). Clearing and registering again
 * gives each document fresh font instances; the files themselves come from
 * the browser cache after the first export. (Font.reset() cannot be used:
 * it drops the font data but keeps the cached load, so nothing reloads.)
 */
export function registerPdfFonts(fonts) {
  Font.clear();

  // clear() also drops the built-in Helvetica, which the layout engine still
  // falls back to internally: restore it from the PDF standard fonts.
  Font.register({
    family: "Helvetica",
    fonts: [
      { src: "Helvetica", fontWeight: 400 },
      { src: "Helvetica-Bold", fontWeight: 700 },
    ],
  });
  Font.register({
    family: PDF_FONTS.body,
    fonts: [
      { src: fonts.cairoRegular, fontWeight: 400 },
      { src: fonts.cairoSemiBold, fontWeight: 600 },
      { src: fonts.cairoBold, fontWeight: 700 },
    ],
  });
  Font.register({
    family: PDF_FONTS.heading,
    fonts: [
      { src: fonts.tajawalBold, fontWeight: 700 },
      { src: fonts.tajawalExtraBold, fontWeight: 800 },
    ],
  });

  // No automatic hyphenation: Arabic words and amounts must never be split.
  Font.registerHyphenationCallback((word) =>
    word.length > MAX_WORD_LENGTH ? word.match(new RegExp(`.{1,${MAX_WORD_LENGTH}}`, "g")) : [word],
  );
}
