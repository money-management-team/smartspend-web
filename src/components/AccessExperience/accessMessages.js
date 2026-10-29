import appI18n from "../../i18n";
import { policyContent } from "./policyContent";

// Shared legal copy lives in policyContent.js; acceptance remains explicit.
export const accessMessages = {
  ar: {
    ...policyContent.ar,
    "googleWorking": "جارٍ إكمال الدخول…",
    "googleLoading": "جارٍ تجهيز Google…",
    "googleUnavailableHint": "تعذّر تجهيز Google. يمكنك إعادة المحاولة من الزر أو استخدام تسجيل الدخول العادي.",
    "close": "إغلاق",
    "brand": "مساحة أوضح لقراراتك المالية",
    "consentPrefix": "أوافق على",
    "and": "و",
    "policyTitle": "وضوح قبل أن تبدأ",
    "policyHint": "تعرّف على طريقة استخدام SmartSpend وكيف تُستخدم بياناتك، ثم اختر الموافقة للمتابعة.",
    "policyKicker": "الثقة تبدأ بالوضوح",
    "policySummary": "حسابك بيدك، وكل عملية مالية تحتاج تأكيدك.",
    "accept": "أوافق وأتابع",
    "back": "العودة إلى التسجيل",
    "consentHint": "اختيار «أوافق وأتابع» يؤكد موافقتك على الشروط والأحكام وسياسة الخصوصية معاً. فتح النافذة أو إغلاقها وحده لا يعني الموافقة.",
    "welcomeKicker": "خطوة هادئة نحو تنظيم أفضل",
    "welcomeTitle": "أهلاً بعودتك، {{name}}",
    "newTitle": "أهلاً بك، {{name}}",
    "welcomeHint": "مساحتك المالية جاهزة. ابدأ بما يهمك اليوم، واترك التفاصيل تتجمع بوضوح في مكان واحد.",
    "newHint": "يسعدنا أن تبدأ رحلتك مع SmartSpend. أضف حسابك الأول، ثم نظّم عملياتك وأهدافك بخطوات بسيطة.",
    "morning": "صباح الخير",
    "afternoon": "نهارك سعيد",
    "evening": "مساء الخير",
    "night": "أهلاً بك",
    "member": "صديقنا",
    "continue": "لنبدأ",
    "focus": "ما يحتاج انتباهي",
    "firstSteps": "أرشدني إلى البداية",
    "welcomeNote": "تظهر هذه البطاقة بعد الدخول؛ يمكنك إغلاقها والعودة إلى عملك مباشرة.",
    "welcomeFeatures": [
      {
        "title": "صورة أوضح",
        "body": "حساباتك وعملياتك في مساحة منظمة."
      },
      {
        "title": "إدخال يناسبك",
        "body": "يدوياً أو بالصوت أو عبر الفاتورة."
      },
      {
        "title": "قرارات بيدك",
        "body": "راجع المسودات قبل اعتمادها."
      }
    ]
  },
  en: {
    ...policyContent.en,
    "googleWorking": "Completing sign-in…",
    "googleLoading": "Loading Google…",
    "googleUnavailableHint": "Google could not load. Retry using the button or use your usual sign-in method.",
    "close": "Close",
    "brand": "A clearer space for your financial decisions",
    "consentPrefix": "I agree to the",
    "and": "and",
    "policyTitle": "Clarity before you begin",
    "policyHint": "Learn how SmartSpend works and how your data is used, then choose to agree and continue.",
    "policyKicker": "Trust starts with clarity",
    "policySummary": "Your account stays in your hands. Every financial action needs your confirmation.",
    "accept": "Agree and continue",
    "back": "Back to registration",
    "consentHint": "Choosing “Agree and continue” confirms acceptance of both the Terms & Conditions and Privacy Policy. Opening or closing this window alone does not mean acceptance.",
    "welcomeKicker": "A calm step toward better organization",
    "welcomeTitle": "Welcome back, {{name}}",
    "newTitle": "Welcome, {{name}}",
    "welcomeHint": "Your financial space is ready. Start with what matters today and keep the details organized in one clear place.",
    "newHint": "We're glad you're starting with SmartSpend. Add your first account, then organize your transactions and goals in a few simple steps.",
    "morning": "Good morning",
    "afternoon": "Good afternoon",
    "evening": "Good evening",
    "night": "Welcome",
    "member": "friend",
    "continue": "Let's begin",
    "focus": "What needs my attention",
    "firstSteps": "Show me the first steps",
    "welcomeNote": "This card appears after sign-in. You can close it and continue directly.",
    "welcomeFeatures": [
      {
        "title": "A clearer picture",
        "body": "Your accounts and transactions, neatly organized."
      },
      {
        "title": "Your choice of input",
        "body": "Manual entry, voice or a receipt."
      },
      {
        "title": "Your decisions",
        "body": "Review drafts before confirming them."
      }
    ]
  },
};
Object.entries(accessMessages).forEach(([language, messages]) =>
  appI18n.addResourceBundle(language, "access", messages, true, true),
);
