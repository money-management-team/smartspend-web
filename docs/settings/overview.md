# Settings (الإعدادات) - Overview

## Purpose
The Settings module allows users to manage their personal profile, account security, interface preferences, and AI financial assistant settings.

## Key Screens & Tabs

1. **Profile Settings (الملف الشخصي)**:
   - User avatar card with dynamic initials badge (`LH`), display name, and active status indicator.
   - Form fields: Full Name, Email, Phone Number, and Preferred Currency (USD, ILS, EUR, SAR, AED, JOD).
   - Real-time cloud sync badge (`تمت مزامنة جميع البيانات المشفرة بأمان`).
   - Save Changes and Cancel actions wired to `authApi.updateProfile` and authentication context.

2. **Security & Protection (الأمان والحماية)**:
   - Password change card with current password, new password, confirm password fields, eye visibility toggles, and dynamic 4-bar strength indicator (`قوية`).
   - Two-Factor Authentication (2FA) card with recommended badge, Google Authenticator integration details, and interactive toggle switch.
   - Active devices and sessions monitor: lists connected platforms (MacBook Pro, iPhone 15 Pro, Windows PC), current session indicator, and individual/bulk session termination actions.
   - Bank-grade protection badge (`حسابك محمي بنظام التشفير والمصادقة متعددة المراحل`).

3. **App Preferences (التفضيلات)**:
   - Display Language selection cards (العربية RTL / English LTR) that immediately update document direction, layout, and localized copy.
   - Appearance and Theme cards (Light Mode, Dark Mode, System Mode) integrated with `useThemeContext` and OS preference detection.
   - General notifications toggle with live status pill badge (`مفعل` / `معطل`).
   - Date and currency formatting options (`DD/MM/YYYY`, currency position before/after amount).
   - Persistent preference storage in `localStorage`.

4. **AI Settings (إعدادات الذكاء الاصطناعي)**:
   - Proactive spending alerts toggle (`تنبيهات الإنفاق الاستباقية`).
   - Automatic savings opportunities toggle (`اقتراحات الادخار التلقائية`).
   - Privacy and transaction analysis toggle with 256-bit encryption indicator (`مشفرة بتقنية 256-bit`).
   - Chat history management action with red outline purge button.
   - Cloud sync badge and save/cancel actions.

5. **Confirm Delete Chat History Modal (تأكيد حذف سجل المحادثات)**:
   - Triggered from the AI Settings purge action.
   - Red circular trash icon badge with smooth backdrop blur.
   - Clear warning prompt and contextual alert regarding assistant memory reset.
   - Immediate confirmation (`نعم، حذف السجل`) and safe cancellation controls with keyboard accessibility (Escape key).
