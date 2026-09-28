import { StyleSheet, Text, View } from "@react-pdf/renderer";

import { usePdfDirection } from "../pdfDirection";
import { PDF_COLORS, PDF_FONTS, getTone } from "../pdfTheme";
import PdfText from "./PdfText";

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 9,
    borderWidth: 0.75,
    borderTopWidth: 2,
    borderColor: PDF_COLORS.border,
    borderRadius: 6,
    backgroundColor: PDF_COLORS.surface,
  },
  label: {
    fontSize: 7.5,
    lineHeight: 1.35,
    color: PDF_COLORS.textSecondary,
  },
  value: {
    marginTop: 3,
    fontFamily: PDF_FONTS.heading,
    fontSize: 15,
    fontWeight: 700,
    lineHeight: 1.2,
    color: PDF_COLORS.textStrong,
  },
  unit: {
    fontFamily: PDF_FONTS.body,
    fontSize: 7.5,
    fontWeight: 600,
    color: PDF_COLORS.textMuted,
  },
});

/*
 * One key figure: small label, large value, its currency code. The top
 * accent is the only colour on a neutral metric (primary); income and signed
 * results use their semantic colour for the accent and the value — never two
 * different strong colours in one card.
 */
export default function PdfStatCard({ label, value, unit, tone = "neutral" }) {
  const { start } = usePdfDirection();
  const semantic = tone !== "neutral";
  const accent = getTone(semantic ? tone : "primary").color;

  return (
    <View style={[styles.card, { borderTopColor: accent }]} wrap={false}>
      <PdfText style={[styles.label, { textAlign: start }]}>{label}</PdfText>
      <Text style={[styles.value, semantic && { color: accent }, { textAlign: start }]}>
        {value}
        {unit && <Text style={styles.unit}>{` ${unit}`}</Text>}
      </Text>
    </View>
  );
}
