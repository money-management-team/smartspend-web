/*
 * Mobile strings. They live in their own i18next namespace ("mobile"),
 * registered by ./register.js when the Mobile chunk loads, instead of in
 * src/locales/*.json: those files are bundled into the main i18n chunk, so a
 * Mobile section there would ship in builds where Mobile is off.
 *
 * tests/mobileShell.test.mjs keeps the two languages in exact key parity.
 */
export const MOBILE_NAMESPACE = "mobile";

export const MOBILE_MESSAGES = {
  en: {
    skip: "Skip to content",
    bar: { logo: "SmartSpend" },
    nav: {
      label: "Main navigation",
      home: "Home",
      activity: "Activity",
      add: "Add",
      planning: "Planning",
      more: "More",
      menu: "Menu",
      menuTitle: "Menu",
      menuClose: "Close menu",
    },
    titles: {
      home: "Home",
      activity: "Activity",
      planning: "Planning",
      more: "More",
      notAvailable: "Not available",
    },
    placeholder: {
      heading: "Mobile Foundation preview",
      body: "This screen is a placeholder while the Mobile experience is being built. It shows no financial data.",
      nothing: "Nothing here is a real account, balance or transaction.",
      full: "The full SmartSpend app is unchanged and still available.",
    },
    add: {
      title: "Add",
      body: "Adding income, expenses and transfers is not available in this early Mobile preview. Nothing can be recorded from here yet.",
      close: "Close",
    },
    more: {
      appearance: "Appearance",
      theme: "Theme",
      themeLight: "Light",
      themeDark: "Dark",
      language: "Language",
      languageEn: "English",
      languageAr: "العربية",
      presentation: "Version of the app",
      presentationHint: "Automatic uses this version on phones. Your choice is saved on this device only.",
      auto: "Automatic",
      mobile: "Mobile",
      desktop: "Full version",
      openFull: "Open the full version",
    },
    notAvailable: {
      body: "This Mobile page is not available.",
      home: "Back to Home",
    },
  },
  ar: {
    skip: "تخطَّ إلى المحتوى",
    bar: { logo: "SmartSpend" },
    nav: {
      label: "التنقل الرئيسي",
      home: "الرئيسية",
      activity: "النشاط",
      add: "إضافة",
      planning: "التخطيط",
      more: "المزيد",
      menu: "القائمة",
      menuTitle: "القائمة",
      menuClose: "إغلاق القائمة",
    },
    titles: {
      home: "الرئيسية",
      activity: "النشاط",
      planning: "التخطيط",
      more: "المزيد",
      notAvailable: "غير متاح",
    },
    placeholder: {
      heading: "معاينة أساس نسخة الجوال",
      body: "هذه الشاشة مؤقتة أثناء بناء نسخة الجوال. لا تعرض أي بيانات مالية.",
      nothing: "لا شيء هنا يمثل حسابًا أو رصيدًا أو معاملة حقيقية.",
      full: "تطبيق SmartSpend الكامل كما هو ولا يزال متاحًا.",
    },
    add: {
      title: "إضافة",
      body: "إضافة الدخل والمصروفات والتحويلات غير متاحة في هذه المعاينة المبكرة لنسخة الجوال. لا يمكن تسجيل أي شيء من هنا بعد.",
      close: "إغلاق",
    },
    more: {
      appearance: "المظهر",
      theme: "السمة",
      themeLight: "فاتحة",
      themeDark: "داكنة",
      language: "اللغة",
      languageEn: "English",
      languageAr: "العربية",
      presentation: "نسخة التطبيق",
      presentationHint: "الوضع التلقائي يستخدم نسخة الجوال على الهواتف. يُحفظ اختيارك على هذا الجهاز فقط.",
      auto: "تلقائي",
      mobile: "الجوال",
      desktop: "النسخة الكاملة",
      openFull: "افتح النسخة الكاملة",
    },
    notAvailable: {
      body: "صفحة الجوال هذه غير متاحة.",
      home: "العودة إلى الرئيسية",
    },
  },
};
