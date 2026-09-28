import cairoBold from "../../../../../assets/fonts/Cairo-Bold.ttf?url";
import cairoRegular from "../../../../../assets/fonts/Cairo-Regular.ttf?url";
import cairoSemiBold from "../../../../../assets/fonts/Cairo-SemiBold.ttf?url";
import tajawalBold from "../../../../../assets/fonts/Tajawal-Bold.ttf?url";
import tajawalExtraBold from "../../../../../assets/fonts/Tajawal-ExtraBold.ttf?url";
import logo from "../../../../../assets/smart-spend-logo-pdf.png?url";

// Files the PDF embeds, as URLs Vite emits with the build. The logo is a
// 319 × 309 copy of smart-spend-logo.png, enough for print at header size.
export const PDF_FONT_FILES = { cairoRegular, cairoSemiBold, cairoBold, tajawalBold, tajawalExtraBold };
export const PDF_LOGO_URL = logo;
