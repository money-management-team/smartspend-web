# SmartSpend — الخطوة 10، الجزء الرابع: تصحيح انتظار التحليل الصوتي

هذا التصحيح يُطبَّق على نسخة الفرونت بعد الجزء الثالث الذي نجح عند أنس بـ120 اختبارًا وبناء Vite. التعديل في الفرونت فقط؛ لا تعديلات أو migrations جديدة في الباك ولا تغييرات Laravel Cloud في هذه الخطوة.

## السبب الذي تم التحقق منه

جدول `ai_voice_expense_captures` يبدأ `review_version` بالقيمة 0. تبقى هذه القيمة أثناء `uploaded` و`queued` و`processing`، ثم يرفعها `AiVoiceCaptureProcessingService` عند تجهيز المراجعة. كان `isVoiceCapture` في الفرونت يرفض كل قيمة أقل من 1، فتظهر رسالة «أعاد الخادم استجابة غير متوقعة» رغم قبول التسجيل وتشغيل عامل الطابور. وبعد انتهاء التحليل تُقبل إعادة إرسال الطلب نفسه لأن المراجعة أصبحت ذات نسخة إيجابية.

أُعيد إنتاج الخطأ باختبار لاستجابة queued ذات نسخة 0؛ فشل قبل التصحيح. نماذج الاختبارات القديمة كانت تستخدم النسخة 1 قبل التحليل، فتم تعديلها لتطابق دورة حياة الباك.

## التصحيح والسلوك

- يقبل قارئ الاستجابات النسخة 0 في الحالات غير الجاهزة للمراجعة، بما فيها فشل تحليل أولي أو استبعاد قبل المراجعة.
- تبقى `ready_for_review` و`confirmed` بحاجة إلى نسخة إيجابية، وتبقى PATCH المراجعة وPOST التأكيد بحاجة إلى نسخة إيجابية. النسخ السالبة والنصية والكسرية والحقول المالية غير السليمة مرفوضة.
- لا تُعتبر بيانات تسجيل غير قابل للتعديل «تعديلات غير محفوظة»؛ تحديث حالة المعالجة لا يطلب تأكيد التخلص من مسودة لم تُحرَّر.
- تظهر بطاقة تحميل واضحة فور الضغط على «استخدم هذا التسجيل». تُخفى معاينة التسجيل أثناء رفعه مع الاحتفاظ بها إن وقع خطأ رفع حقيقي.
- تتبع بطاقة التحميل أربع مراحل: الرفع، انتظار عامل الطابور، تحويل الصوت إلى نص، واستخراج بيانات المصروف. المرحلة الأخيرة تُعرض عندما تتضمن الاستجابة النص المفرّغ من الخادم. لا توجد نسبة مئوية أو مدة انتهاء مفترضة.
- تستمر متابعة الحالة الموجودة عبر GET فقط. عند `ready_for_review` تختفي بطاقة التحميل وتظهر المراجعة تلقائيًا دون POST رفع ثانٍ أو إعادة تحليل.
- عند `failed` تنتهي شاشة التحميل ويظل التعامل مع الفشل وإعادة التحليل صريحًا. انقطاع حقيقي غير محسوم في الرفع يظل بحاجة إلى استكمال المحاولة نفسها؛ لا يخفي التصحيح الأخطاء الحقيقية.
- المتابعة الطويلة تبقى محدودة، وتظهر عبارة تحديث الحالة لاستئنافها عندما تصل إلى حدها. مغادرة الصفحة والتنقل يوقفان المؤقتات كما في الجزء السابق.
- التصميم يعتمد ألوان الهوية الحالية ويدعم العربية والإنجليزية والموبايل والثيم الداكن وتقليل الحركة.
- لم تتغير قواعد احتساب المحاولات أو مفاتيح Idempotency أو الحفظ أو الاعتماد المالي. لا أثر مالي قبل اعتماد المستخدم.

## 1. استبدال الملفات الموجودة

أوقف Vite بـCtrl+C، ثم افتح كل مسار أدناه داخل **جذر الفرونت إند** واستبدل محتواه كاملًا بالملف الموافق واحفظه. طبّق الملفات معًا قبل إعادة التشغيل.

| المسار داخل المشروع | الملف البديل الكامل |
|---|---|
| `src/features/Dashboards/User/FinancialOperations/voiceCaptureContract.js` | [voiceCaptureContract.js](sandbox:/workspace/scratch/78925171ae9a/deliverables/smartspend-step10-part4-loading-fix/voiceCaptureContract.js) |
| `src/features/Dashboards/User/FinancialOperations/voiceCaptureFlow.js` | [voiceCaptureFlow.js](sandbox:/workspace/scratch/78925171ae9a/deliverables/smartspend-step10-part4-loading-fix/voiceCaptureFlow.js) |
| `src/features/Dashboards/User/FinancialOperations/components/VoiceCapture/VoiceCaptureWorkflow.jsx` | [VoiceCaptureWorkflow.jsx](sandbox:/workspace/scratch/78925171ae9a/deliverables/smartspend-step10-part4-loading-fix/VoiceCaptureWorkflow.jsx) |
| `src/features/Dashboards/User/FinancialOperations/components/VoiceCapture/VoiceCaptureWorkflow.css` | [VoiceCaptureWorkflow.css](sandbox:/workspace/scratch/78925171ae9a/deliverables/smartspend-step10-part4-loading-fix/VoiceCaptureWorkflow.css) |
| `src/locales/ar/ar.json` | [ar.json](sandbox:/workspace/scratch/78925171ae9a/deliverables/smartspend-step10-part4-loading-fix/ar.json) |
| `src/locales/en/en.json` | [en.json](sandbox:/workspace/scratch/78925171ae9a/deliverables/smartspend-step10-part4-loading-fix/en.json) |
| `tests/aiInputContracts.test.mjs` | [aiInputContracts.test.mjs](sandbox:/workspace/scratch/78925171ae9a/deliverables/smartspend-step10-part4-loading-fix/aiInputContracts.test.mjs) |
| `tests/voiceCaptureFlow.test.mjs` | [voiceCaptureFlow.test.mjs](sandbox:/workspace/scratch/78925171ae9a/deliverables/smartspend-step10-part4-loading-fix/voiceCaptureFlow.test.mjs) |

إذا أجريت تغييرات إضافية على الترجمات خارج هذه المحادثة، حافظ عليها وأضف إليها فقط `dashboard.financialOperations.voiceFlow.progress` من الملف المرفق. في النسخة التي نعمل عليها تحققنا من أن هذا القسم هو التغيير الوحيد في كل ملف لغة.

## 2. إضافة هذا الدليل إلى المشروع

أمر إنشاء ملف التوثيق الجديد من Terminal في VS Code داخل الفرونت:

```powershell
New-Item -ItemType Directory -Path "docs/voice-capture" -Force | Out-Null
if (-not (Test-Path -LiteralPath "docs/voice-capture/step10-part4-guide.md" -PathType Leaf)) {
    New-Item -ItemType File -Path "docs/voice-capture/step10-part4-guide.md" | Out-Null
}
```

المسار: `docs/voice-capture/step10-part4-guide.md`.
الصق كامل محتوى هذا الدليل في الملف واحفظه. الأمر وحده يُنشئ ملفًا فارغًا.

## 3. الاختبارات والبناء

نفّذ من جذر الفرونت:

```powershell
node --test tests/aiInputContracts.test.mjs tests/voiceRecording.test.mjs tests/voiceCaptureFlow.test.mjs
npm run build
```

المتوقع: **130 passed / 0 failed**. تأكد من نجاح الاختبارات قبل الانتقال للبناء، ثم من نجاح البناء قبل تشغيل الصفحة.

نجحت هنا الاختبارات الـ130، منها عشرة اختبارات جديدة، وفحوص صياغة JavaScript/JSX ومسارات الاستيراد ورموز CSS وتكافؤ الترجمات. يتضمن الاختبار الجديد انتظار عامل افتراضي لمدة 28 ثانية مع نسخة 0 قبل ظهور نسخة المراجعة 1، والتأكد من رفع واحد دون إعادة تحليل أو تسجيل مالي. هذه الاختبارات لا تتصل بـOpenAI. البناء وتجربة المتصفح الفعلية للتصحيح يلزم تشغيلهما عندك؛ حزم المشروع والمتصفح غير متاحين في بيئة الفحص الحالية.

## 4. إعادة تشغيل التجربة المحلية الحالية

اترك الباك المحلي وعامل الصوت شغالين كما في التجربة التي نجحت عندك. لا تحتاج إلى migrations أو تعديل العامل لهذا التصحيح.

داخل Terminal الفرونت أعد ضبط الاتصال المحلي المؤقت ثم شغّل Vite:

```powershell
$env:VITE_API_BASE_URL = "/api"
$env:SMARTSPEND_DEV_API_ORIGIN = "http://127.0.0.1:8000"
npm run dev
```

القيم تخص جلسة Terminal ولا تعدّل ملف البيئة أو Vercel أو Laravel Cloud.

## 5. اختبار قبول التصحيح

1. افتح العمليات المالية، واختر الحساب، وتأكد من ظهور الحدود، وسجّل مصروفًا واحدًا.
2. اضغط «استخدم هذا التسجيل» مرة واحدة. تظهر بطاقة الرفع فورًا ثم بطاقة انتظار المعالجة.
3. أثناء RUNNING يجب أن تستمر شاشة التحليل دون رسالة الاستجابة غير المتوقعة التي كانت ناتجة عن النسخة 0.
4. عند اكتمال المعالجة يجب أن تفتح المراجعة تلقائيًا. لا تضغط إعادة إرسال لمعالجة الانتظار الطبيعي.
5. في Network: طلب POST رفع واحد، ثم GET لنفس رقم التسجيل. قبل اكتمال التحليل النسخة 0 مقبولة، وبعده ready_for_review ونسخة إيجابية.
6. لا يظهر مصروف مؤكّد ولا يتغير الرصيد قبل الحفظ والاعتماد الصريح. أكمل البيانات ثم احفظ المسودة واعتمدها كما نجح سابقًا.
7. إذا عاد خطأ فعلي، أرسل Status Code وResponse لطلب الرفع أو GET الذي فشل، بدون Authorization أو مفتاح API.

التسجيلات السابقة لم تُحذف أو تُعاد معالجتها بهذا التعديل. إذا ظهر تسجيلان جديدان بالضغط على محاولتين مستقلتين فلكل منهما قبوله؛ اختبار التصحيح يبدأ بتسجيل جديد واحد فقط.
