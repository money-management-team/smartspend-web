# SmartSpend Dashboard API Integration

## Environment

ضع المتغير التالي في ملف `.env` الموجود بجانب `package.json`:

```env
VITE_API_BASE_URL=https://smartspend-backend-staging-vjthdp.laravel.cloud/api
```

يحتوي المتغير على `/api` مسبقًا، لذلك تستخدم طبقة الاتصال مسارات مثل `/dashboard` و`/accounts` مباشرة.

بعد تعديل `.env` أعد تشغيل Vite:

```bash
npm run dev
```

## Storage keys

تعتمد طبقة الاتصال على المفاتيح التي تحفظها صفحات التسجيل والدخول:

- `token`
- `token_type`
- `user`
- `workspace`

## Connected modules

- Dashboard: `GET /dashboard` و`GET /user`.
- Accounts: list, create, update and archive.
- Financial operations: list income/expense/transfer transactions, create income, create expense, create transfer and reverse a posted transaction.
- Profile settings: load current user and update name, email and phone.
- API services are also included for category CRUD, transaction details/update, transfer list/details and logout.

## API behavior

- يضاف `Authorization: Bearer <token>` تلقائيًا.
- المبالغ المرسلة تتحول إلى نص بأربع خانات عشرية.
- التحويلات تستخدم `Idempotency-Key` صالحًا، ويعاد استخدام المفتاح نفسه عند إعادة محاولة طلب انقطع قبل معرفة نتيجته.
- أخطاء `422` متاحة لكل حقل، وتُعرض رسالة الأخطاء المالية القادمة في `message`.
- عند `401` تُحذف الجلسة ويُنقل المستخدم إلى `/signin`.
- عند `429` تُقرأ قيمة `Retry-After` وتظهر للمستخدم.

## Modules not connected

لم يتضمن ملف `SmartSpend-API.pdf` مسارات للوحدات التالية، ولذلك بقيت بياناتها ثابتة ولم تُنشأ لها طلبات غير موثقة:

- Budgets
- Savings Goals
- Upcoming Bills
- Notifications
- Recurring Operations
- Reports
- Import / Smart Capture
- AI Assistant / AI Insights

عند توفير توثيق Endpoints هذه الوحدات يمكن ربطها فوق طبقة `apiClient.js` الحالية.
