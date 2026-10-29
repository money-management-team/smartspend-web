import { StyleSheet, View } from "@react-pdf/renderer";

import { usePdfDirection } from "../pdfDirection";
import { PDF_COLORS, PDF_PAGE } from "../pdfTheme";
import PdfText from "./PdfText";

const styles = StyleSheet.create({
  running: {
    position: "absolute",
    top: 16,
    left: PDF_PAGE.paddingHorizontal,
    right: PDF_PAGE.paddingHorizontal,
    fontSize: 7.5,
    lineHeight: 1.3,
    color: PDF_COLORS.textMuted,
  },
  footer: {
    position: "absolute",
    left: PDF_PAGE.paddingHorizontal,
    right: PDF_PAGE.paddingHorizontal,
    paddingTop: 6,
    justifyContent: "space-between",
    borderTopWidth: 0.75,
    borderTopColor: PDF_COLORS.border,
  },
  footerText: {
    fontSize: 7.5,
    lineHeight: 1.3,
    color: PDF_COLORS.textMuted,
  },
});

/*
 * What repeats on every page: a quiet running title from page 2 on (page 1
 * has the full header) and the footer with "Page X of Y".
 *
 * The footer is placed with `top`, not `bottom`: react-pdf drops a fixed
 * element holding a `render` text (the page number) when it is anchored to
 * the bottom, because that text has no height until the page count is known.
 */
export default function PdfPageChrome({ model }) {
  const dir = usePdfDirection();
  // Read in the document's direction: the report name comes first.
  const running = dir.rtl ? `${model.title} · ${model.brand}` : `${model.brand} · ${model.title}`;

  return (
    <>
      <PdfText
        fixed
        style={[styles.running, { textAlign: dir.start }]}
        render={({ pageNumber }) => (pageNumber > 1 ? running : "")}
      />
      <View
        fixed
        style={[
          styles.footer,
          { top: PDF_PAGE.height[model.orientation] - PDF_PAGE.footerOffset, flexDirection: dir.row },
        ]}
      >
        <PdfText style={styles.footerText}>{model.footer}</PdfText>
        <PdfText
          style={styles.footerText}
          render={({ pageNumber, totalPages }) => model.pageLabel(pageNumber, totalPages)}
        />
      </View>
    </>
  );
}
