import PdfText from "../../Reports/pdf/components/PdfText";
import { PdfDirectionContext } from "../../Reports/pdf/pdfDirection";
import { Document, Page, View, Image, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Cairo",
    fontSize: 8,
    color: "#17243c",
    padding: 30,
    paddingTop: 94,
    paddingBottom: 54,
  },
  header: {
    position: "absolute",
    top: 24,
    left: 30,
    right: 30,
    height: 60,
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#dbe6f5",
    paddingBottom: 10,
  },
  logo: { width: 42, height: 42 },
  title: { fontSize: 15, fontWeight: 700, color: "#2563eb" },
  subtitle: { fontSize: 9, marginTop: 5 },
  totals: {
    flexDirection: "row",
    backgroundColor: "#eef4ff",
    padding: 13,
    marginBottom: 12,
    borderRadius: 8,
  },
  total: { flex: 1 },
  amount: { marginTop: 4, fontWeight: 700, fontSize: 10 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 8,
  },
  head: { backgroundColor: "#f3f6fa", paddingVertical: 10, fontWeight: 700 },
  cell: { paddingHorizontal: 5, flexShrink: 0 },
  cellText: { fontSize: 7.5, lineHeight: 1.65 },
  note: { fontSize: 8, color: "#64748b", marginBottom: 13, lineHeight: 1.7 },
  footer: {
    position: "absolute",
    top: 554,
    left: 30,
    right: 30,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#64748b",
  },
});
export default function AccountStatementDocument({ model, logo }) {
  const keys = ["id", "date", "description", "type", "status", "net"];
  const widths = {
    id: "8%",
    date: "20%",
    description: "27%",
    type: "15%",
    status: "12%",
    net: "18%",
  };
  const textStyle = { textAlign: model.rtl ? "right" : "left" };
  const columns = model.rtl ? [...keys].reverse() : keys;
  return (
    <PdfDirectionContext.Provider value={model.rtl}>
      <Document title={model.title} author="SmartSpend">
        <Page size="A4" orientation="landscape" style={styles.page}>
          <View style={styles.header} fixed />
          <Image
            fixed
            src={logo}
            style={[styles.logo, { position: "absolute", top: 24, left: 30 }]}
          />
          <PdfText
            fixed
            style={[
              styles.title,
              {
                position: "absolute",
                top: 24,
                right: 30,
                width: 620,
                textAlign: "right",
              },
            ]}
          >
            {model.title}
          </PdfText>
          <PdfText
            fixed
            style={[
              styles.subtitle,
              {
                position: "absolute",
                top: 48,
                right: 30,
                width: 620,
                textAlign: "right",
              },
            ]}
          >{`${model.account} · ${model.currency}`}</PdfText>
          <PdfText
            fixed
            style={{
              position: "absolute",
              top: 66,
              right: 30,
              textAlign: "right",
              fontSize: 8,
            }}
          >
            {model.period}
          </PdfText>
          <View style={styles.totals}>
            {model.totals.map((item) => (
              <View key={item.label} style={[styles.total, textStyle]}>
                <PdfText>{item.label}</PdfText>
                <PdfText style={styles.amount}>{item.value}</PdfText>
              </View>
            ))}
          </View>
          <PdfText style={[styles.note, textStyle]}>{model.note}</PdfText>
          <View style={[styles.row, styles.head]} fixed>
            {columns.map((key) => (
              <View key={key} style={[styles.cell, { width: widths[key] }]}>
                <PdfText style={[styles.cellText, textStyle]}>
                  {model.labels[key]}
                </PdfText>
              </View>
            ))}
          </View>
          {model.rows.map((row) => (
            <View key={row.id} style={styles.row} wrap={false}>
              {columns.map((key) => (
                <View key={key} style={[styles.cell, { width: widths[key] }]}>
                  <PdfText
                    style={[
                      styles.cellText,
                      key === "net" ? { textAlign: "right" } : textStyle,
                    ]}
                  >
                    {row[key]}
                  </PdfText>
                </View>
              ))}
            </View>
          ))}
          {!model.rows.length && (
            <PdfText style={[styles.note, textStyle]}>{model.empty}</PdfText>
          )}
          <View style={styles.footer} fixed />
          <PdfText
            fixed
            style={{
              position: "absolute",
              top: 562,
              left: 30,
              fontSize: 7,
              color: "#64748b",
            }}
          >
            {model.generatedLabel}
          </PdfText>
          <PdfText
            fixed
            style={{
              position: "absolute",
              top: 562,
              left: 102,
              fontSize: 7,
              color: "#64748b",
            }}
          >
            {model.generatedDate}
          </PdfText>
          <PdfText
            fixed
            style={{
              position: "absolute",
              top: 562,
              right: 30,
              fontSize: 7,
              color: "#64748b",
            }}
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </Page>
      </Document>
    </PdfDirectionContext.Provider>
  );
}
