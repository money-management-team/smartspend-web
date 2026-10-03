# قائمة الملفات الجديدة والمعدلة

المقارنة مع ملف `Front.zip` المرفق. لم يُحذف أي ملف من كود المصدر أو الأصول الأصلية. ملفات البيئة الفعلية ومجلدات Git والتثبيت والبناء ليست ضمن أرشيف التسليم؛ الاحتفاظ بإعدادات البيئة موضح في دليل التشغيل.

- الملفات الجديدة: 30.
- الملفات المعدلة: 69.
- لا تغيير على `package.json` أو `package-lock.json` ولا اعتماديات جديدة.

## الملفات الجديدة

- `.gitignore`
- `README_NINE_ADDITIONS_AR.md`
- `docs/frontend-experience/CHANGED_FILES.md`
- `docs/frontend-experience/FRONTEND_NINE_ADDITIONS_AR.md`
- `src/features/Dashboards/User/AccountDetails/AccountStatementExport.jsx`
- `src/features/Dashboards/User/AccountDetails/accountStatement.js`
- `src/features/Dashboards/User/AccountDetails/statement/AccountStatementDocument.jsx`
- `src/features/Dashboards/User/AccountDetails/statement/generateAccountStatementPdf.js`
- `src/features/Dashboards/User/AccountDetails/statement/statementPdfModel.js`
- `src/features/Dashboards/User/CategoryDetails/CategoryHistory.jsx`
- `src/features/Dashboards/User/Experience/AttentionCenter.jsx`
- `src/features/Dashboards/User/Experience/DashboardExperience.jsx`
- `src/features/Dashboards/User/Experience/DisplayPreferences.jsx`
- `src/features/Dashboards/User/Experience/Experience.css`
- `src/features/Dashboards/User/Experience/ExperienceProvider.jsx`
- `src/features/Dashboards/User/Experience/GettingStarted.jsx`
- `src/features/Dashboards/User/Experience/ManualTemplateTools.jsx`
- `src/features/Dashboards/User/Experience/MonthlyReview.jsx`
- `src/features/Dashboards/User/Experience/PrivateMoney.jsx`
- `src/features/Dashboards/User/Experience/QuickTemplates.jsx`
- `src/features/Dashboards/User/Experience/SavedViews.jsx`
- `src/features/Dashboards/User/Experience/experienceContext.js`
- `src/features/Dashboards/User/Experience/experienceData.js`
- `src/features/Dashboards/User/Experience/experienceMessages.js`
- `src/features/Dashboards/User/Experience/experienceStore.js`
- `src/features/Dashboards/User/Experience/useExperience.js`
- `tests/accountStatement.test.mjs`
- `tests/experienceData.test.mjs`
- `tests/experiencePreferences.test.mjs`
- `tests/experienceRendering.test.mjs`

## الملفات المعدلة

- `src/features/Dashboards/User/AIAssistant/components/AiShared/AiShared.jsx`
- `src/features/Dashboards/User/AIAssistant/components/ChatPanel/ChatPanel.jsx`
- `src/features/Dashboards/User/AIAssistant/components/ForecastPanel/ForecastPanel.jsx`
- `src/features/Dashboards/User/AIAssistant/components/InsightsPanel/InsightsPanel.jsx`
- `src/features/Dashboards/User/AccountDetails/AccountDetails.jsx`
- `src/features/Dashboards/User/AccountDetails/AccountMovementHistory.jsx`
- `src/features/Dashboards/User/Accounts/components/AccountCard/AccountCard.jsx`
- `src/features/Dashboards/User/AiExpenseCaptureDetails/AiExpenseCaptureDetails.jsx`
- `src/features/Dashboards/User/AiExpenseCaptures/components/AiSuggestions/AiSuggestions.jsx`
- `src/features/Dashboards/User/AiExpenseCaptures/components/CaptureConfirm/CaptureConfirm.jsx`
- `src/features/Dashboards/User/AiExpenseCaptures/components/ReviewValues/ReviewValues.jsx`
- `src/features/Dashboards/User/BudgetDetails/BudgetDetails.jsx`
- `src/features/Dashboards/User/Budgets/components/BudgetForm/BudgetForm.jsx`
- `src/features/Dashboards/User/Budgets/components/BudgetList/BudgetCard.jsx`
- `src/features/Dashboards/User/Calendar/components/CalendarEvent/CalendarEvent.jsx`
- `src/features/Dashboards/User/CategoryDetails/CategoryDetails.jsx`
- `src/features/Dashboards/User/Dashboard/Dashboard.jsx`
- `src/features/Dashboards/User/Dashboard/components/CashFlowChart/CashFlowChart.jsx`
- `src/features/Dashboards/User/Dashboard/components/CurrencySummary/CurrencySummary.jsx`
- `src/features/Dashboards/User/Dashboard/components/DashboardHero/DashboardHero.jsx`
- `src/features/Dashboards/User/Dashboard/components/ExpenseCategories/ExpenseCategories.jsx`
- `src/features/Dashboards/User/Dashboard/components/FinancialAlerts/FinancialAlerts.jsx`
- `src/features/Dashboards/User/Dashboard/components/GeneralStats/GeneralStats.jsx`
- `src/features/Dashboards/User/Dashboard/components/MoneyDistribution/MoneyDistribution.jsx`
- `src/features/Dashboards/User/Dashboard/components/RecentTransactions/RecentTransactions.jsx`
- `src/features/Dashboards/User/Dashboard/components/RecurringCommitments/RecurringCommitments.jsx`
- `src/features/Dashboards/User/Dashboard/components/SummaryCards/SummaryCards.jsx`
- `src/features/Dashboards/User/DebtDetails/DebtDetails.jsx`
- `src/features/Dashboards/User/Debts/components/ArchiveDebtDialog/ArchiveDebtDialog.jsx`
- `src/features/Dashboards/User/Debts/components/DebtEditForm/DebtEditForm.jsx`
- `src/features/Dashboards/User/Debts/components/DebtForm/DebtForm.jsx`
- `src/features/Dashboards/User/Debts/components/DebtList/DebtList.jsx`
- `src/features/Dashboards/User/Debts/components/DebtPaymentForm/DebtPaymentForm.jsx`
- `src/features/Dashboards/User/Debts/components/DebtPayments/DebtPayments.jsx`
- `src/features/Dashboards/User/Debts/components/DebtSummary/DebtSummary.jsx`
- `src/features/Dashboards/User/Debts/components/ReverseDebtPaymentDialog/ReverseDebtPaymentDialog.jsx`
- `src/features/Dashboards/User/FinancialOperations/FinancialOperations.jsx`
- `src/features/Dashboards/User/FinancialOperations/components/AccountStep/AccountStep.jsx`
- `src/features/Dashboards/User/FinancialOperations/components/AiInputAllowance/AiInputAllowance.jsx`
- `src/features/Dashboards/User/FinancialOperations/components/CaptureStep/CaptureStep.jsx`
- `src/features/Dashboards/User/FinancialOperations/components/Ledger/Ledger.jsx`
- `src/features/Dashboards/User/FinancialOperations/components/NewOperation/NewOperation.jsx`
- `src/features/Dashboards/User/FinancialOperations/components/OperationsIntro/OperationsIntro.jsx`
- `src/features/Dashboards/User/FinancialOperations/components/ReviewOperationDialog/ReviewOperationDialog.jsx`
- `src/features/Dashboards/User/FinancialOperations/components/VoiceCapture/VoiceCaptureWorkflow.jsx`
- `src/features/Dashboards/User/Imports/Imports.jsx`
- `src/features/Dashboards/User/Notifications/components/NotificationItem/NotificationItem.jsx`
- `src/features/Dashboards/User/Recurring/components/RecurringActionDialog/RecurringActionDialog.jsx`
- `src/features/Dashboards/User/Recurring/components/RecurringOccurrences/RecurringOccurrences.jsx`
- `src/features/Dashboards/User/Recurring/components/RecurringOperationRow/RecurringOperationRow.jsx`
- `src/features/Dashboards/User/RecurringDetails/RecurringDetails.jsx`
- `src/features/Dashboards/User/Reports/Reports.jsx`
- `src/features/Dashboards/User/Reports/components/ReportTrendChart/ReportTrendChart.jsx`
- `src/features/Dashboards/User/Reports/components/ReportValue/ReportValue.jsx`
- `src/features/Dashboards/User/SavingsGoalDetails/SavingsGoalDetails.jsx`
- `src/features/Dashboards/User/SavingsGoals/components/GoalActionDialog/GoalActionDialog.jsx`
- `src/features/Dashboards/User/SavingsGoals/components/GoalActivity/GoalActivity.jsx`
- `src/features/Dashboards/User/SavingsGoals/components/GoalMovementForm/GoalMovementForm.jsx`
- `src/features/Dashboards/User/SavingsGoals/components/PlannedContributions/PlannedContributions.jsx`
- `src/features/Dashboards/User/SavingsGoals/components/SavingsGoalCard/SavingsGoalCard.jsx`
- `src/features/Dashboards/User/Settings/Settings.jsx`
- `src/features/Dashboards/User/TransactionDetails/TransactionDetails.jsx`
- `src/features/Dashboards/User/TransferDetails/TransferDetails.jsx`
- `src/features/Dashboards/User/Transfers/Transfers.jsx`
- `src/layouts/DashboardLayout/DashboardLayout.jsx`
- `src/layouts/DashboardLayout/components/DashboardHeader/DashboardHeader.jsx`
- `src/layouts/DashboardLayout/components/DashboardSidebar/DashboardSidebar.jsx`
- `src/routes/Path.js`
- `src/routes/Routes.jsx`

## ملفات تم التحقق من بقائها كما هي

- قوالب PDF الحالية: `src/features/Dashboards/User/Reports/pdf/` (19 ملفاً).
- طبقة API الحالية: `src/features/Dashboards/User/api/` (23 ملفاً).
- التنسيق المالي الحالي: `src/features/Dashboards/User/utils/formatters.js`.
- الصوت: `voiceCaptureContract.js`, `voiceCaptureFlow.js`, `voiceRecorder.js`, `voiceAudioWav.js`.
- حزم المشروع وإصداراتها وملف القفل.
