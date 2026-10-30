import i18n from "../../i18n";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";

/*
 * The strings of a goal's Smart Savings plan section. They live here, not in
 * i18n/messages.js, so that a build with Smart Savings off has no Smart Savings
 * text in the Mobile chunk: this module is imported only by SmartPlanSection,
 * which is only loaded behind the flag (smartSavingsGate.js).
 * tests/mobileSavings.test.mjs keeps the two languages in key parity.
 * Intensity and affordability labels are the full version's own
 * (dashboard.savingsGoals.overview.intensity, smartPlanWizard.plan.bands).
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
    readOnly: "Mobile shows the plan and lets you review an installment. Confirming, postponing, skipping or changing it is only in the full version.",
    openFull: "Open this plan in the full version",
    plan: "Plan", rhythm: "Rhythm", every: "Every {{count}} × {{unit}}", unit: { weekly: "week", monthly: "month", yearly: "year" },
    perInstallment: "Per installment", final: "Final installment", stillScheduled: "Still scheduled", completes: "Expected to finish", target: "Target date",
    overdueCount: "{{count}} overdue", atRisk: "Target at risk",
    intensity: { easy: "Easy", balanced: "Balanced", intensive: "Intensive" },
    installments: "Open installments", noOpen: "No installment is open.", number: "Installment {{sequence}}", postponedTimes: "Postponed {{count}} times",
    showAll: "Show all {{count}}", showFewer: "Show fewer", resolved: "Earlier installments ({{count}})",
    status: { confirmed: "Confirmed", skipped: "Skipped", missed: "Missed", cancelled: "Cancelled", partially_reversed: "Partly reversed", planned: "Open" },
    review: {
      confirm: { open: "Confirm…", title: "Confirm installment {{sequence}}", intro: "Confirming moves the amount from the account you choose into the goal.", send: "Confirm and move money" },
      postpone: { open: "Postpone…", title: "Postpone installment {{sequence}}", intro: "Postponing moves this installment's date. No money moves.", send: "Postpone" },
      skip: { open: "Skip…", title: "Skip installment {{sequence}}?", intro: "Skipping closes this installment without moving money.", send: "Skip it" },
    },
    previewLoading: "Checking what this would move", stale: "This installment is no longer open, or has changed. Close and look at the plan again.",
    goal: "Goal", due: "Due", scheduled: "Scheduled amount", toMove: "Amount to move",
    blocker: { other: "This installment can't be confirmed right now." },
    fromAccount: "From account", noAccounts: "No account can be used for this.", cantCover: "can't cover it",
    fundingUnavailable: "Splitting this installment across several accounts isn't shown on Mobile: working out that split needs a request Mobile doesn't make yet. The full version shows it.",
    balanceNote: "Balances and whether an account can pay are SmartSpend's own figures. They are checked again on confirmation.",
    versions: "Plan version {{plan}}, installment version {{lock}}. A change elsewhere makes this review out of date.",
    postponeUnavailable: "There is no date this installment can move to. Revising the plan is done in the full version.",
    postponeRuleToday: "Today or later, and after its current date.", postponeRuleMax: "No later than {{date}}.", postponedBefore: "Already postponed {{count}} times.",
    newDate: "New date", dateError: { required: "Choose a date.", date: "Enter a real date.", bounds: "Choose a date within the rules above." },
    skipMeans: { noMoney: "No money moves.", targetSame: "The target and target date don't change.", notSpread: "The amount isn't spread over other installments.", final: "A skip can't be undone." },
    checked: "The date fits the rules.", checkDate: "Check the date",
    notSent: "Mobile doesn't send this yet. Nothing has been changed.", keepIt: "Keep it", close: "Close",
    optionsIntro: "See the plans SmartSpend suggests for this goal. Choose a rhythm.",
    rhythms: { weekly: "Weekly", biweekly: "Every 2 weeks", monthly: "Monthly", quarterly: "Every 3 months" },
    optionsLoading: "Loading options", noOptions: "No plan is suggested for this rhythm.", option: "Option",
    estimate: "Estimate", affordability: { comfortable: "Comfortable", stretch: "A stretch", strained: "Strained", unaffordable: "Beyond your estimated room", unknown: "Affordability unknown" },
    notFeasible: "Not possible by the target date", duplicate: "Same schedule as another option",
    notAdvice: "An estimate, not a guarantee or financial advice.", createPlan: "Start this plan", createClosed: "Starting a plan isn't available in Mobile yet. Use the full version.",
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
    readOnly: "تعرض نسخة الجوال الخطة وتتيح مراجعة القسط. التأكيد أو التأجيل أو التخطي أو التعديل متاح في النسخة الكاملة فقط.",
    openFull: "افتح هذه الخطة في النسخة الكاملة",
    plan: "الخطة", rhythm: "الإيقاع", every: "كل {{count}} × {{unit}}", unit: { weekly: "أسبوع", monthly: "شهر", yearly: "سنة" },
    perInstallment: "لكل قسط", final: "القسط الأخير", stillScheduled: "ما زال مجدولًا", completes: "الإنجاز المتوقع", target: "التاريخ المستهدف",
    overdueCount: "{{count}} متأخرة", atRisk: "الهدف معرّض للخطر",
    intensity: { easy: "سهلة", balanced: "متوازنة", intensive: "مكثّفة" },
    installments: "الأقساط المفتوحة", noOpen: "لا يوجد قسط مفتوح.", number: "القسط {{sequence}}", postponedTimes: "أُجّل {{count}} مرات",
    showAll: "اعرض الكل ({{count}})", showFewer: "اعرض أقل", resolved: "الأقساط السابقة ({{count}})",
    status: { confirmed: "مؤكد", skipped: "متخطى", missed: "فائت", cancelled: "ملغى", partially_reversed: "معكوس جزئيًا", planned: "مفتوح" },
    review: {
      confirm: { open: "تأكيد…", title: "تأكيد القسط {{sequence}}", intro: "التأكيد ينقل المبلغ من الحساب الذي تختاره إلى الهدف.", send: "أكّد وانقل المال" },
      postpone: { open: "تأجيل…", title: "تأجيل القسط {{sequence}}", intro: "التأجيل يغيّر تاريخ هذا القسط فقط. لا يتحرك أي مال.", send: "أجّل" },
      skip: { open: "تخطٍّ…", title: "تخطي القسط {{sequence}}؟", intro: "التخطي يغلق هذا القسط دون تحريك أي مال.", send: "تخطَّه" },
    },
    previewLoading: "جارٍ التحقق مما سينتقل", stale: "هذا القسط لم يعد مفتوحًا أو تغيّر. أغلق وانظر إلى الخطة من جديد.",
    goal: "الهدف", due: "الاستحقاق", scheduled: "المبلغ المجدول", toMove: "المبلغ الذي سينتقل",
    blocker: { other: "لا يمكن تأكيد هذا القسط حاليًا." },
    fromAccount: "من حساب", noAccounts: "لا يوجد حساب يمكن استخدامه لهذا.", cantCover: "لا يغطيه",
    fundingUnavailable: "لا تعرض نسخة الجوال توزيع هذا القسط على عدة حسابات: حساب هذا التوزيع يحتاج إلى طلب لا ترسله نسخة الجوال بعد. تعرضه النسخة الكاملة.",
    balanceNote: "الأرصدة وقدرة الحساب على الدفع أرقام SmartSpend نفسها، ويُعاد التحقق منها عند التأكيد.",
    versions: "نسخة الخطة {{plan}}، نسخة القسط {{lock}}. أي تغيير في مكان آخر يجعل هذه المراجعة قديمة.",
    postponeUnavailable: "لا يوجد تاريخ يمكن نقل هذا القسط إليه. تعديل الخطة يتم في النسخة الكاملة.",
    postponeRuleToday: "اليوم أو بعده، وبعد تاريخه الحالي.", postponeRuleMax: "في موعد لا يتجاوز {{date}}.", postponedBefore: "أُجّل من قبل {{count}} مرات.",
    newDate: "التاريخ الجديد", dateError: { required: "اختر تاريخًا.", date: "أدخل تاريخًا صحيحًا.", bounds: "اختر تاريخًا ضمن القواعد أعلاه." },
    skipMeans: { noMoney: "لا يتحرك أي مال.", targetSame: "لا يتغير المبلغ المستهدف ولا تاريخه.", notSpread: "لا يُوزَّع المبلغ على الأقساط الأخرى.", final: "لا يمكن التراجع عن التخطي." },
    checked: "التاريخ يوافق القواعد.", checkDate: "تحقّق من التاريخ",
    notSent: "لا ترسل نسخة الجوال هذا بعد. لم يتغير شيء.", keepIt: "احتفظ به", close: "إغلاق",
    optionsIntro: "اطّلع على الخطط التي يقترحها SmartSpend لهذا الهدف. اختر إيقاعًا.",
    rhythms: { weekly: "أسبوعيًا", biweekly: "كل أسبوعين", monthly: "شهريًا", quarterly: "كل 3 أشهر" },
    optionsLoading: "جارٍ تحميل الخيارات", noOptions: "لا توجد خطة مقترحة لهذا الإيقاع.", option: "خيار",
    estimate: "تقدير", affordability: { comfortable: "مريحة", stretch: "تتطلب جهدًا", strained: "مرهقة", unaffordable: "تتجاوز مساحتك التقديرية", unknown: "القدرة على التحمّل غير معروفة" },
    notFeasible: "غير ممكنة قبل التاريخ المستهدف", duplicate: "الجدول نفسه لخيار آخر",
    notAdvice: "تقدير، وليس ضمانًا ولا نصيحة مالية.", createPlan: "ابدأ هذه الخطة", createClosed: "بدء خطة غير متاح في نسخة الجوال بعد. استخدم النسخة الكاملة.",
  },
};

for (const [language, plan] of Object.entries(SMART_PLAN_MESSAGES)) {
  i18n.addResourceBundle(language, MOBILE_NAMESPACE, { planning: { goals: { plan } } }, true, true);
}
