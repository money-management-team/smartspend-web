import { StyleSheet, View } from "@react-pdf/renderer";

import { usePdfDirection } from "../pdfDirection";
import { PDF_FONTS, getTone } from "../pdfTheme";
import PdfText from "./PdfText";

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  text: {
    fontFamily: PDF_FONTS.body,
    fontSize: 7,
    fontWeight: 600,
    lineHeight: 1.35,
  },
});

// Small status pill. The label always carries the meaning; colour only
// reinforces it, so it still reads in grayscale.
export default function PdfBadge({ text, tone = "neutral", style }) {
  const { flexStart } = usePdfDirection();
  const { color, soft } = getTone(tone);

  return (
    <View style={[styles.badge, { backgroundColor: soft, alignSelf: flexStart }, style]}>
      <PdfText style={[styles.text, { color }]}>{text}</PdfText>
    </View>
  );
}
