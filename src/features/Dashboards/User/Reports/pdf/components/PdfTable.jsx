import { StyleSheet, View } from "@react-pdf/renderer";

import { usePdfDirection } from "../pdfDirection";
import { PDF_COLORS, PDF_FONTS, getTone } from "../pdfTheme";
import PdfBadge from "./PdfBadge";
import PdfCaption from "./PdfCaption";
import PdfText from "./PdfText";

const styles = StyleSheet.create({
  table: {
    marginBottom: 12,
  },
  header: {
    backgroundColor: PDF_COLORS.primarySoft,
    borderBottomWidth: 0.75,
    borderBottomColor: PDF_COLORS.primary,
  },
  headerText: {
    fontSize: 7.5,
    fontWeight: 600,
    lineHeight: 1.3,
    color: PDF_COLORS.textStrong,
  },
  row: {
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_COLORS.border,
  },
  rowAlt: {
    backgroundColor: PDF_COLORS.background,
  },
  cell: {
    paddingHorizontal: 6,
    paddingVertical: 4.5,
    justifyContent: "center",
  },
  text: {
    fontFamily: PDF_FONTS.body,
    fontSize: 8,
    lineHeight: 1.35,
    color: PDF_COLORS.textMain,
  },
  strong: {
    fontWeight: 600,
    color: PDF_COLORS.textStrong,
  },
  sub: {
    marginTop: 1,
    fontSize: 7,
    lineHeight: 1.3,
    color: PDF_COLORS.textMuted,
  },
  track: {
    marginTop: 3,
    height: 3,
    width: "100%",
    borderRadius: 1.5,
    backgroundColor: PDF_COLORS.soft,
  },
  fill: {
    height: 3,
    borderRadius: 1.5,
  },
  badge: {
    marginTop: 2,
  },
});

const TEXT_TONES = {
  muted: PDF_COLORS.textMuted,
  neutral: null,
};

const toneColor = (tone) => (tone in TEXT_TONES ? TEXT_TONES[tone] : getTone(tone).color);

function Cell({ cell, column, width, dir }) {
  const align = column.align === "end" ? dir.end : dir.start;
  const color = cell.tone ? toneColor(cell.tone) : null;
  const onlyBadge = cell.badge && cell.text == null;

  return (
    <View style={[styles.cell, { width, alignItems: column.align === "end" ? dir.flexEnd : dir.flexStart }]}>
      {cell.text != null && (
        <PdfText style={[styles.text, cell.strong && styles.strong, color && { color }, { textAlign: align }]}>
          {cell.text}
        </PdfText>
      )}
      {cell.sub && <PdfText style={[styles.sub, { textAlign: align }]}>{cell.sub}</PdfText>}
      {cell.bar && (
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${cell.bar.width}%`, backgroundColor: getTone(cell.bar.tone).color },
              dir.rtl && { alignSelf: "flex-end" },
            ]}
          />
        </View>
      )}
      {cell.badge && <PdfBadge text={cell.badge.text} tone={cell.badge.tone} style={onlyBadge ? null : styles.badge} />}
    </View>
  );
}

/*
 * A data table. Column widths follow each column's weight (names wide,
 * counts narrow). The header row is `fixed`, so it repeats at the top of
 * every page the table continues on; rows never split across pages
 * (`wrap={false}`), and the header keeps at least one row with it.
 */
export default function PdfTable({ block }) {
  const dir = usePdfDirection();
  const total = block.columns.reduce((sum, column) => sum + column.weight, 0);
  const widths = block.columns.map((column) => `${((column.weight / total) * 100).toFixed(3)}%`);

  return (
    <View>
      {block.caption && <PdfCaption text={block.caption} />}
      <View style={styles.table}>
        <View fixed minPresenceAhead={28} style={[styles.header, { flexDirection: dir.row }]}>
          {block.columns.map((column, index) => (
            <View
              key={index}
              style={[
                styles.cell,
                { width: widths[index], alignItems: column.align === "end" ? dir.flexEnd : dir.flexStart },
              ]}
            >
              <PdfText style={[styles.headerText, { textAlign: column.align === "end" ? dir.end : dir.start }]}>
                {column.label}
              </PdfText>
            </View>
          ))}
        </View>

        {block.rows.map((cells, rowIndex) => (
          <View
            key={rowIndex}
            wrap={false}
            style={[
              styles.row,
              { flexDirection: dir.row },
              rowIndex % 2 === 1 && styles.rowAlt,
            ]}
          >
            {cells.map((cell, index) => (
              <Cell key={index} cell={cell} column={block.columns[index]} width={widths[index]} dir={dir} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
