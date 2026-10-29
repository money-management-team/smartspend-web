import { StyleSheet, View } from "@react-pdf/renderer";

import { usePdfDirection } from "../pdfDirection";
import { PDF_COLORS, PDF_FONTS } from "../pdfTheme";
import PdfText from "./PdfText";

const styles = StyleSheet.create({
  caption: {
    marginBottom: 5,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    backgroundColor: PDF_COLORS.soft,
  },
  text: {
    fontFamily: PDF_FONTS.heading,
    fontSize: 8.5,
    fontWeight: 700,
    lineHeight: 1.3,
    color: PDF_COLORS.textStrong,
  },
});

// Label above a block, usually its currency ("ILS", "USD · Expense"): each
// currency is its own block and is never combined with another.
export default function PdfCaption({ text }) {
  const { flexStart } = usePdfDirection();

  return (
    <View style={[styles.caption, { alignSelf: flexStart }]} minPresenceAhead={40}>
      <PdfText style={styles.text}>{text}</PdfText>
    </View>
  );
}
