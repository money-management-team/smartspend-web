> تحديث الاتساق (2026-10): الإنتاج الحالي: الفرونت `https://smartspend.anasalharazeen.com` والباك `https://smartspend-api.anasalharazeen.com`. استُبدلت الروابط القديمة (Vercel وLaravel Cloud) في هذا الملف. لم تُعدَّل إعدادات Google أو أي لوحة خارجية من هذا المستودع؛ يجب أن تطابق قيم Google Console هذه الروابط قبل الاعتماد عليها.

# Google sign-in: local testing and production setup — 2026-10-03

اقرأ هذا الملف قبل تغيير إعداد Google أو نصوص السياسات. يستخدم التكامل الحالي GIS popup وJavaScript callback مع التحقق من ID token في الباك، ثم Sanctum bearer token. لا يحتاج Google client secret أو callback redirect في الباك.

## 1. البيئات ومعرّفات العميل

استخدم مشروع Google منفصلاً للتطوير ومشروعاً للإنتاج. داخل كل بيئة يجب أن يتطابق GOOGLE_CLIENT_ID في الباك مع VITE_GOOGLE_CLIENT_ID في الفرونت. معرفا التطوير والإنتاج مختلفان؛ الكود الحالي في الباك يقبل معرفاً واحداً لكل بيئة.

| البيئة | الجمهور | الحالة | Authorized JavaScript origins |
|---|---|---|---|
| SmartSpend Development | External | Testing | http://localhost وhttp://localhost:5173 |
| SmartSpend Production | External | In production | https://smartspend.anasalharazeen.com |

أنشئ Clients من نوع Web application. العنوان في origins بلا مسار ولا slash أخير. اترك Authorized redirect URIs فارغة لهذا التكامل. كل origin إضافي يحتاج تصريحاً صريحاً؛ أي origin إضافي (مثل بيئة معاينة) لا يصبح مسموحاً تلقائياً. الصلاحيات الأساسية فقط: openid وuserinfo.email وuserinfo.profile.

## 2. الروابط العامة قبل Publish app

Google تطلب اسم تطبيق وبريد دعم ورابط صفحة رئيسية ورابط خصوصية صالحاً قبل التحويل إلى External production. أكمل Branding قبل الضغط على Publish app.

الروابط بعد نشر هذا التعديل:

- Homepage: https://smartspend.anasalharazeen.com/
- Privacy: https://smartspend.anasalharazeen.com/privacy.html
- Terms: https://smartspend.anasalharazeen.com/terms.html
- Authorized domain: smartspend.anasalharazeen.com

افتح الروابط في نافذة خاصة وتحقق أن محتواها ظاهر دون حساب. الشروط اختيارية في إعداد Google، لكن الصفحتين منشورتان في هذا التعديل. أكمل App name وUser support email وDeveloper contact information بقيم فعلية. لا تضع رابط السياسة قبل نشر الصفحة.

## 3. مصدر السياسات وتوليد HTML

- src/components/AccessExperience/policyContent.js: المصدر المشترك للعربية والإنجليزية، وبريد الدعم وتاريخ التحديث.
- src/components/AccessExperience/accessMessages.js: يستورد المصدر المشترك؛ حوار الموافقة الحالي يحتفظ بسلوكه الصريح.
- scripts/generateLegalPages.mjs: يولّد public/privacy.html وpublic/terms.html من المصدر المشترك.
- public/legal-policy.css: تصميم مستقل وخفيف للصفحات العامة.
- Cairo وTajawal: تُنسخ خطوط الهوية الموجودة إلى public/legal-fonts تلقائياً، وتُخدم من نفس الموقع دون طلب خطوط من طرف خارجي.
- PublicFooter.jsx: يربط الصفحة الرئيسية بالروابط الفعلية.
- npm run dev وnpm run build: يولّدان الصفحتين تلقائياً قبل بدء Vite أو البناء.
- npm run legal:generate: تجديد الصفحات فقط، دون تشغيل السيرفر.

لا تعدّل HTML الناتج يدوياً؛ البناء سيستبدله. حدّث النص في policyContent.js، وتاريخ السياسة عند تعديلها، ثم أعد التوليد. ملفات HTML الناتجة مستثناة من Git، لكن Vite ينسخها إلى dist عند البناء. ملف vercel.json قديم من الاستضافة السابقة ولا يؤثر على Hostinger؛ الصفحتان تُنسخان إلى dist وتُخدمان كملفات ثابتة، أما SPA fallback على Hostinger فإعداده في الخادم خارج هذا المستودع.

النص يصف وظائف الكود الحالي ويجب أن يطابق ممارسات الفريق الفعلية. بريد التواصل الحالي smartspend.ps@gmail.com مأخوذ من بيانات المشروع التي قدمها مالك المنصة. طلبات إزالة بيانات Google أو الربط عبر الدعم ليست endpoint حذف جديداً، وتتطلب إجراءً فعلياً من الفريق والتحقق من هوية صاحب الطلب. السجلات المالية والتدقيق لا تمحى تلقائياً بسحب إذن Google.

## 4. التجربة المحلية

في .env الباك ضع Client ID التطوير:

```dotenv
GOOGLE_CLIENT_ID=YOUR_DEVELOPMENT_WEB_CLIENT_ID.apps.googleusercontent.com
FRONTEND_URLS=http://localhost:5173
```

احتفظ بالعناوين الأخرى اللازمة في FRONTEND_URLS. شغّل:

```powershell
php artisan config:clear
php artisan serve --port=8000
```

وفي .env.local الفرونت:

```dotenv
VITE_GOOGLE_CLIENT_ID=YOUR_DEVELOPMENT_WEB_CLIENT_ID.apps.googleusercontent.com
VITE_API_BASE_URL=http://localhost:8000/api
```

أعد تشغيل npm run dev. صفحات السياسات تعمل على /privacy.html و/terms.html. Google sign-in الأساسي مستثنى من قيود المختبرين المعتادة ما دام لا يطلب scopes إضافية.

## 5. نشر صفحات السياسات واستكمال Google

1. ثبت الملفات الجديدة والمعدلة، ثم نفذ npm run build وnpm run lint واختبارات Google والسياسات عند تغيير نصوصها أو الربط.
2. الإنتاج يُنشر من فرع development عبر .github/workflows/deploy-hostinger.yml.
3. انتظر نجاح Production deployment ثم افتح الروابط العامة الثلاثة في نافذة خاصة.
4. أكمل Branding في Google بالقيم المذكورة أعلاه واضغط Save.
5. افتح Audience، وتأكد من External، ثم Publish app حتى تصبح الحالة In production.
6. Publish app يختلف عن Publish branding. لإظهار الاسم والشعار المعتمدين قد تطلب Google تحقق الملكية واعتماد Branding؛ تابع الحالة المعروضة ولا تفترض الموافقة.

لإثبات ملكية الموقع: أضف URL-prefix property في Google Search Console بنفس حساب مالك/محرر مشروع Google، وانسخ وسم HTML tag إلى head في index.html، وانشره ثم اضغط Verify. لا تكتب رمز تحقق افتراضياً ولا تحذف الوسم بعد نجاحه.

## 6. الباك إند بعد رفعه

في البيئة المرتبطة بفرع develop، اضبط:

```dotenv
GOOGLE_CLIENT_ID=YOUR_PRODUCTION_WEB_CLIENT_ID.apps.googleusercontent.com
FRONTEND_URLS=https://smartspend.anasalharazeen.com
```

احتفظ بأي origins أخرى لازمة. احفظ المتغيرات وأعد نشر البيئة. حافظ على APP_KEY وإعدادات قاعدة البيانات والصوت والفواتير والتخزين والـqueues القائمة. تعديل Google لا يضيف migration أو dependency إنتاج جديدة.

من Commands:

```bash
php artisan route:list --path=auth/google
php artisan tinker --execute="dump(config('services.google.client_id')); dump(config('cors.allowed_origins'));"
```

الأمران يثبتان المسار والإعدادات، لا يثبتان نجاح تسجيل Google الحقيقي. يلزم إعادة نشر الباك بعد تعديل المتغيرات. لا تضف optimize:clear إلى Deploy Commands؛ config:cache مكانه البناء إذا كانت إعداداتك تستعمله.

## 7. متغيرات بناء الفرونت (GitHub Actions)

في GitHub → Actions variables (يتحقق منها workflow النشر قبل البناء):

```dotenv
VITE_GOOGLE_CLIENT_ID=YOUR_PRODUCTION_WEB_CLIENT_ID.apps.googleusercontent.com
VITE_API_BASE_URL=https://smartspend-api.anasalharazeen.com/api
```

أعد النشر؛ Vite يدمج القيم عند البناء. جرب الدومين الثابت المضاف إلى Google. تجربة الفرونت المحلي بمعرف التطوير مع باك الإنتاج بمعرف الإنتاج لا تعمل لأن audience مختلف.

## 8. قبول التسجيل الفعلي

1. Gmail جديد: اختيار Google ثم بطاقة الموافقة؛ إغلاقها يبقي المستخدم خارج المنصة، والموافقة تنشئ حساباً ومساحة عمل.
2. الحساب نفسه: خروج ثم Google يدخل الحساب نفسه دون user/workspace جديدين.
3. حساب كلمة مرور ببريد موثق: يرتبط بالحساب المؤهل القائم؛ غير الموثق يحتاج تأكيد البريد أولاً.
4. قبل الموافقة: 422 وgoogle_consent_required متوقع. بعد الموافقة: 201 للجديد أو 200 للموجود.
5. لا ينشئ دخول Google أي عملية مالية ولا يستهلك حصص الصوت أو الفواتير.

الكود الحالي يقبل Gmail أو Google Workspace موثوقاً. External/In production لا يغيّر هذه السياسة ولا يتجاوز قيود مسؤول Workspace. دعم حساب Google ببريد خارجي غير authoritative يحتاج تعديل منطق تحقق مستقلاً.

## المصادر الرسمية

- https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
- https://support.google.com/cloud/answer/15549049
- https://support.google.com/cloud/answer/15549945
- https://developers.google.com/identity/verification/authentication-verification
- https://support.google.com/webmasters/answer/9008080
- https://laravel.com/cloud/docs/environments
- https://vercel.com/docs/project-configuration/vercel-json
