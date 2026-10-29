import { StyleSheet, View } from "@react-pdf/renderer";

import { usePdfDirection } from "../pdfDirection";
import { PDF_COLORS, PDF_FONTS, getTone } from "../pdfTheme";
import PdfBadge from "./PdfBadge";
import PdfText from "./PdfText";

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 0.75,
    borderColor: PDF_COLORS.border,
    borderRadius: 6,
    backgroundColor: PDF_COLORS.surface,
  },
  heading: {
    marginBottom: 3,
    alignItems: "center",
  },
  title: {
    fontFamily: PDF_FONTS.heading,
    fontSize: 9,
    fontWeight: 700,
    lineHeight: 1.3,
    color: PDF_COLORS.textStrong,
  },
  row: {
    paddingVertical: 3.5,
    borderTopWidth: 0.5,
    borderTopColor: PDF_COLORS.soft,
    alignItems: "flex-start",
  },
  rowFirst: {
    borderTopWidth: 0,
  },
  label: {
    flex: 1,
    fontSize: 8,
    lineHeight: 1.35,
    color: PDF_COLORS.textSecondary,
  },
  value: {
    maxWidth: "55%",
    fontSize: 8,
    fontWeight: 600,
    lineHeight: 1.35,
    color: PDF_COLORS.textStrong,
  },
});

// Label / value pairs in a light card: summary groups and metric blocks.
// Money keeps its semantic tone; every other value stays neutral.
export default function PdfKeyValueList({ title, badge, rows, style }) {
  const dir = usePdfDirection();

  return (
    <View style={[styles.card, style]} wrap={rows.length > 14}>
      {title && (
        <View style={[styles.heading, { flexDirection: dir.row }]}>
          <PdfText style={[styles.title, dir.gapAfter(6)]}>{title}</PdfText>
          {badge && <PdfBadge text={badge} tone="warning" />}
        </View>
      )}
      {rows.map((row, index) => {
        const color = row.tone && row.tone !== "neutral" ? getTone(row.tone).color : null;

        return (
          <View key={index} wrap={false} style={[styles.row, index === 0 && styles.rowFirst, { flexDirection: dir.row }]}>
            <PdfText style={[styles.label, { textAlign: dir.start }, dir.gapAfter(10)]}>{row.label}</PdfText>
            <PdfText style={[styles.value, color && { color }, { textAlign: dir.end }]}>{row.value}</PdfText>
          </View>
        );
      })}
    </View>
  );
}
