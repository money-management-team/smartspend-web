import RecurringHeader from "./components/RecurringHeader/RecurringHeader";
import RecurringSection from "./components/RecurringSection/RecurringSection";

import "./Recurring.css";

const dueNow = [
  {
    id: 1,
    key: "internet",
    type: "expense",
    amount: -45,
    category: "utilities",
    account: "checking",
    frequency: "monthly",
    nextDate: "2026-08-11",
    status: "overdue",
  },
  {
    id: 2,
    key: "rent",
    type: "expense",
    amount: -1850,
    category: "housing",
    account: "checking",
    frequency: "monthly",
    nextDate: "2026-08-14",
    days: 2,
    previousAmount: 1800,
  },
];

const recurringIncome = [
  {
    id: 3,
    key: "salary",
    type: "income",
    amount: 5200,
    category: "salary",
    account: "checking",
    frequency: "monthly",
    nextDate: "2026-08-18",
    days: 6,
  },
];

const recurringExpenses = [
  {
    id: 4,
    key: "rent",
    type: "expense",
    amount: -1850,
    category: "housing",
    account: "checking",
    frequency: "monthly",
    nextDate: "2026-08-14",
    days: 2,
    previousAmount: 1800,
  },
  {
    id: 5,
    key: "internet",
    type: "expense",
    amount: -45,
    category: "utilities",
    account: "checking",
    frequency: "monthly",
    nextDate: "2026-08-11",
    status: "overdue",
  },
  {
    id: 6,
    key: "subscriptions",
    type: "expense",
    amount: -68,
    category: "software",
    account: "platinum",
    frequency: "monthly",
    nextDate: "2026-08-21",
    days: 9,
  },
];

export default function Recurring() {
  return (
    <div className="recurring-page">
      <RecurringHeader />

      <RecurringSection
        variant="due"
        titleKey="dashboard.recurring.sections.dueNow"
        subtitleKey="dashboard.recurring.sections.dueSubtitle"
        items={dueNow}
      />

      <div className="recurring-page__bottom-grid">
        <RecurringSection
          titleKey="dashboard.recurring.sections.income"
          items={recurringIncome}
        />

        <RecurringSection
          titleKey="dashboard.recurring.sections.expenses"
          items={recurringExpenses}
        />
      </div>
    </div>
  );
}