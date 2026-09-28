import { StyleSheet, View } from "@react-pdf/renderer";

import { PDF_COLORS, PDF_FONTS } from "../pdfTheme";
import PdfText from "./PdfText";

const styles = StyleSheet.create({
  box: {
    marginTop: 22,
    paddingHorizontal: 24,
    paddingVertical: 30,
    alignItems: "center",
    borderWidth: 0.75,
    borderColor: PDF_COLORS.border,
    borderRadius: 8,
    backgroundColor: PDF_COLORS.background,
  },
  title: {
    fontFamily: PDF_FONTS.heading,
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.3,
    color: PDF_COLORS.textStrong,
    textAlign: "center",
  },
  hint: {
    marginTop: 5,
    maxWidth: "75%",
    fontSize: 8.5,
    lineHeight: 1.5,
    color: PDF_COLORS.textSecondary,
    textAlign: "center",
  },
});

// Shown instead of empty tables when the period has nothing to report. The
// header above still states the report, period and filters.
export default function PdfEmptyState({ title, hint }) {
  return (
    <View style={styles.box} wrap={false}>
      <PdfText style={styles.title}>{title}</PdfText>
      {hint && <PdfText style={styles.hint}>{hint}</PdfText>}
    </View>
  );
}
