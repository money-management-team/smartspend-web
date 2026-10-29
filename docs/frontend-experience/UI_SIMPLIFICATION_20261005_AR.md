# تبسيط العمليات المالية والتقارير — 5 أكتوبر 2026

## نطاق التعديل

تم تعديل واجهة الصفحتين `/dashboard/financial-operations` و`/dashboard/reports`، مع إبقاء عقود API ومنطق التسجيل والمراجعة والاعتماد والعكس والتصدير كما هي.

المكوّنان المشتركان `ManualTemplateTools` و`AiInputAllowance` يدعمان العرض الجديد عبر خاصية `compact` اختيارية؛ استخدامهما المعتاد في بقية الصفحات بقي كما هو. أُضيفت مفاتيح ترجمة جديدة فقط، دون تغيير أي قيمة ترجمة موجودة.

## العمليات المالية

- كارد أزرق متناسق مع هوية بقية صفحات المنصة، وإجمالي مصروف اليوم من المصدر نفسه.
- نوع العملية والحساب وطريقة التسجيل في قوائم اختيار واضحة.
- الإدخال اليدوي هو الافتراضي. روابط مسودات الصوت المحفوظة تفتح مسار مراجعة الصوت كما كانت.
- الحقول الأساسية: المبلغ، الفئة، التاريخ. الملاحظة والرقم المرجعي ضمن «تفاصيل إضافية»، وتبقى قيمهما محفوظة في نموذج العملية.
- القوالب في قائمة بسيطة مع التطبيق والحفظ والإدارة؛ بقيت قواعد صلاحية القالب وخصوصية التخزين وحدود القوالب كما هي.
- عداد المحاولات يظهر عند اختيار الصوت أو الصورة فقط، ويعرض رصيد الطريقة المختارة من الخادم. لا توجد حدود أو عمليات خصم محلية جديدة.
- الصوت والصورة يبقيان مخصصين للمصروفات؛ اختيار النوع ثابت على المصروف في هذين المسارين.
- تظهر 5 عمليات أولًا. «عرض المزيد» يفتح السجل الكامل مع الفلاتر والعروض المحفوظة والتنقل بين صفحات الخادم.
- روابط تفاصيل العمليات، المراجعة قبل الاعتماد، مفتاح منع التكرار، العكس وتحديث الأرصدة بقيت متاحة وبالمنطق نفسه.

## التقارير

- مساحة إعداد واحدة: نوع التقرير والفترة والعملة. جميع التقارير العشرة ما زالت موجودة.
- اختيار فترة جاهزة يطبقها مباشرة؛ الفترة المخصصة وبقية تعديلات الفلاتر تبقى مسودة حتى التطبيق والتحقق من صلاحية التواريخ.
- تجميع البيانات وحجم الصفحة تحت «خيارات إضافية»، والعروض المحفوظة ومراجعة الشهر ضمن قسم قابل للفتح.
- نتائج التقرير موزعة بين أهم الأرقام والتحليلات وجميع التفاصيل والبيانات التفصيلية.
- التفاصيل الثانوية متاحة عند الطلب، مع إبقاء فترة الخادم الفعلية ظاهرة.
- صفوف المقارنة والبيانات تتحول إلى بطاقات معنونة على الموبايل، باستخدام القيم وروابط التفاصيل نفسها.
- الفصل بين العملات وتفسير القيم وCSV وExcel وPDF بقيت بالمنطق والقوالب نفسها.

## الفحص

- نجح `npm run build` و`npm run lint`.
- نجحت جميع الاختبارات الموجودة: **226 اختبارًا**.
- نجحت **134 حالة تحقق** داخل متصفح Chromium ببيانات وواجهات API محاكاة، دون أخطاء JavaScript.
- شمل الفحص العربية والإنجليزية، والاتجاهين RTL/LTR، والوضعين الفاتح والداكن، وأحجام عرض من 320 إلى 1920 بكسل.
- تم التحقق من المراجعة دون إنشاء عملية، والاعتماد مرة واحدة مع مبلغ دقيق ومفتاح منع التكرار، والدخل دون فئة، وتطبيق القوالب وحفظها، والعدادات المستقلة، والسجل والفلاتر، وصلاحية فترات التقارير، وتصدير CSV وإنشاء وتنزيل PDF عربي فعلي.
- تم فحص حالات الحساب الوحيد، عدم وجود حسابات، نفاد المحاولات، التقرير الفارغ وخطأ الخادم.
- لم يُجر هذا الفحص على بيانات المستخدم أو خادم الإنتاج؛ إعدادات الاتصال الموجودة في النسخة المرسلة لم تتغير.

## استخدام النسخة

الملف المضغوط يحتوي على جميع ملفات المشروع الأصلية، مع التعديلات والتوثيق. لا يعتمد على ملفات الاختبار المؤقتة أو بيئة الفحص.

داخل مجلد المشروع، بعد فك الضغط:

```bash
npm ci
npm run dev
```

ولإنتاج نسخة النشر:

```bash
npm run build
```

## الملفات المعدلة

- `docs/reports/implementation.md`
- `docs/reports/overview.md`
- `docs/transactions/implementation.md`
- `src/features/Dashboards/User/Experience/ManualTemplateTools.jsx`
- `src/features/Dashboards/User/FinancialOperations/components/AccountStep/AccountStep.css`
- `src/features/Dashboards/User/FinancialOperations/components/AccountStep/AccountStep.jsx`
- `src/features/Dashboards/User/FinancialOperations/components/AiInputAllowance/AiInputAllowance.css`
- `src/features/Dashboards/User/FinancialOperations/components/AiInputAllowance/AiInputAllowance.jsx`
- `src/features/Dashboards/User/FinancialOperations/components/CaptureStep/CaptureStep.css`
- `src/features/Dashboards/User/FinancialOperations/components/CaptureStep/CaptureStep.jsx`
- `src/features/Dashboards/User/FinancialOperations/components/Ledger/Ledger.css`
- `src/features/Dashboards/User/FinancialOperations/components/Ledger/Ledger.jsx`
- `src/features/Dashboards/User/FinancialOperations/components/NewOperation/NewOperation.css`
- `src/features/Dashboards/User/FinancialOperations/components/NewOperation/NewOperation.jsx`
- `src/features/Dashboards/User/FinancialOperations/components/OperationsIntro/OperationsIntro.css`
- `src/features/Dashboards/User/FinancialOperations/components/OperationsIntro/OperationsIntro.jsx`
- `src/features/Dashboards/User/FinancialOperations/FinancialOperations.css`
- `src/features/Dashboards/User/FinancialOperations/FinancialOperations.jsx`
- `src/features/Dashboards/User/Reports/components/ReportComparison/ReportComparison.css`
- `src/features/Dashboards/User/Reports/components/ReportComparison/ReportComparison.jsx`
- `src/features/Dashboards/User/Reports/components/ReportFilters/ReportFilters.css`
- `src/features/Dashboards/User/Reports/components/ReportFilters/ReportFilters.jsx`
- `src/features/Dashboards/User/Reports/components/ReportItemsTable/ReportItemsTable.css`
- `src/features/Dashboards/User/Reports/components/ReportItemsTable/ReportItemsTable.jsx`
- `src/features/Dashboards/User/Reports/components/ReportPeriod/ReportPeriod.css`
- `src/features/Dashboards/User/Reports/components/ReportPeriod/ReportPeriod.jsx`
- `src/features/Dashboards/User/Reports/components/ReportsHeader/ReportsHeader.jsx`
- `src/features/Dashboards/User/Reports/components/ReportTabs/ReportTabs.css`
- `src/features/Dashboards/User/Reports/components/ReportTabs/ReportTabs.jsx`
- `src/features/Dashboards/User/Reports/Reports.css`
- `src/features/Dashboards/User/Reports/Reports.jsx`
- `src/locales/ar/ar.json`
- `src/locales/en/en.json`
