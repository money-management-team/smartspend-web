// Shared copy for the consent dialog and public policy pages.
// Review both languages and regenerate the public pages when changing policy copy.
export const POLICY_SUPPORT_EMAIL = "smartspend.ps@gmail.com";
export const POLICY_UPDATED_ON = "2026-10-03";

export const policyContent = {
  "ar": {
    "terms": "الشروط والأحكام",
    "privacy": "سياسة الخصوصية",
    "termsIntro": "إرشادات استخدام المنصة ومسؤوليتك عن الحساب والعمليات التي تعتمدها.",
    "privacyIntro": "نظرة واضحة على البيانات المرتبطة باستخدامك للمنصة وخيارات إدارتها.",
    "termsSections": [
      {
        "title": "استخدام SmartSpend",
        "body": "تساعدك المنصة على تنظيم الحسابات والعمليات والميزانيات والأهداف والاطلاع على تقاريرك. تعتمد جودة النتائج على البيانات التي تدخلها وعلى مراجعتك لها."
      },
      {
        "title": "مسؤولية الحساب",
        "body": "استخدم معلومات تسجيل صحيحة، وحافظ على بيانات الدخول، ولا تشارك حسابك مع أشخاص غير مخوّلين. استخدم المنصة ضمن الصلاحيات الممنوحة لك في مساحة العمل."
      },
      {
        "title": "مراجعة العمليات وتأكيدها",
        "body": "راجع الحساب والمبلغ والعملة والتصنيف والتاريخ قبل اعتماد أي عملية. نتائج تحليل الصوت والفواتير مسودات للمراجعة، ولا تُسجل المصروفات من تلك المسودات إلا بعد تأكيدك الصريح."
      },
      {
        "title": "نتائج الذكاء الاصطناعي",
        "body": "قد تكون نتائج التحليل أو الاقتراحات غير مكتملة أو غير دقيقة. صحّح القيم عند الحاجة، واستخدم الإدخال اليدوي عندما لا يناسبك التحليل أو عند بلوغ حدود الاستخدام المعروضة."
      },
      {
        "title": "السجل المالي",
        "body": "تُدار العمليات وفق قواعد المنصة وصلاحياتك. الأرشفة ليست حذفاً للسجل، وعكس عملية مالية يُسجل أثراً عكسياً مع المحافظة على إمكانية مراجعة الحركة الأصلية."
      },
      {
        "title": "استخدام مسؤول",
        "body": "لا تحاول الوصول إلى بيانات الآخرين أو تجاوز الصلاحيات وحدود الخدمة، ولا ترفع ملفات ضارة. التقارير والاقتراحات أدوات لتنظيم بياناتك ومراجعتها؛ القرار النهائي واعتماد العملية يعودان إليك."
      }
    ],
    "privacySections": [
      {
        "title": "بيانات الحساب وتسجيل الدخول عبر Google",
        "body": "نستخدم معلومات الحساب والبيانات المالية والملفات التي تختار تقديمها لتشغيل الوظائف المرتبطة بها. عند اختيار تسجيل الدخول عبر Google، نستخدم معرّف حسابك لدى Google واسمك وبريدك الموثّق لإنشاء حساب SmartSpend أو الدخول إليه وربطه بهويتك. لا نستلم كلمة مرور Google، ولا يطلب هذا التكامل الوصول إلى رسائل Gmail أو ملفات Google Drive."
      },
      {
        "title": "الميكروفون والفواتير",
        "body": "تُطلب صلاحية الميكروفون من المتصفح عند اختيار التسجيل الصوتي. التسجيل المحلي وحده لا يرسل الصوت؛ اختيار استخدام التسجيل يرفعه للتحليل. ورفع الفاتورة يتم عندما تختار إرسالها عبر الوظيفة المخصصة."
      },
      {
        "title": "الخدمات الخارجية والذكاء الاصطناعي",
        "body": "تستعين SmartSpend بخدمات استضافة مثل Laravel Cloud وVercel لتشغيل المنصة وتخزين البيانات اللازمة للخدمة. عند اختيار وظائف الذكاء الاصطناعي، قد تُرسل البيانات اللازمة للمهمة إلى OpenAI للتفريغ أو التحليل. نستخدم بيانات تسجيل Google لتوفير حسابك والدخول إليه، ولا نبيعها أو نستخدمها للإعلانات الموجّهة. راجع مدخلاتك وتجنب تضمين معلومات شخصية لا تحتاجها المهمة."
      },
      {
        "title": "الحفظ والصلاحيات والسجل",
        "body": `الوصول إلى البيانات مرتبط بحسابك وصلاحيات مساحة العمل. نحتفظ ببيانات الحساب ومعرّف الربط مع Google ما دام حسابك قائماً لتوفير تسجيل الدخول وإدارة الحساب. يمكن طلب حذف بيانات Google المحفوظة أو إزالة الربط عبر ${POLICY_SUPPORT_EMAIL} بعد التحقق من ملكية الحساب. السجلات المالية وبيانات التدقيق اللازمة تخضع لقواعد حفظ المنصة؛ أرشفة الحساب أو إخفاء المبالغ أو سحب إذن Google لا يمحوها تلقائياً.`
      },
      {
        "title": "التفضيلات في جهازك",
        "body": "قد يحفظ المتصفح جلسة الدخول حسب اختيارك. تُحفظ قوالب الإدخال والعروض المحفوظة وتخصيص اللوحة وتفضيل إخفاء المبالغ محلياً لكل مستخدم ومساحة عمل، ويمكن إدارة القوالب والعروض من الإعدادات."
      },
      {
        "title": "خياراتك وطلبات الخصوصية",
        "body": `يمكنك إدارة ملفك وتفضيلات الذكاء الاصطناعي من الإعدادات، وإيقاف الميكروفون من المتصفح، واختيار الإدخال اليدوي. يمكنك سحب إذن SmartSpend من إعدادات التطبيقات والخدمات الخارجية في حساب Google؛ سحب الإذن وحده لا يحذف حساب SmartSpend أو سجله المالي. للاستفسار أو طلب تصحيح بياناتك أو حذف بيانات Google أو إزالة الربط، راسل ${POLICY_SUPPORT_EMAIL}. إخفاء المبالغ يغيّر العرض فقط، ولا يشفر البيانات أو يزيلها من الطلبات المصرّح بها.`
      }
    ]
  },
  "en": {
    "terms": "Terms & Conditions",
    "privacy": "Privacy Policy",
    "termsIntro": "Guidance on using the platform and your responsibility for your account and confirmed operations.",
    "privacyIntro": "A clear overview of the data involved in using the platform and your available controls.",
    "termsSections": [
      {
        "title": "Using SmartSpend",
        "body": "The platform helps you organize accounts, transactions, budgets and goals and view your reports. The quality of results depends on the data you enter and your review of it."
      },
      {
        "title": "Account responsibility",
        "body": "Provide accurate registration information, protect your sign-in details and do not share your account with unauthorized people. Use the platform within the permissions granted to you in each workspace."
      },
      {
        "title": "Review and confirmation",
        "body": "Review the account, amount, currency, category and date before confirming an operation. Voice and receipt analysis produces review drafts; those drafts become expenses only after your explicit confirmation."
      },
      {
        "title": "AI results",
        "body": "Analysis and suggestions may be incomplete or inaccurate. Correct values when necessary and use manual entry when analysis does not suit your needs or the displayed usage limits are reached."
      },
      {
        "title": "Financial history",
        "body": "Operations follow the platform's rules and your permissions. Archiving does not erase history, and reversing an operation records an opposite effect while preserving the original movement for review."
      },
      {
        "title": "Responsible use",
        "body": "Do not attempt to access other people's data, bypass permissions or service limits, or upload harmful files. Reports and suggestions help you organize and review your data; the final decision and confirmation are yours."
      }
    ],
    "privacySections": [
      {
        "title": "Account data and Google sign-in",
        "body": "We use the account information, financial records and files you choose to provide to deliver the associated features. When you choose Google sign-in, we use your Google account identifier, name and verified email to create or sign in to your SmartSpend account and link your identity. We do not receive your Google password, and this integration does not request access to Gmail messages or Google Drive files."
      },
      {
        "title": "Microphone and receipts",
        "body": "The browser requests microphone permission when you choose voice recording. Local recording alone does not send audio; choosing to use the recording uploads it for analysis. Receipts are uploaded when you choose to send them through the relevant feature."
      },
      {
        "title": "Service providers and AI processing",
        "body": "SmartSpend uses hosting services such as Laravel Cloud and Vercel to operate the platform and store data needed for the service. When you choose AI features, data required for the task may be sent to OpenAI for transcription or analysis. Google sign-in data is used to provide your account and authentication; we do not sell it or use it for targeted advertising. Review your inputs and avoid including personal information that the task does not need."
      },
      {
        "title": "Retention, permissions and history",
        "body": `Data access depends on your account and workspace permissions. Account information and the Google linking identifier are retained while your account exists to provide sign-in and account management. You can request removal of stored Google data or its account link through ${POLICY_SUPPORT_EMAIL}, subject to account ownership verification. Financial and necessary audit records follow the platform's retention rules; archiving, hiding amounts or revoking Google access does not automatically erase them.`
      },
      {
        "title": "Preferences on your device",
        "body": "Your browser may retain your sign-in session according to your choice. Entry templates, saved views, dashboard customization and the money display preference are stored locally for each user and workspace. You can manage templates and views in Settings."
      },
      {
        "title": "Your choices and privacy requests",
        "body": `You can manage your profile and AI preferences in Settings, revoke microphone permission in your browser and choose manual entry. You can revoke SmartSpend access in your Google Account third-party apps and services settings; revocation alone does not delete your SmartSpend account or financial history. For questions, corrections, removal of stored Google data or unlinking requests, contact ${POLICY_SUPPORT_EMAIL}. Hiding amounts changes their display only; it does not encrypt data or remove it from authorized requests.`
      }
    ]
  }
};
