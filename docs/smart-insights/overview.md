# Smart Insights Center (مركز الرؤى الذكية) - Overview

## Purpose
The Smart Insights Center provides autonomous predictive financial analytics, proactive cash flow alerts, spending velocity diagnostics, and actionable wealth optimization recommendations.

---

## Key Screens & Features

### 1. Top Financial KPIs Overview (مؤشرات العافية المالية والسيولة)
- **Financial Wellness Score (مؤشر العافية المالية)**: Circular score ring displaying dynamic rating (84 / ممتاز), performance benchmark ("متفوق على 78% من النمط المشابه"), and last evaluation timestamp.
- **Safe Available Liquidity (السيولة الآمنة المتاحة)**: Net liquidity amount (28,450 SAR) with growth badge (+12%) and coverage indicator (4.5 months of essential expenses).
- **Promising Savings Opportunities (فرص ادخار واعدة)**: Monthly savings potential (1,820 SAR/mo), active count badge (3 suggestions), and investment transfer eligibility.
- **Spending Velocity Deviation (انحراف في وتيرة الصرف)**: Immediate alert (+24% above normal pace) identifying dining and cafes as the primary acceleration vector.

### 2. 30-Day Financial Forecast Overview Card (التوقع المالي لـ 30 يوماً - البطاقة الرئيسية)
- Full-width predictive card with high model accuracy badge (94%) and automated horizon update through August.
- Smooth SVG trend trajectory curve with Day 1 to Day 30 liquidity path visualization.
- Net expected cash flow summary (+6,250 SAR surplus) with proportional breakdown bars comparing expected income (18,500 SAR) and estimated expenses (12,250 SAR).
- Direct drill-down link ("عرض تفاصيل التوقع المالي ←") navigating to `/dashboard/smart-insights/forecast`.

### 3. Detailed 30-Day Financial Forecast & Cash Flow View (التوقع المالي والتدفقات النقدية 30 يوماً)
Accessible via `/dashboard/smart-insights/forecast` and sidebar navigation:
- **Header & Controls**:
  - Breadcrumb navigation: `مركز الرؤى الذكية / التوقع المالي والتدفقات النقدية (30 يوماً)` with back button.
  - AI Model confidence badge: `تحديث آلي • دقة النموذج 94%`.
  - Period selector: `أغسطس 2024 (الـ 30 يوماً القادمة)`.
  - Report export trigger: `تصدير التقرير المالي` (PDF/CSV generation feedback).
  - Scenario switcher: `النموذج القياسي (واقعي)` vs `سيناريو متحفظ (+10% طوارئ)`.
  - View tabs switcher:
    1. **All Flows (`كافة التدفقات`)**:
       - 3 Dynamic KPI cards: Expected Income (18,500 SAR, +4.2%), Expected Expenses (12,250 SAR, 66% safe cap), Net Flow (+6,250 SAR surplus).
       - Contextual Banner: Proactive liquidity alert for 3 overlapping bills between Aug 21-24 dipping balance to 9,420 SAR with quick fund transfer and rescheduling actions.
       - Interactive SVG Balance Trajectory Chart: Smooth curve with 95% confidence band, 5,000 SAR dashed safety line, pinned low-point tooltip (Aug 24 at 9,420 SAR), and Aug 27 salary surge (+16,000 SAR).
       - Milestones Table: 4 primary operations (Aug 10 Sukuk +2,500, Aug 15 Auto Loan -1,850, Aug 22 Utilities -1,140, Aug 27 Salary +16,000).
       - Financial Scenario Simulator: Discretionary spend variance tester (-20%, 0%, +15%, +40%) with real-time recalculation of net surplus and lowest balance dip.
    2. **Expected Income Only (`الدخل المتوقع فقط`)**:
       - 3 Dynamic KPI cards: Total Income (18,500 SAR), Confirmed Deposits (2 scheduled operations), AI Certainty Score (99.2%).
       - Contextual Banner: Liquidity optimization opportunity (+6,250 SAR surplus) with automated investment transfer trigger.
       - Stepped Income Accumulation Chart: Ascending staircase curve jumping at Aug 10 (+2,500 SAR) and Aug 27 (+16,000 SAR).
       - Confirmed Deposits Table: 3 confirmed deposits with certainty percentages.
       - 50/30/20 Rule Simulator: Interactive sliders and chips for 50% Needs, 30% Savings, 20% Wants with custom savings ratio adjustments (10%, 20%, 30%, 50%).
    3. **Expenses & Obligations (`المصروفات والالتزامات`)**:
       - 3 Dynamic KPI cards: Expected Expenses (12,250 SAR), Confirmed Obligations (6 scheduled, 100% auto-debit coverage), Peak Outflow Window (Aug 21-24, 3,690 SAR combined).
       - Contextual Banner: AI warning for peak obligations before salary arrival with split-bill and protective funding actions.
       - Cumulative Expense Curve Chart: Climbs toward 12,250 SAR safely beneath the 13,000 SAR red dashed budget ceiling, with critical peak zone tooltip.
       - Scheduled Obligations Table: 6 upcoming payments with status pills.
       - Expense Compression Optimizer Simulator: Discretionary spend reduction modeling (10%, 15%, 25%) with instant safety margin gain calculation (+337.50 SAR).

### 4. Recommendation Cards Grid (التوصيات والرؤى المستخلصة)
- **Dining Surge Alert**: Displays 3,450 SAR current spending vs 2,780 SAR historical benchmark, progress bar with excess indicator, instant 500 SAR weekly cap application, and deep-dive details trigger.
- **Cash Surplus to Deposit**: +4,450 SAR projected surplus with 5.2% annual yield estimate (+104 SAR first-year profit) and one-click auto-transfer activation.
- **Upcoming Subscriptions (4 services due in 5 days)**: Micro-breakdown grid (AWS 320 SAR, Gym 250 SAR, Netflix 65 SAR, iCloud 45 SAR) with reminder scheduling and review actions.
- **Portfolio Rebalancing**: Defensive asset weighting diagnostics (18% vs 25% target, 7% gap) with dual-color asset allocation bar and auto-rebalance execution.

### 5. AI Data Privacy & Security Modal (خصوصية وأمان بيانات الذكاء الاصطناعي)
- Triggered by clicking the security/privacy status badge in the footer or settings.
- Displays official banking-grade encryption badge (`AES-256`).
- 3 Clear commitments:
  1. Comprehensive financial data encryption via advanced banking protocols.
  2. Absolute zero data-sharing or selling to third parties or advertisers.
  3. Right to revoke consent and permanently wipe conversational memory anytime.
- 2 Granular consent controls (historical analysis consent & conversational history logging).
- "موافقة ومتابعة" (Approve & Continue) action with persistent local storage state.

### 6. Modals & Interactive Overlays
- **Restaurant Spending Alert Details Modal (تنبيه نمط الإنفاق: ارتفاع غير معتاد في المطاعم)**:
  - Benchmark vs current surge bar, contextual root-cause callout, and itemized recent transactions list.
  - Weekly 500 SAR cap recommendation action with custom adjustment and dismiss options.
- **Smart Savings Suggestions Modal (اقتراحات الادخار الذكية)**:
  - Total savings potential banner (780 SAR/mo).
  - Interactive suggestion cards: Dining & cafes rationalization (+350 SAR/mo, 94% success rate) and unused subscriptions consolidation (+180 SAR/mo).
  - Visual progress tracker toward the July savings goal.
  - Single and batch application controls (`تطبيق جميع الاقتراحات`).
- **Docked Bottom Savings Bar (الشريط العائم لاقتراحات الادخار)**:
  - Floating prompt for instant savings action.
