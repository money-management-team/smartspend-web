export const PATH = {
  HOME: "/",
  AUTH: {
    ACCOUNT_TYPE: "/account-type",
    SIGNIN: "/signin",
    REGISTER: "/register",
    COMPANY_SIGNIN: "/signin/company",
    COMPANY_REGISTER: "/register/company",
    FORGOT_PASSWORD: "/forgot-password",
    RESET_PASSWORD: "/reset-password",
    VERIFY_CODE: "/verify-code",
    PASSWORD_CHANGED: "/password-changed",
    // Followed by /:id/:hash?expires=…&signature=… (the emailed signed link).
    VERIFY_EMAIL: "/verify-email",
  },
  USER: {
    DASHBOARD: "/dashboard",
    ACCOUNTS: "/dashboard/accounts",
    ACCOUNT_DETAILS: "/dashboard/accounts/:accountId",
    CATEGORIES: "/dashboard/categories",
    CATEGORY_DETAILS: "/dashboard/categories/:categoryId",
    FINANCIAL_OPERATIONS: "/dashboard/financial-operations",
    TRANSACTION_DETAILS: "/dashboard/financial-operations/:transactionId",
    TRANSFERS: "/dashboard/transfers",
    TRANSFER_DETAILS: "/dashboard/transfers/:transferId",
    RECURRING: "/dashboard/recurring",
    RECURRING_DETAILS: "/dashboard/recurring/:recurringTransactionId",
    CALENDAR: "/dashboard/calendar",
    IMPORT: "/dashboard/import",
    IMPORT_HISTORY: "/dashboard/import/history",
    AI_EXPENSE_CAPTURES: "/dashboard/ai-expense-captures",
    AI_EXPENSE_CAPTURE_DETAILS: "/dashboard/ai-expense-captures/:captureId",
    BUDGETS: "/dashboard/budgets",
    BUDGET_DETAILS: "/dashboard/budgets/:budgetId",
    SAVINGS_GOALS: "/dashboard/savings-goals",
    SAVINGS_GOAL_DETAILS: "/dashboard/savings-goals/:savingsGoalId",
    DEBTS: "/dashboard/debts",
    DEBT_DETAILS: "/dashboard/debts/:debtId",
    REPORTS: "/dashboard/reports",
    REPORT_EXPORTS: "/dashboard/reports/exports",
    AI_ASSISTANT: "/dashboard/ai-assistant",
    NOTIFICATIONS: "/dashboard/notifications",
    SETTING: "/dashboard/settings",
  },
};

/* What the guest came to do; the account type page reads it from `?intent=`. */
export const AUTH_INTENT = {
  SIGNIN: "signin",
  REGISTER: "register",
};

export const getAccountTypePath = (intent = AUTH_INTENT.REGISTER) =>
  `${PATH.AUTH.ACCOUNT_TYPE}?intent=${intent}`;

/*
 * The import wizard resumes an existing import from `?import=`, so a link
 * from the history opens the same page at whatever step its status implies.
 */
export const getImportPath = (importId) =>
  `${PATH.USER.IMPORT}?import=${encodeURIComponent(importId)}`;

export const getAccountDetailsPath = (accountId) =>
  PATH.USER.ACCOUNT_DETAILS.replace(
    ":accountId",
    encodeURIComponent(accountId),
  );

export const getTransactionDetailsPath = (transactionId) =>
  PATH.USER.TRANSACTION_DETAILS.replace(
    ":transactionId",
    encodeURIComponent(transactionId),
  );

/* The review screen of one AI expense capture. */
export const getAiExpenseCapturePath = (captureId) =>
  PATH.USER.AI_EXPENSE_CAPTURE_DETAILS.replace(
    ":captureId",
    encodeURIComponent(captureId),
  );

/* Opens the financial operations page with the new-operation form on `type`
   (income or expense); transfers have their own page. */
export const getNewOperationPath = (type) =>
  `${PATH.USER.FINANCIAL_OPERATIONS}?new=${encodeURIComponent(type)}`;

export const getTransferDetailsPath = (transferId) =>
  PATH.USER.TRANSFER_DETAILS.replace(
    ":transferId",
    encodeURIComponent(transferId),
  );

/* Opens the transfers page with the new-transfer form open. */
export const getNewTransferPath = () => `${PATH.USER.TRANSFERS}?new=1`;

export const getCategoryDetailsPath = (categoryId) =>
  PATH.USER.CATEGORY_DETAILS.replace(
    ":categoryId",
    encodeURIComponent(categoryId),
  );

export const getBudgetDetailsPath = (budgetId) =>
  PATH.USER.BUDGET_DETAILS.replace(":budgetId", encodeURIComponent(budgetId));

export const getSavingsGoalDetailsPath = (savingsGoalId) =>
  PATH.USER.SAVINGS_GOAL_DETAILS.replace(
    ":savingsGoalId",
    encodeURIComponent(savingsGoalId),
  );

/* Opens the savings goals page with the new-goal form open. */
export const getNewSavingsGoalPath = () => `${PATH.USER.SAVINGS_GOALS}?new=1`;

export const getDebtDetailsPath = (debtId) =>
  PATH.USER.DEBT_DETAILS.replace(":debtId", encodeURIComponent(debtId));

export const getRecurringDetailsPath = (recurringTransactionId) =>
  PATH.USER.RECURRING_DETAILS.replace(
    ":recurringTransactionId",
    encodeURIComponent(recurringTransactionId),
  );

/* The Notifications page on its Financial alerts tab (calculated alerts, not
   the persistent notification inbox). */
export const getFinancialAlertsPath = () => `${PATH.USER.NOTIFICATIONS}?tab=alerts`;

/*
 * Page of the record a calendar event or a notification refers to. The
 * backend sends a reference (`subject_type` + `subject_id`), never a URL, so
 * the frontend maps it to its own routes here. An unknown type or a missing
 * id returns null: the item is shown without a link.
 */
const SUBJECT_PATHS = {
  recurring_transaction: getRecurringDetailsPath,
  debt: getDebtDetailsPath,
  budget: getBudgetDetailsPath,
  savings_goal: getSavingsGoalDetailsPath,
  transaction: getTransactionDetailsPath,
  transfer: getTransferDetailsPath,
  account: getAccountDetailsPath,
  category: getCategoryDetailsPath,
};

export const getSubjectPath = (subjectType, subjectId) =>
  typeof subjectType === "string" &&
  Object.hasOwn(SUBJECT_PATHS, subjectType) &&
  subjectId != null &&
  subjectId !== ""
    ? SUBJECT_PATHS[subjectType](subjectId)
    : null;
