import { Text } from "@react-pdf/renderer";

import { usePdfDirection } from "../pdfDirection";

const ARABIC = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
// U+200F RIGHT-TO-LEFT MARK: invisible, sets the line's base direction.
const RLM = String.fromCharCode(0x200f);

const markRtl = (text) => (typeof text === "string" && ARABIC.test(text) ? `${RLM}${text}` : text);

/*
 * Text with the right paragraph direction. The PDF engine takes a line's
 * base direction from its first character, so in an Arabic document a line
 * that starts with a digit ("1 أغسطس 2026") would be laid out left to right.
 * Arabic text is therefore prefixed with a right-to-left mark (a `direction`
 * style would also flip the element's layout). Text without Arabic letters —
 * amounts, currency codes, English names — is left alone, so "1,250.00 ILS"
 * never flips. `render` texts (page numbers) are handled the same way.
 */
export default function PdfText({ children, render, ...props }) {
  const { rtl } = usePdfDirection();
  // Only a text that has a `render` may carry the prop: react-pdf treats any
  // `render` key, even undefined, as a dynamic text.
  const dynamic = render ? { render: rtl ? (context) => markRtl(render(context)) : render } : {};

  return (
    <Text {...props} {...dynamic}>
      {rtl ? markRtl(children) : children}
    </Text>
  );
}
