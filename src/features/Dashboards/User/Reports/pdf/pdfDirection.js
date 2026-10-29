import { createContext, useContext } from "react";

// Whether the document is Arabic (RTL). Set once by ReportPdfDocument.
export const PdfDirectionContext = createContext(false);

/*
 * Layout values for the document direction. PDF layout has no logical
 * properties, so every component reads its row order and alignment here
 * instead of mirroring blindly: rows flip, text aligns to the reading
 * start, and numbers stay left-to-right runs aligned to the end.
 */
export function usePdfDirection() {
  const rtl = useContext(PdfDirectionContext);

  return {
    rtl,
    row: rtl ? "row-reverse" : "row",
    start: rtl ? "right" : "left",
    end: rtl ? "left" : "right",
    flexStart: rtl ? "flex-end" : "flex-start",
    flexEnd: rtl ? "flex-start" : "flex-end",
    // Space after an element in reading order.
    gapAfter: (points) => (rtl ? { marginLeft: points } : { marginRight: points }),
  };
}
