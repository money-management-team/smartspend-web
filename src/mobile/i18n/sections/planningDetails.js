/* The budget and goal pages: what was added around the existing read-only progress. Nothing here avoids saying what is read. */
export const planningDetails = {
  en: {
    budgetView: {
      hint: {
        safe: "Spending is well within the limit.",
        warning: "Spending is getting closer to the limit.",
        near_limit: "Spending is very close to the limit.",
        exceeded: "Spending has gone past the limit.",
      },
      expenses: "See the expenses in this period",
      expensesHintAll: "Opens Activity for these dates",
      expensesHintCategory: "Opens Activity for these dates and this category",
    },
    goalView: {
      accountOpen: "Open the goal's account",
      movements: {
        title: "Money movements",
        hint: "Money moved into and out of this goal, newest first. Each one is a transfer.",
        tabsLabel: "Show",
        tabs: { all: "All", contribution: "Added", withdrawal: "Withdrawn" },
        loading: "Loading movements",
        empty: {
          all: "Nothing has been moved into or out of this goal yet.",
          contribution: "Nothing has been added to this goal yet.",
          withdrawal: "Nothing has been taken out of this goal yet.",
        },
        type: { contribution: "Added", withdrawal: "Taken out" },
        unknownType: "Movement: {{type}}",
        newer: "Newer",
        older: "Older",
        page: "Page {{page}} of {{pages}}",
        unavailable: "Movements can't be shown for this goal.",
      },
    },
  },
  ar: {
    budgetView: {
      hint: {
        safe: "الإنفاق ضمن الحد بمسافة مريحة.",
        warning: "الإنفاق يقترب من الحد.",
        near_limit: "الإنفاق قريب جدًا من الحد.",
        exceeded: "الإنفاق تجاوز الحد.",
      },
      expenses: "عرض المصروفات في هذه الفترة",
      expensesHintAll: "يفتح النشاط لهذه التواريخ",
      expensesHintCategory: "يفتح النشاط لهذه التواريخ وهذه الفئة",
    },
    goalView: {
      accountOpen: "افتح حساب الهدف",
      movements: {
        title: "حركات المال",
        hint: "الأموال التي دخلت هذا الهدف وخرجت منه، الأحدث أولًا. كل حركة تحويل.",
        tabsLabel: "عرض",
        tabs: { all: "الكل", contribution: "الإيداعات", withdrawal: "السحوبات" },
        loading: "جارٍ تحميل الحركات",
        empty: {
          all: "لم يُنقل أي مال إلى هذا الهدف أو منه بعد.",
          contribution: "لم يُضف شيء إلى هذا الهدف بعد.",
          withdrawal: "لم يُسحب شيء من هذا الهدف بعد.",
        },
        type: { contribution: "أُضيف", withdrawal: "سُحب" },
        unknownType: "حركة: {{type}}",
        newer: "الأحدث",
        older: "الأقدم",
        page: "الصفحة {{page}} من {{pages}}",
        unavailable: "لا يمكن عرض الحركات لهذا الهدف.",
      },
    },
  },
};
