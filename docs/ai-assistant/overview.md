# AI Financial Assistant (المساعد المالي الذكي) - Overview

## Purpose
The AI Financial Assistant provides intelligent conversational insights, expense analysis, predictive financial forecasts, and proactive budgeting advice for users.

## Key Screens & States

1. **Default New Chat View (واجهة المحادثة الجديدة المباشرة)**:
   - Configured as the primary opening screen when navigating to the AI Assistant or clicking "+ محادثة جديدة".
   - Shows the proactive welcome financial insight bubble: *"Your July net cash flow was +$4,450. Dining is your fastest-growing category at +24%. Want a plan to bring it back in line?"* with the blue AI avatar.
   - Interactive prompt suggestion chips positioned prominently:
     - `أين ذهبت أموالي في يوليو؟`
     - `اقترح ميزانية للمطاعم`
     - `هل أنا على المسار لصندوق الطوارئ؟`
     - `كم يمكنني الادخار بأمان هذا الشهر؟`
   - Active message composer with "اسأل سمارت سبيند..." and direct send action.
   - Sidebar displays existing conversation threads with "+ محادثة جديدة" active.

2. **AI Data Privacy & Security Modal (خصوصية وأمان بيانات الذكاء الاصطناعي)**:
   - High-grade banking encryption badge (`AES-256`).
   - Core security commitments (full banking protocol encryption, zero third-party sharing or ads, instant revocation and history deletion from Settings).
   - Granular consent options for historical/current transaction analysis and conversation history retention.
   - Persistent preferences saved to `localStorage`.

3. **Error & Timeout Handling (كود الخطأ: ERR_503_TIMEOUT)**:
   - Resilient user interface handling temporary cloud analytics interruptions.
   - Detailed user reassurance regarding data safety and security.
   - Immediate action controls: retry query execution, live connection check, and one-click copy of the technical error report.
   - Conversation sidebar reflects active warning/error indicators.

4. **Forecasting & Liquidity Skeleton Preview (التوقع المالي والسيولة)**:
   - Shimmering loading state for complex multi-factor financial projections.
   - Live status indicator with pulsating status dot.
   - Realistic structure skeletons: KPI metric cards, smooth SVG trend forecast curves with axes, and breakdown category lists.
   - Composer auto-disables during ongoing generation to prevent duplicate requests.

5. **Deep Analysis & Progress Tracking (التحليل الشهري)**:
   - Step-by-step progress tracking for heavy operations (e.g., categorizing 142 bank transactions and computing averages).
   - Real-time animated progress bar and status spinner.
   - Proactive disclaimer notes regarding analytical processing times.
   - Docked contextual tips (e.g., direct banking link insights and machine-learning continuous adaptation).
