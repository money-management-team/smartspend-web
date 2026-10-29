import { StyleSheet, View } from "@react-pdf/renderer";

import { usePdfDirection } from "../pdfDirection";
import { PDF_COLORS } from "../pdfTheme";
import PdfKeyValueList from "./PdfKeyValueList";
import PdfSectionTitle from "./PdfSectionTitle";
import PdfTable from "./PdfTable";
import PdfText from "./PdfText";

const styles = StyleSheet.create({
  list: {
    marginBottom: 10,
  },
  note: {
    marginBottom: 10,
    fontSize: 8,
    lineHeight: 1.45,
    color: PDF_COLORS.textSecondary,
  },
});

function Block({ block, dir }) {
  if (block.kind === "table") return <PdfTable block={block} />;
  if (block.kind === "list") return <PdfKeyValueList title={block.caption} rows={block.rows} style={styles.list} />;
  return <PdfText style={[styles.note, { textAlign: dir.start }]}>{block.text}</PdfText>;
}

// A short first block moves to the next page together with its title; a
// long table may start under the title and continue on the next page.
const MAX_KEPT_ROWS = 8;
const isShort = (block) => block.kind !== "table" || block.rows.length <= MAX_KEPT_ROWS;

// A titled report section and its blocks (tables, lists, notes). The title is
// never left alone at the bottom of a page.
export default function PdfSection({ title, hint, badge, blocks = [], children }) {
  const dir = usePdfDirection();
  const [first, ...rest] = blocks;
  const heading = <PdfSectionTitle title={title} hint={hint} badge={badge} />;

  return (
    <View>
      {first && isShort(first) ? (
        <View wrap={false}>
          {heading}
          <Block block={first} dir={dir} />
        </View>
      ) : (
        <>
          {heading}
          {first && <Block block={first} dir={dir} />}
        </>
      )}
      {rest.map((block, index) => (
        <Block key={index} block={block} dir={dir} />
      ))}
      {children}
    </View>
  );
}
