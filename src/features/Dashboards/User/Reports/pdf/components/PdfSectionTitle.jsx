import { StyleSheet, View } from "@react-pdf/renderer";

import { usePdfDirection } from "../pdfDirection";
import { PDF_COLORS, PDF_FONTS } from "../pdfTheme";
import PdfBadge from "./PdfBadge";
import PdfText from "./PdfText";

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 18,
    marginBottom: 8,
  },
  row: {
    alignItems: "center",
  },
  accent: {
    width: 3,
    height: 12,
    borderRadius: 1.5,
    backgroundColor: PDF_COLORS.primary,
  },
  title: {
    fontFamily: PDF_FONTS.heading,
    fontSize: 12.5,
    fontWeight: 700,
    lineHeight: 1.3,
    color: PDF_COLORS.textStrong,
  },
  hint: {
    marginTop: 2,
    fontSize: 7.5,
    lineHeight: 1.4,
    color: PDF_COLORS.textMuted,
  },
});

/*
 * Section heading with a slim primary accent. `minPresenceAhead` keeps it on
 * the same page as the start of its content, so a title is never left alone
 * at the bottom of a page.
 */
export default function PdfSectionTitle({ title, hint, badge }) {
  const { row, start, gapAfter } = usePdfDirection();

  return (
    <View style={styles.wrapper} minPresenceAhead={70}>
      <View style={[styles.row, { flexDirection: row }]}>
        <View style={[styles.accent, gapAfter(7)]} />
        <PdfText style={[styles.title, gapAfter(8)]}>{title}</PdfText>
        {badge && <PdfBadge text={badge} tone="warning" />}
      </View>
      {hint && <PdfText style={[styles.hint, { textAlign: start }]}>{hint}</PdfText>}
    </View>
  );
}
