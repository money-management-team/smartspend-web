import i18n from "../../i18n";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";

/*
 * The strings of a goal's Smart Savings plan section. They live here, not in
 * i18n/messages.js, so that a build with Smart Savings off has no Smart Savings
 * text in the Mobile chunk: this module is imported only by SmartPlanSection,
 * which is only loaded behind the flag (smartSavingsGate.js).
 * tests/mobileSavings.test.mjs keeps the two languages in key parity.
 */
export const SMART_PLAN_MESSAGES = {
  en: {
    title: "Smart Savings plan",
    loading: "Loading the plan",
    none: "This goal has no Smart Savings plan.",
    next: "Next planned contribution",
    noNext: "None scheduled",
    nextAmount: "Planned amount",
    overdue: "Overdue",
    replan: "Plan review suggested",
    notExecutable: "Can't be confirmed right now",
    readOnly: "Mobile shows the plan. Confirming, postponing, skipping or changing it is only in the full version.",
    openFull: "Open this plan in the full version",
  },
  ar: {
    title: "خطة الادخار الذكي",
    loading: "جارٍ تحميل الخطة",
    none: "لا توجد خطة ادخار ذكي لهذا الهدف.",
    next: "الإيداع المخطط التالي",
    noNext: "لا يوجد موعد",
    nextAmount: "المبلغ المخطط",
    overdue: "متأخر",
    replan: "يُقترح مراجعة الخطة",
    notExecutable: "لا يمكن تأكيده حاليًا",
    readOnly: "تعرض نسخة الجوال الخطة. التأكيد أو التأجيل أو التخطي أو التعديل متاح في النسخة الكاملة فقط.",
    openFull: "افتح هذه الخطة في النسخة الكاملة",
  },
};

for (const [language, plan] of Object.entries(SMART_PLAN_MESSAGES)) {
  i18n.addResourceBundle(language, MOBILE_NAMESPACE, { planning: { goals: { plan } } }, true, true);
}
