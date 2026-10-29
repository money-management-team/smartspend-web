import { StyleSheet, View } from "@react-pdf/renderer";

import { usePdfDirection } from "../pdfDirection";
import { PDF_COLORS, PDF_FONTS } from "../pdfTheme";
import PdfBadge from "./PdfBadge";
import PdfCaption from "./PdfCaption";
import PdfKeyValueList from "./PdfKeyValueList";
import PdfSectionTitle from "./PdfSectionTitle";
import PdfStatCard from "./PdfStatCard";
import PdfText from "./PdfText";

const styles = StyleSheet.create({
  currency: {
    marginBottom: 10,
  },
  groupTitle: {
    marginBottom: 5,
    alignItems: "center",
  },
  groupTitleText: {
    fontFamily: PDF_FONTS.body,
    fontSize: 8,
    fontWeight: 600,
    lineHeight: 1.3,
    color: PDF_COLORS.textSecondary,
  },
  gridRow: {
    marginBottom: 8,
  },
  cell: {
    flex: 1,
  },
});

const KPIS_PER_ROW = 4;

// [a, b, c, d, e] → [[a, b, c], [d, e]]-style rows of at most `size`, spread
// evenly (6 → 3 + 3 rather than 4 + 2).
function chunk(items, size) {
  const rowCount = Math.ceil(items.length / size);
  const perRow = Math.ceil(items.length / Math.max(rowCount, 1));
  const rows = [];

  for (let index = 0; index < items.length; index += perRow) rows.push(items.slice(index, index + perRow));
  return rows;
}

function GridRow({ children, count, dir }) {
  const cells = [...children];
  while (cells.length < count) cells.push(null);

  return (
    <View style={[styles.gridRow, { flexDirection: dir.row }]} wrap={false}>
      {cells.map((child, index) => (
        <View key={index} style={[styles.cell, index < cells.length - 1 && dir.gapAfter(8)]}>
          {child}
        </View>
      ))}
    </View>
  );
}

/*
 * summary_by_currency: one block per currency, each labelled with its code.
 * Key figures first as cards, then the report's other groups as compact
 * two-column lists. Currencies are never added together.
 */
export default function PdfSummary({ model }) {
  const dir = usePdfDirection();

  return (
    <View>
      {model.summary.map((block, blockIndex) => (
        <View key={block.currency ?? blockIndex} style={styles.currency}>
          {/* Section title (first currency only), currency label and key
              figures move between pages as one piece. */}
          <View wrap={false}>
            {blockIndex === 0 && <PdfSectionTitle title={model.summaryTitle} hint={model.summaryHint} />}
            {block.currency && <PdfCaption text={block.currency} />}

            {block.kpiTitle && block.kpis.length > 0 && (
              <View style={[styles.groupTitle, { flexDirection: dir.row }]}>
                <PdfText style={[styles.groupTitleText, dir.gapAfter(6)]}>{block.kpiTitle}</PdfText>
                {block.kpiForecast && <PdfBadge text={model.forecastBadge} tone="warning" />}
              </View>
            )}
            {chunk(block.kpis, KPIS_PER_ROW).map((row, rowIndex, rows) => (
              <GridRow key={rowIndex} count={rows[0].length} dir={dir}>
                {row.map((item) => (
                  <PdfStatCard key={item.label} {...item} />
                ))}
              </GridRow>
            ))}
          </View>

          {chunk(block.lists, 2).map((pair, pairIndex) => (
            <GridRow key={pairIndex} count={2} dir={dir}>
              {pair.map((list, index) => (
                <PdfKeyValueList
                  key={list.title ?? index}
                  title={list.title}
                  badge={list.forecast ? model.forecastBadge : null}
                  rows={list.rows}
                />
              ))}
            </GridRow>
          ))}
        </View>
      ))}
    </View>
  );
}
