import { Document, Page, StyleSheet, View } from "@react-pdf/renderer";

import { PdfDirectionContext } from "../pdfDirection";
import { PDF_COLORS, PDF_FONTS, PDF_PAGE, getTone } from "../pdfTheme";
import PdfEmptyState from "./PdfEmptyState";
import PdfHeader from "./PdfHeader";
import PdfPageChrome from "./PdfPageChrome";
import PdfSection from "./PdfSection";
import PdfSummary from "./PdfSummary";
import PdfTable from "./PdfTable";
import PdfText from "./PdfText";

const styles = StyleSheet.create({
  page: {
    paddingTop: PDF_PAGE.paddingTop,
    paddingHorizontal: PDF_PAGE.paddingHorizontal,
    paddingBottom: PDF_PAGE.paddingBottom,
    fontFamily: PDF_FONTS.body,
    fontSize: 9,
    lineHeight: 1.4,
    color: PDF_COLORS.textMain,
    backgroundColor: PDF_COLORS.surface,
  },
  notice: {
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    fontSize: 7.5,
    lineHeight: 1.4,
    color: getTone("warning").color,
    backgroundColor: getTone("warning").soft,
  },
  empty: {
    paddingVertical: 12,
    fontSize: 8.5,
    color: PDF_COLORS.textMuted,
  },
});

/*
 * The exported report: header, key figures per currency, the report's own
 * sections, then its rows. Laid out from a model built by
 * buildReportPdfModel(); nothing here formats or calculates a value.
 */
export default function ReportPdfDocument({ model, logo }) {
  const align = { textAlign: model.rtl ? "right" : "left" };

  return (
    <Document
      title={`${model.brand} — ${model.title}`}
      author={model.brand}
      creator={model.brand}
      producer={model.brand}
      subject={model.meta[0]?.value ?? model.title}
      language={model.language}
    >
      <Page size={PDF_PAGE.size} orientation={model.orientation} style={styles.page}>
        <PdfDirectionContext.Provider value={model.rtl}>
          <PdfHeader model={model} logo={logo} />

          {model.isEmpty ? (
            <PdfEmptyState title={model.emptyTitle} hint={model.emptyHint} />
          ) : (
            <>
              {model.summary.length > 0 && <PdfSummary model={model} />}

              {model.sections.map((section, index) => (
                <PdfSection key={index} {...section} />
              ))}

              {model.items && (
                <PdfSection title={model.items.title ?? model.title}>
                  {model.items.truncated && <PdfText style={[styles.notice, align]}>{model.items.truncated}</PdfText>}
                  {model.items.table ? (
                    <PdfTable block={model.items.table} />
                  ) : (
                    <View>
                      <PdfText style={[styles.empty, align]}>{model.items.empty}</PdfText>
                    </View>
                  )}
                </PdfSection>
              )}
            </>
          )}

          {/* Last, so react-pdf repeats it on every page the content spans. */}
          <PdfPageChrome model={model} />
        </PdfDirectionContext.Provider>
      </Page>
    </Document>
  );
}
