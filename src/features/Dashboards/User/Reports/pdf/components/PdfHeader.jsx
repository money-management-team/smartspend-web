import { Image, StyleSheet, View } from "@react-pdf/renderer";

import { usePdfDirection } from "../pdfDirection";
import { PDF_COLORS, PDF_FONTS } from "../pdfTheme";
import PdfText from "./PdfText";

// smart-spend-logo.png is 1273 × 1236: the ratio is kept at any size.
const LOGO_HEIGHT = 26;
const LOGO_WIDTH = (LOGO_HEIGHT * 1273) / 1236;

const styles = StyleSheet.create({
  top: {
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: {
    alignItems: "center",
  },
  logo: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
  brandName: {
    fontFamily: PDF_FONTS.heading,
    fontSize: 12.5,
    fontWeight: 700,
    lineHeight: 1.2,
    color: PDF_COLORS.textStrong,
  },
  small: {
    fontSize: 7.5,
    lineHeight: 1.35,
    color: PDF_COLORS.textMuted,
  },
  generatedValue: {
    fontSize: 8,
    fontWeight: 600,
    lineHeight: 1.35,
    color: PDF_COLORS.textMain,
  },
  accent: {
    marginTop: 20,
    width: 28,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: PDF_COLORS.primary,
  },
  title: {
    marginTop: 7,
    fontFamily: PDF_FONTS.heading,
    fontSize: 21,
    fontWeight: 800,
    lineHeight: 1.25,
    color: PDF_COLORS.textStrong,
  },
  description: {
    marginTop: 3,
    maxWidth: "88%",
    fontSize: 9,
    lineHeight: 1.5,
    color: PDF_COLORS.textSecondary,
  },
  meta: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexWrap: "wrap",
    borderWidth: 0.75,
    borderColor: PDF_COLORS.border,
    borderRadius: 6,
    backgroundColor: PDF_COLORS.background,
  },
  metaItem: {
    marginVertical: 2,
  },
  metaLabel: {
    fontSize: 7,
    lineHeight: 1.3,
    color: PDF_COLORS.textMuted,
  },
  metaValue: {
    fontSize: 8.5,
    fontWeight: 600,
    lineHeight: 1.35,
    color: PDF_COLORS.textStrong,
  },
  notes: {
    marginTop: 8,
  },
  note: {
    fontSize: 7.5,
    lineHeight: 1.45,
    color: PDF_COLORS.textMuted,
  },
  separator: {
    marginTop: 14,
    borderBottomWidth: 0.75,
    borderBottomColor: PDF_COLORS.border,
  },
});

/*
 * First-page header: logo and brand, generation time, report title and
 * description, then the applied filters in one compact strip (only the ones
 * that were actually used) and the report's own notes.
 */
export default function PdfHeader({ model, logo }) {
  const dir = usePdfDirection();

  return (
    <View>
      <View style={[styles.top, { flexDirection: dir.row }]}>
        <View style={[styles.brand, { flexDirection: dir.row }]}>
          {logo && <Image src={logo} style={[styles.logo, dir.gapAfter(8)]} />}
          <View>
            <PdfText style={[styles.brandName, { textAlign: dir.start }]}>{model.brand}</PdfText>
            <PdfText style={[styles.small, { textAlign: dir.start }]}>{model.tagline}</PdfText>
          </View>
        </View>
        <View>
          <PdfText style={[styles.small, { textAlign: dir.end }]}>{model.generatedLabel}</PdfText>
          <PdfText style={[styles.generatedValue, { textAlign: dir.end }]}>{model.generated}</PdfText>
        </View>
      </View>

      <View style={[styles.accent, { alignSelf: dir.flexStart }]} />
      <PdfText style={[styles.title, { textAlign: dir.start }]}>{model.title}</PdfText>
      {model.description && (
        <PdfText style={[styles.description, { textAlign: dir.start, alignSelf: dir.flexStart }]}>
          {model.description}
        </PdfText>
      )}

      {model.meta.length > 0 && (
        <View style={[styles.meta, { flexDirection: dir.row }]}>
          {model.meta.map((item) => (
            <View key={item.label} style={[styles.metaItem, dir.gapAfter(24)]}>
              <PdfText style={[styles.metaLabel, { textAlign: dir.start }]}>{item.label}</PdfText>
              <PdfText style={[styles.metaValue, { textAlign: dir.start }]}>{item.value}</PdfText>
            </View>
          ))}
        </View>
      )}

      {model.notes.length + model.flags.length > 0 && (
        <View style={styles.notes}>
          {[...model.notes, ...model.flags].map((note) => (
            <PdfText key={note} style={[styles.note, { textAlign: dir.start }]}>
              {note}
            </PdfText>
          ))}
        </View>
      )}

      <View style={styles.separator} />
    </View>
  );
}
