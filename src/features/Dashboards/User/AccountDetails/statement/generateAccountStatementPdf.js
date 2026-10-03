import { createElement } from "react";
import { pdf } from "@react-pdf/renderer";
import { registerPdfFonts } from "../../Reports/pdf/pdfTheme";
import { PDF_FONT_FILES, PDF_LOGO_URL } from "../../Reports/pdf/pdfAssets";
import { buildStatementPdfModel } from "./statementPdfModel";
import AccountStatementDocument from "./AccountStatementDocument";

export async function generateAccountStatementPdf({
  statement,
  t,
  typeLabel,
  locale,
  language,
  signal,
}) {
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  registerPdfFonts(PDF_FONT_FILES);
  const model = buildStatementPdfModel({
    statement,
    t,
    typeLabel,
    locale,
    language,
  });
  const blob = await pdf(
    createElement(AccountStatementDocument, { model, logo: PDF_LOGO_URL }),
  ).toBlob();
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  return blob;
}
