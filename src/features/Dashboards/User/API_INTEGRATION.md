# SmartSpend Dashboard API Integration

## Environment

ضع المتغير التالي في ملف `.env` الموجود بجانب `package.json`:

```env
VITE_API_BASE_URL=https://smartspend-backend-staging-vjthdp.laravel.cloud/api
```

المتغير يحتوي `/api` مسبقًا، لذلك تستخدم طبقة الاتصال مسارات مثل `/dashboard` و`/accounts` مباشرة.
بعد تعديل `.env` أعد تشغيل Vite:

```bash
npm run dev
```

## Authentication / storage

- `POST /register`
- `POST /login`
- `GET /user`
- `PUT /profile`
- `POST /logout`
- التوكن يُرسل تلقائيًا عبر `Authorization: Bearer <token>`.
- طبقة الاتصال تقرأ `ACCESS_TOKEN` أو `token` لتتوافق مع صفحات المصادقة الحالية.
- عند `401` يتم حذف بيانات الجلسة والانتقال إلى `/signin`.

## Connected pages

### Dashboard

- `GET /dashboard`
- `GET /user`
- بطاقات الحسابات، الدخل/المصروف، الفئات، آخر العمليات، الميزانيات وأهداف الادخار تعتمد على الاستجابة الحقيقية.

### Accounts

- `GET /accounts`
- `POST /accounts`
- `PUT /accounts/{id}`
- `POST /accounts/{id}/archive`

### Financial Operations

- `GET /transactions?per_page=100`
- `POST /transactions/income`
- `POST /transactions/expense`
- `POST /transfers`
- `POST /transactions/{id}/reverse`
- `GET /categories`
- `GET /accounts`

### Budgets

- `GET /budgets`
- `POST /budgets`
- `PUT /budgets/{id}` لتعديل الحد
- `DELETE /budgets/{id}` للأرشفة
- `GET /categories?type=expense` لاختيار تصنيف الميزانية

### Savings Goals

- `GET /savings-goals`
- `POST /savings-goals`
- `PUT /savings-goals/{id}` لتعديل المبلغ المستهدف
- `DELETE /savings-goals/{id}` للأرشفة
- `POST /savings-goals/{id}/contributions` لإضافة مساهمة
- المساهمات تستخدم `Idempotency-Key` مستقل من نوع `goal-contribution-*`.

### Notifications

- `GET /financial-alerts`
- زر تعليم الكل كمقروء محلي فقط لأن التوثيق الحالي لا يتضمن endpoint لتحديث حالة القراءة.

### Reports

- تعتمد على `GET /dashboard?date_from=...&date_to=...`.
- يتم تحميل إجمالي آخر 8 أشهر، إضافة إلى طلب شهري لكل شهر لبناء الرسم البياني من بيانات حقيقية.

### Profile Settings

- `GET /user`
- `PUT /profile`

## API behavior

- `Accept: application/json` مضاف تلقائيًا.
- `Accept-Language` يُرسل من لغة `i18next` الحالية.
- المبالغ المرسلة تتحول إلى نص بأربع خانات عشرية.
- التحويلات ومساهمات الادخار تستخدم `Idempotency-Key`.
- أخطاء `422` محفوظة في `ApiError.errors` للعرض أسفل الحقول.
- رسائل أخطاء المنطق المالي تُعرض من `message`.
- عند `429` تتم قراءة `Retry-After` وعرض رسالة مناسبة.

## Not connected because no documented endpoint exists in the supplied API reference

- Recurring Operations
- Import / Smart Capture
- AI Assistant / AI Insights
- Upcoming Bills

لا يتم اختراع endpoints لهذه الوحدات؛ تبقى الواجهات الحالية ثابتة إلى أن يتوفر توثيق backend لها.
