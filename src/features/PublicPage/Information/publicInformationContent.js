// Public product information: keep claims aligned with shipped features.
// Commercial pricing, certifications and support response times are not assumed.
export const PUBLIC_INFORMATION_PAGES = [
  "features",
  "pricing",
  "security",
  "about",
  "contact",
  "support",
];

export const publicInformationContent = {
  ar: {
    common: {
      home: "الرئيسية",
      navigation: "اكتشف SmartSpend",
      skip: "انتقل إلى المحتوى",
      start: "ابدأ رحلتك",
      dashboard: "افتح لوحة التحكم",
      explore: "استكشف الميزات",
      support: "مركز المساعدة",
      contact: "تواصل معنا",
      privacy: "سياسة الخصوصية",
      terms: "الشروط والأحكام",
      back: "العودة للرئيسية",
      next: "خطوتك التالية",
      ctaTitle: "تفاصيل أوضح. قرارات أكثر وعيًا.",
      ctaBody: "اجمع سجلك المالي في مكان واحد، وراجع كل خطوة قبل اعتمادها.",
      product: "إدارة مالية شخصية",
      visualLabel: "تجربة مترابطة",
      visualTitle: "أموالك، بصورة أوضح.",
      visualBody:
        "من تسجيل العملية إلى مراجعة أثرها؛ أنت من يختار وأنت من يؤكد.",
      visualSteps: ["نظّم حساباتك", "سجّل وراجع", "تابع تقدّمك"],
      nav: {
        features: "الميزات",
        pricing: "الأسعار",
        security: "الأمان",
        about: "من نحن",
        contact: "تواصل معنا",
        support: "الدعم",
      },
    },
    features: {
      eyebrow: "أدوات مترابطة ليومك المالي",
      title: "كل تفصيل مالي،\nفي مكانه الصحيح.",
      intro:
        "من الحسابات والمصروفات إلى الميزانيات والأهداف: أدوات عملية تساعدك على فهم بياناتك وتنظيمها، مع تجربة عربية وإنجليزية تتكيف معك.",
      section: "اختر ما تحتاجه اليوم",
      sectionBody:
        "استكشف الأدوات حسب طريقة استخدامك، ثم انتقل إلى مساحتك لتبدأ.",
      filters: {
        all: "كل الميزات",
        everyday: "إدارة يومية",
        planning: "التخطيط والمتابعة",
        ai: "مساعدة ذكية",
      },
      items: [
        {
          icon: "wallet",
          group: "everyday",
          title: "حسابات وسجل حركات",
          body: "نظّم الحسابات، راجع الأرصدة وسجل الحركات الخاص بكل حساب، وأرشِف الحسابات التي لم تعد تستخدمها مع الحفاظ على تاريخها.",
        },
        {
          icon: "receipt",
          group: "everyday",
          title: "عمليات وتحويلات",
          body: "سجّل دخلك ومصروفاتك وتصنيفاتها، وأدر التحويلات بين الحسابات من صفحات واضحة وتفاصيل قابلة للمراجعة.",
        },
        {
          icon: "calendar",
          group: "planning",
          title: "المتكرر والالتزامات",
          body: "تابع المعاملات المتكررة والفواتير والديون ودفعاتها، وراجع الاستحقاقات من التقويم والتنبيهات.",
        },
        {
          icon: "target",
          group: "planning",
          title: "ميزانيات وأهداف ادخار",
          body: "حدّد ميزانياتك وأهدافك، وراقب التقدّم والمساهمات لتبقى خطتك مرتبطة بسجلك المالي.",
        },
        {
          icon: "chart",
          group: "planning",
          title: "تقارير ومراجعة شهرية",
          body: "راجع حركة الدخل والإنفاق، واستفد من التقارير والمراجعة الشهرية وخيارات التصدير الموجودة داخل المنصة.",
        },
        {
          icon: "mic",
          group: "ai",
          title: "مصروفات بالصوت",
          body: "سجّل مصروفًا واحدًا بطريقتك، واستمع للتسجيل قبل إرساله. ينتج التحليل مسودة تستطيع تصحيحها واعتمادها صراحةً.",
        },
        {
          icon: "scan",
          group: "ai",
          title: "تحليل الفواتير",
          body: "ارفع الفاتورة للتحليل، ثم راجع المبلغ والعملة والتاريخ والتصنيف والحساب قبل تسجيل المصروف.",
        },
        {
          icon: "sparkles",
          group: "ai",
          title: "المساعد الذكي",
          body: "اطرح أسئلة عن بياناتك المالية، وراجع التفسيرات والاقتراحات المتاحة. جودة الإجابات تعتمد على البيانات المسجلة.",
        },
        {
          icon: "sliders",
          group: "everyday",
          title: "تجربة على طريقتك",
          body: "استخدم القوالب والعروض المحفوظة وتخصيص لوحة التحكم وإخفاء المبالغ، مع العربية والإنجليزية والوضعين الفاتح والداكن.",
        },
      ],
      flowTitle: "ثلاث طرق للإدخال. مراجعة واحدة واضحة.",
      flowBody:
        "اختر الإدخال اليدوي، أو تحليل الفاتورة، أو التسجيل الصوتي. الصوت والفواتير يجهّزان مسودة؛ تسجيل المصروف يتطلب تأكيدك.",
      flow: [
        "اختر طريقة الإدخال",
        "راجع التفاصيل وصحّحها",
        "أكّد ثم تابع الأثر",
      ],
      note: "الحسابات داخل SmartSpend سجلات تديرها في المنصة. لا نفترض وجود ربط تلقائي بحسابك البنكي أو تنفيذ تحويلات بنكية فعلية.",
    },
    pricing: {
      eyebrow: "وضوح قبل أن تبدأ",
      title: "ما المتاح لك؟\nهنا الصورة الواضحة.",
      intro:
        "نوضح الأدوات المتاحة وحدود التحليل الحالية. لا توجد في النسخة الحالية باقات مدفوعة أو آلية اشتراك وفوترة مفعّلة داخل المنصة.",
      badge: "النسخة الحالية للأفراد",
      plan: "مساحة لإدارة مالك الشخصي",
      planBody:
        "ابدأ بتنظيم سجلك المالي واستخدم أدوات التخطيط والتحليل المتاحة في حسابك.",
      included: [
        "الحسابات والعمليات والتحويلات",
        "الميزانيات والأهداف والديون",
        "المعاملات المتكررة والتنبيهات",
        "التقارير وخيارات التصدير",
        "مراجعة المصروفات بالصوت والفواتير",
        "العربية والإنجليزية وتخصيص التجربة",
      ],
      availability: "تفاصيل الإتاحة",
      availabilityBody:
        "الوظائف المتاحة تعتمد على النسخة المنشورة وصلاحياتك. هذه الصفحة لا تُنشئ اشتراكًا أو عملية دفع.",
      quotaTitle: "حدّان مستقلان للتحليل",
      quotaBody:
        "الإعداد الحالي: 10 محاولات صوت و10 محاولات فواتير يوميًا لكل مستخدم، مشتركة بين مساحات عمله. المتبقي المعروض داخل حسابك هو المرجع الفعلي.",
      voice: "محاولات صوت يوميًا",
      receipts: "محاولات فواتير يوميًا",
      reset: "يتجدد الحد عند 00:00 UTC، وليس عند منتصف الليل المحلي.",
      rules: [
        {
          icon: "refresh",
          title: "كيف تُحتسب المحاولة؟",
          body: "تُحتسب عند قبول الطلب للتحليل. إعادة المحاولة اليدوية لتحليل فاشل تُحتسب محاولة جديدة؛ متابعة الحالة والمراجعة والتأكيد لا تستهلك محاولة تحليل أخرى.",
        },
        {
          icon: "pen",
          title: "الإدخال اليدوي يبقى متاحًا",
          body: "عند استهلاك أحد الحدّين تتوقف الطلبات الجديدة لذلك النوع حتى التجدد، ويمكنك الاستمرار بالإدخال اليدوي ومراجعة المسودات الجاهزة.",
        },
        {
          icon: "info",
          title: "تكاليف مزوّد الذكاء الاصطناعي",
          body: "استخدام OpenAI له تكلفة على الجهة المشغّلة حسب استهلاك واجهته. وجود حد يومي لا يعني أن الخدمة الخارجية مجانية أو أن هناك باقة غير محدودة.",
        },
      ],
    },
    security: {
      eyebrow: "ضوابط واضحة، وقرار بيدك",
      title: "سجلك المالي يستحق\nالعناية بكل خطوة.",
      intro:
        "نعرض الضوابط الموجودة في منطق المنصة: صلاحيات الوصول، خصوصية الملفات، ومراجعة الأثر المالي قبل الاعتماد.",
      section: "كيف تُدار العمليات والبيانات؟",
      sectionBody:
        "أمان الاستخدام يرتبط أيضًا بحماية حسابك ومراجعة ما تختار مشاركته.",
      items: [
        {
          icon: "lock",
          title: "وصول مرتبط بالصلاحيات",
          body: "طلبات البيانات والعمليات تمر بالتحقق من المستخدم وصلاحيات مساحة العمل. معرفة معرّف حساب أو مسودة لا تمنح حق الوصول إليها.",
        },
        {
          icon: "shield",
          title: "تحقق من هوية Google",
          body: "الباك يتحقق من رمز هوية Google قبل الدخول أو إنشاء الحساب، ويحفظ الموافقة المطلوبة. لا تتلقى المنصة كلمة مرور Google.",
        },
        {
          icon: "scan",
          title: "الصوت والفواتير في تخزين خاص",
          body: "ملفات التحليل تُحفظ عبر التخزين الخاص، ويُتحقق من الملفات قبل معالجتها. تخضع الملفات لسياسة تنظيف؛ تنظيف المصدر لا يمحو السجل المالي المؤكد.",
        },
        {
          icon: "check",
          title: "اعتماد صريح للمصروف",
          body: "الصوت والفاتورة يجهّزان مسودة. تستطيع مراجعتها وتعديلها، ولا تُسجل العملية المالية من المسودة إلا بعد التأكيد.",
        },
        {
          icon: "layers",
          title: "ضوابط لتكرار الطلبات",
          body: "تستخدم العمليات المدعومة مفاتيح منع التكرار والمعاملات وقفل السجلات للحد من تسجيل أثر مالي مكرر عند وصول الطلبات بالتزامن.",
        },
        {
          icon: "history",
          title: "تاريخ يمكن مراجعته",
          body: "السجل المالي يربط العمليات بأثرها. أرشفة الحساب لا تحذف تاريخه، وعكس العملية يحافظ على إمكانية مراجعة أصلها.",
        },
      ],
      controlTitle: "خيارات خصوصية تعرف أثرها",
      controls: [
        "الميكروفون يعمل بعد إذنك، والتسجيل المحلي لا يُرسل حتى تختار استخدامه.",
        "عند استخدام الذكاء الاصطناعي تُرسل البيانات اللازمة للمهمة إلى المزوّد؛ راجع ما تشاركه.",
        "إخفاء المبالغ يحمي العرض من نظرات المحيطين؛ لا يغيّر السجل ولا يشفّر البيانات.",
        "طلبات الخصوصية أو الإبلاغ عن مشكلة وصول تُرسل إلى البريد المذكور في سياسة الخصوصية.",
      ],
    },
    about: {
      eyebrow: "عن SmartSpend",
      title: "نرتّب التفاصيل،\nلتفهم الصورة كاملة.",
      intro:
        "SmartSpend منصة لإدارة المال الشخصي، تجمع الحسابات والعمليات والتخطيط والتقارير مع أدوات ذكاء اصطناعي تساعدك على إدخال البيانات وفهمها.",
      mission: "لماذا نبني SmartSpend؟",
      missionBody:
        "لجعل متابعة المال عادة أوضح وأسهل: تعرف ما دخل، وما خرج، وما ينتظرك، وتراجع تقدّمك نحو أهدافك في تجربة مترابطة.",
      items: [
        {
          icon: "eye",
          title: "وضوح قبل التفاصيل",
          body: "أرصدة وحركات وتصنيفات وتقارير تساعدك على العودة إلى أصل البيانات وفهمها في سياقها.",
        },
        {
          icon: "check",
          title: "قرار المستخدم أولًا",
          body: "التحليل يساعد على إعداد المسودة، وأنت تراجع القيم وتؤكد المصروف. الاقتراح لا ينفّذ قرارًا ماليًا عنك.",
        },
        {
          icon: "globe",
          title: "تجربة تراعي اختلافك",
          body: "العربية والإنجليزية، اتجاهان للقراءة، ووضع فاتح وداكن، مع واجهات تستجيب لأحجام الشاشات.",
        },
      ],
      journeyTitle: "من التفاصيل إلى خطة قابلة للمتابعة",
      journey: [
        { title: "اجمع", body: "حساباتك وعملياتك في سجل منظم." },
        { title: "افهم", body: "راجع التقارير والتصنيفات وتفاصيل الحركات." },
        { title: "خطّط", body: "تابع ميزانياتك وأهدافك والتزاماتك." },
      ],
      note: "التركيز الحالي على الاستخدام الشخصي. مسار الشركات ظاهر كخيار غير متاح حاليًا، ولا نقدّمه هنا كمنتج جاهز.",
    },
    contact: {
      eyebrow: "باب مفتوح للتواصل",
      title: "سؤالك وملاحظتك،\nلهما مكان هنا.",
      intro:
        "لديك سؤال عن الاستخدام، ملاحظة على تجربة المنصة، أو طلب متعلق بالخصوصية؟ اختر الموضوع وجهّز رسالة للبريد المخصص للتواصل.",
      emailTitle: "البريد المخصص للتواصل",
      emailBody:
        "استخدم البريد نفسه الموجود في سياسة الخصوصية. لا نعرض وقت استجابة مضمونًا أو خدمة محادثة مباشرة.",
      copy: "نسخ البريد",
      copied: "تم نسخ البريد",
      copyFailed: "تعذر النسخ؛ يمكنك تحديد عنوان البريد ونسخه يدويًا.",
      topics: {
        general: "استفسار عام",
        issue: "مشكلة في الاستخدام",
        feedback: "اقتراح أو ملاحظة",
        privacy: "طلب متعلق بالخصوصية",
        security: "مشكلة وصول أو أمان",
      },
      formTitle: "جهّز رسالتك",
      formBody:
        "هذه الأداة تفتح تطبيق البريد لديك. إرسال الرسالة يتم من تطبيق البريد، ولا تُرسل البيانات من هذا النموذج إلى خادم المنصة.",
      topic: "موضوع الرسالة",
      name: "اسمك (اختياري)",
      message: "تفاصيل الرسالة",
      messageHint:
        "اذكر الصفحة والخطوات والرسالة الظاهرة. تجنّب كلمات المرور ورموز الدخول والمفاتيح والملفات المالية الحساسة.",
      placeholder: "كيف نستطيع مساعدتك؟",
      submit: "فتح تطبيق البريد",
      emailFallback: "أو أرسل رسالة مباشرة",
      formRequired: "اكتب تفاصيل رسالتك أولًا.",
      opened:
        "تم طلب فتح تطبيق البريد. راجع الرسالة وأرسلها من هناك؛ لم تُرسل تلقائيًا.",
      routesTitle: "قد تجد إجابتك هنا",
      routes: [
        {
          page: "support",
          icon: "help",
          title: "مساعدة الاستخدام",
          body: "إجابات عن الحسابات والصوت والفواتير والمراجعة.",
        },
        {
          page: "security",
          icon: "shield",
          title: "الأمان والخصوصية",
          body: "تعرّف إلى ضوابط الوصول وأثر خيارات الخصوصية.",
        },
      ],
    },
    support: {
      eyebrow: "مركز المساعدة",
      title: "إجابة واضحة،\nوخطوة تقدر تعملها.",
      intro:
        "إرشادات عملية للوظائف الموجودة في SmartSpend، من تسجيل المصروف إلى مراجعة حسابك. ابحث عن الموضوع الذي تحتاجه الآن.",
      search: "ابحث في المساعدة",
      searchPlaceholder: "مثال: التسجيل الصوتي، أرشفة الحساب، الحد اليومي…",
      clear: "مسح البحث",
      results: "عدد الإجابات",
      empty: "لم نجد إجابة مطابقة.",
      emptyBody: "جرّب كلمة أقصر، أو تواصل معنا مع وصف الصفحة والخطوات.",
      filters: {
        all: "كل المواضيع",
        start: "البداية والحساب",
        ai: "الصوت والفواتير",
        finance: "السجل المالي",
        privacy: "الخصوصية",
      },
      questions: [
        {
          id: "start",
          group: "start",
          q: "كيف أبدأ بتنظيم حسابي؟",
          a: "أنشئ حسابًا ماليًا بعملته ورصيده الافتتاحي الصحيح، ثم سجّل الدخل والمصروفات بتصنيفات مناسبة. راجع صفحة البداية ولوحة التحكم، وأضف الميزانيات والأهداف بحسب حاجتك.",
        },
        {
          id: "google",
          group: "start",
          q: "هل تسجيل Google يحتاج موافقة؟",
          a: "الحساب الجديد يحتاج قبول الشروط وسياسة الخصوصية. عند اختيار Google يُتحقق من الهوية في الباك. إذا ظهر خطأ، احتفظ برسالته وتواصل معنا؛ لا ترسل رمز الهوية أو بيانات الدخول.",
        },
        {
          id: "company",
          group: "start",
          q: "هل حساب الشركات متاح الآن؟",
          a: "النسخة الحالية تركز على الأفراد. مسار الشركات يعرض أنه غير متاح حاليًا، فلا تعتمد عليه كخدمة شركات مفعّلة.",
        },
        {
          id: "voice",
          group: "ai",
          q: "كيف أسجّل مصروفًا بالصوت؟",
          a: "من العمليات المالية اختر الصوت واسمح بالميكروفون. تحدّث عن مصروف واحد واذكر المبلغ والعملة والتاريخ قدر الإمكان. أوقف التسجيل واستمع إليه، ثم اختر استخدامه. الحد الحالي للتسجيل 60 ثانية. بعد المعالجة راجع المسودة وأكّدها.",
        },
        {
          id: "processing",
          group: "ai",
          q: "ماذا أفعل أثناء معالجة الصوت أو الفاتورة؟",
          a: "انتظر حالة التحليل؛ رفع الملف لا يعني أن التحليل انتهى. إذا توقفت المتابعة، استخدم تحديث الحالة أو افتح المسودة من السجل. عند عدم وضوح نتيجة الإرسال لا تنشئ طلبًا جديدًا مباشرةً، وراجع حالة الطلب القائم أولًا.",
        },
        {
          id: "limits",
          group: "ai",
          q: "ماذا يحدث عند استهلاك الحد اليومي؟",
          a: "الإعداد الحالي 10 محاولات صوت و10 محاولات فواتير يوميًا، وهما مستقلان ومشتركان بين مساحات عمل المستخدم. يتجددان عند 00:00 UTC. المرجع هو المتبقي المعروض في حسابك. الإدخال اليدوي ومراجعة المسودات الجاهزة يبقيان متاحين. التقييد المؤقت يختلف عن نفاد الحد اليومي.",
        },
        {
          id: "draft",
          group: "ai",
          q: "هل التحليل يسجّل المصروف تلقائيًا؟",
          a: "لا. ينتج الصوت والفاتورة مسودة للمراجعة. صحّح القيم الناقصة أو غير الدقيقة، واختر الحساب والتصنيف المناسبين، واحفظ التعديل ثم أكّد العملية صراحةً.",
        },
        {
          id: "archive",
          group: "finance",
          q: "أين أجد الحساب الذي أرشفته؟",
          a: "افتح قسم الحسابات ثم عرض الحسابات المؤرشفة. الأرشفة تحافظ على السجل، ويمكنك مراجعة تفاصيل الحساب وحركاته، لكنها تمنع استخدامه في العمليات الجديدة التي تشترط حسابًا نشطًا.",
        },
        {
          id: "balance",
          group: "finance",
          q: "لماذا رُفض مصروف بسبب الرصيد؟",
          a: "راجع الحساب المحدد وعملته ورصيده وقاعدة السماح بالرصيد السالب. لا تعتمد العملية إذا كانت القيم غير صحيحة. حدّث البيانات ثم أعد المحاولة عندما تُحلّ المشكلة.",
        },
        {
          id: "transfer",
          group: "finance",
          q: "هل التحويل هنا ينقل أموالًا من البنك؟",
          a: "التحويل داخل SmartSpend يسجّل حركة بين حساباتك في المنصة. لا يعني تنفيذ حوالة في بنك أو محفظة خارجية، ولا ينبغي احتسابه دخلاً أو مصروفًا جديدًا لمجرد انتقال المال بين الحسابات.",
        },
        {
          id: "local",
          group: "privacy",
          q: "هل القوالب والعروض المحفوظة تظهر على كل جهاز؟",
          a: "تخصيص اللوحة والقوالب والعروض المحفوظة وتفضيل إخفاء المبالغ تُحفظ محليًا في المتصفح لكل مستخدم ومساحة عمل. قد تحتاج إلى إعدادها مجددًا على جهاز أو متصفح آخر، ويمكن إدارتها من الإعدادات.",
        },
        {
          id: "privacy",
          group: "privacy",
          q: "كيف أطلب تصحيح بيانات Google أو إزالة ربطه؟",
          a: "راسل البريد المذكور في سياسة الخصوصية من خلال صفحة التواصل. قد يلزم التحقق من ملكية الحساب. سحب إذن SmartSpend من حساب Google وحده لا يحذف حساب المنصة أو سجله المالي.",
        },
      ],
      safety:
        "عند التواصل: أرسل وصف المشكلة والخطوات، وأخفِ المعلومات الحساسة من أي صورة. لا تشارك كلمة المرور أو رمز الدخول.",
    },
  },
  en: {
    common: {
      home: "Home",
      navigation: "Explore SmartSpend",
      skip: "Skip to content",
      start: "Start your journey",
      dashboard: "Open dashboard",
      explore: "Explore features",
      support: "Help center",
      contact: "Contact us",
      privacy: "Privacy policy",
      terms: "Terms & conditions",
      back: "Back to home",
      next: "Your next step",
      ctaTitle: "Clearer details. More informed decisions.",
      ctaBody:
        "Bring your financial history together and review every step before confirming it.",
      product: "Personal money management",
      visualLabel: "A connected experience",
      visualTitle: "Your money, in perspective.",
      visualBody:
        "From recording an expense to reviewing its impact: you choose, you confirm.",
      visualSteps: ["Organize accounts", "Record & review", "Track progress"],
      nav: {
        features: "Features",
        pricing: "Pricing",
        security: "Security",
        about: "About us",
        contact: "Contact",
        support: "Support",
      },
    },
    features: {
      eyebrow: "Connected tools for everyday finances",
      title: "Every financial detail,\nin the right place.",
      intro:
        "From accounts and expenses to budgets and goals: practical tools to understand and organize your data, with an Arabic and English experience that adapts to you.",
      section: "Find what you need today",
      sectionBody:
        "Explore tools by how you use them, then head to your workspace to begin.",
      filters: {
        all: "All features",
        everyday: "Everyday money",
        planning: "Plan & track",
        ai: "AI assistance",
      },
      items: [
        {
          icon: "wallet",
          group: "everyday",
          title: "Accounts & movement history",
          body: "Organize accounts, review balances and each account's movements, and archive accounts you no longer use while keeping their history.",
        },
        {
          icon: "receipt",
          group: "everyday",
          title: "Transactions & transfers",
          body: "Record income, expenses and their categories, and manage transfers between your accounts with clear pages and reviewable details.",
        },
        {
          icon: "calendar",
          group: "planning",
          title: "Recurring & commitments",
          body: "Track recurring transactions, bills, debts and repayments, and review upcoming items through the calendar and alerts.",
        },
        {
          icon: "target",
          group: "planning",
          title: "Budgets & savings goals",
          body: "Set budgets and goals, then follow progress and contributions to keep your plan connected to your financial history.",
        },
        {
          icon: "chart",
          group: "planning",
          title: "Reports & monthly review",
          body: "Review income and spending trends through reports, monthly reviews and the export options available inside the platform.",
        },
        {
          icon: "mic",
          group: "ai",
          title: "Voice expense entry",
          body: "Describe one expense in your own words and listen before uploading. Analysis creates a draft you can correct and explicitly confirm.",
        },
        {
          icon: "scan",
          group: "ai",
          title: "Receipt analysis",
          body: "Upload a receipt for analysis, then review its amount, currency, date, category and account before recording the expense.",
        },
        {
          icon: "sparkles",
          group: "ai",
          title: "AI assistant",
          body: "Ask questions about your financial data and review available explanations and suggestions. Answer quality depends on your recorded data.",
        },
        {
          icon: "sliders",
          group: "everyday",
          title: "An experience that fits",
          body: "Use templates, saved views, dashboard customization and hidden amounts, with Arabic and English and light and dark modes.",
        },
      ],
      flowTitle: "Three ways to enter. One clear review.",
      flowBody:
        "Choose manual entry, receipt analysis or voice recording. Voice and receipts prepare a draft; recording the expense requires your confirmation.",
      flow: [
        "Choose your input method",
        "Review and correct details",
        "Confirm and track impact",
      ],
      note: "Accounts in SmartSpend are records you manage inside the platform. Automatic bank synchronization or real bank transfers are not assumed.",
    },
    pricing: {
      eyebrow: "Clarity before you begin",
      title: "What is available?\nHere is the clear picture.",
      intro:
        "See the available tools and current analysis limits. The current version has no activated paid plans, subscription flow or in-platform billing system.",
      badge: "Current personal version",
      plan: "A space for your personal finances",
      planBody:
        "Start organizing your financial history and use the planning and analysis tools available in your account.",
      included: [
        "Accounts, transactions and transfers",
        "Budgets, goals and debts",
        "Recurring transactions and alerts",
        "Reports and export options",
        "Voice and receipt expense review",
        "Arabic, English and experience preferences",
      ],
      availability: "Availability details",
      availabilityBody:
        "Available features depend on the deployed version and your permissions. This page does not create a subscription or payment.",
      quotaTitle: "Two independent analysis allowances",
      quotaBody:
        "Current configuration: 10 voice attempts and 10 receipt attempts per user per day, shared across their workspaces. The remaining allowance shown inside your account is the source of truth.",
      voice: "voice attempts per day",
      receipts: "receipt attempts per day",
      reset: "Allowances reset at 00:00 UTC, rather than local midnight.",
      rules: [
        {
          icon: "refresh",
          title: "When does an attempt count?",
          body: "An attempt counts when the request is admitted for analysis. A manual retry of a failed analysis is a new attempt; status checks, review and confirmation do not consume another analysis attempt.",
        },
        {
          icon: "pen",
          title: "Manual entry stays available",
          body: "Exhausting one allowance blocks new requests of that type until reset. You can still use manual entry and review drafts that are already ready.",
        },
        {
          icon: "info",
          title: "AI provider costs",
          body: "OpenAI usage has a cost to the operator based on API consumption. A daily allowance does not make the external service free or imply an unlimited plan.",
        },
      ],
    },
    security: {
      eyebrow: "Clear controls. Your decision.",
      title: "Financial history deserves\ncare at every step.",
      intro:
        "An overview of controls implemented in the platform: access permissions, private files and review before financial confirmation.",
      section: "How are operations and data handled?",
      sectionBody:
        "Safe use also depends on protecting your account and reviewing what you choose to share.",
      items: [
        {
          icon: "lock",
          title: "Permission-based access",
          body: "Data and operation requests check the user and workspace permissions. Knowing an account or draft identifier does not grant access to it.",
        },
        {
          icon: "shield",
          title: "Google identity verification",
          body: "The backend verifies the Google identity token before signing in or creating an account and records required consent. The platform does not receive your Google password.",
        },
        {
          icon: "scan",
          title: "Private audio & receipt storage",
          body: "Analysis files use private storage and are validated before processing. Files follow a cleanup policy; cleaning source files does not erase confirmed financial history.",
        },
        {
          icon: "check",
          title: "Explicit expense confirmation",
          body: "Voice and receipt analysis prepares a draft. You can review and edit it; a financial transaction is recorded only after confirmation.",
        },
        {
          icon: "layers",
          title: "Repeated-request controls",
          body: "Supported operations use idempotency keys, database transactions and record locks to limit duplicate financial effects when requests arrive concurrently.",
        },
        {
          icon: "history",
          title: "Reviewable history",
          body: "Financial history links operations to their effects. Archiving an account does not delete its history, and reversals preserve the original operation for review.",
        },
      ],
      controlTitle: "Privacy choices with clear effects",
      controls: [
        "The microphone requires your permission. Local audio is not sent until you choose to use the recording.",
        "AI features send the data needed for the task to the provider. Review what you share.",
        "Hiding amounts protects their display from nearby viewers. It does not change records or encrypt data.",
        "Privacy requests and access concerns can be sent to the email listed in the privacy policy.",
      ],
    },
    about: {
      eyebrow: "About SmartSpend",
      title: "Organize the details.\nUnderstand the whole picture.",
      intro:
        "SmartSpend is a personal money management platform combining accounts, transactions, planning and reports with AI tools that help you enter and understand data.",
      mission: "Why are we building SmartSpend?",
      missionBody:
        "To make money tracking a clearer, easier habit: know what came in, what went out and what is ahead, and review progress toward your goals in one connected experience.",
      items: [
        {
          icon: "eye",
          title: "Clarity before complexity",
          body: "Balances, movements, categories and reports help you return to the underlying records and understand them in context.",
        },
        {
          icon: "check",
          title: "Your decision comes first",
          body: "Analysis helps prepare a draft; you review the values and confirm the expense. A suggestion does not execute a financial decision on your behalf.",
        },
        {
          icon: "globe",
          title: "Designed for different preferences",
          body: "Arabic and English, two reading directions, light and dark modes, and interfaces that adapt to different screen sizes.",
        },
      ],
      journeyTitle: "From details to a trackable plan",
      journey: [
        {
          title: "Collect",
          body: "Your accounts and transactions in an organized record.",
        },
        {
          title: "Understand",
          body: "Review reports, categories and movement details.",
        },
        { title: "Plan", body: "Follow budgets, goals and commitments." },
      ],
      note: "The current focus is personal use. The company route is shown as unavailable for now; it is not presented here as a ready business product.",
    },
    contact: {
      eyebrow: "An open door for your questions",
      title: "Your question and feedback\nhave a place here.",
      intro:
        "Have a usage question, product feedback or a privacy request? Choose a topic and prepare a message for the designated contact email.",
      emailTitle: "Contact email",
      emailBody:
        "Use the same address listed in the privacy policy. No guaranteed response time or live chat service is advertised.",
      copy: "Copy email",
      copied: "Email copied",
      copyFailed:
        "Could not copy. You can select the email address and copy it manually.",
      topics: {
        general: "General question",
        issue: "Usage problem",
        feedback: "Suggestion or feedback",
        privacy: "Privacy request",
        security: "Access or security concern",
      },
      formTitle: "Prepare your message",
      formBody:
        "This tool opens your email app. You send the message from that app; this form does not send its contents to the platform server.",
      topic: "Message topic",
      name: "Your name (optional)",
      message: "Message details",
      messageHint:
        "Include the page, steps and displayed error. Avoid passwords, sign-in codes, keys and sensitive financial files.",
      placeholder: "How can we help?",
      submit: "Open email app",
      emailFallback: "Or email us directly",
      formRequired: "Please enter your message details first.",
      opened:
        "Opening your email app was requested. Review and send the message there; it was not sent automatically.",
      routesTitle: "Your answer might be here",
      routes: [
        {
          page: "support",
          icon: "help",
          title: "Usage help",
          body: "Answers about accounts, voice, receipts and review.",
        },
        {
          page: "security",
          icon: "shield",
          title: "Security & privacy",
          body: "Learn about access controls and the effects of privacy choices.",
        },
      ],
    },
    support: {
      eyebrow: "Help center",
      title: "A clear answer.\nA step you can take.",
      intro:
        "Practical guidance for features implemented in SmartSpend, from recording an expense to reviewing an account. Search for what you need now.",
      search: "Search help",
      searchPlaceholder:
        "Try voice recording, archived accounts, daily allowance…",
      clear: "Clear search",
      results: "Answers found",
      empty: "No matching answer found.",
      emptyBody: "Try a shorter search or contact us with the page and steps.",
      filters: {
        all: "All topics",
        start: "Getting started",
        ai: "Voice & receipts",
        finance: "Financial history",
        privacy: "Privacy",
      },
      questions: [
        {
          id: "start",
          group: "start",
          q: "How do I start organizing my account?",
          a: "Create a financial account with its correct currency and opening balance, then record income and expenses with appropriate categories. Review Getting Started and the dashboard, then add budgets and goals as needed.",
        },
        {
          id: "google",
          group: "start",
          q: "Does Google sign-in require consent?",
          a: "New accounts require agreement to the terms and privacy policy. Google identity is verified by the backend. If an error appears, keep its message and contact us; do not send identity tokens or sign-in credentials.",
        },
        {
          id: "company",
          group: "start",
          q: "Are company accounts available now?",
          a: "The current version focuses on individuals. The company route displays that it is unavailable for now, so do not rely on it as an activated business service.",
        },
        {
          id: "voice",
          group: "ai",
          q: "How do I record an expense by voice?",
          a: "Choose voice on Financial Operations and allow microphone access. Describe one expense, including amount, currency and date where possible. Stop and listen, then choose to use the recording. The current recording limit is 60 seconds. After processing, review the draft and confirm it.",
        },
        {
          id: "processing",
          group: "ai",
          q: "What should I do while voice or receipt analysis runs?",
          a: "Wait for the analysis status; uploading a file does not mean analysis has finished. If tracking pauses, refresh its status or open the draft from history. When an upload result is uncertain, check the existing request before creating a new one.",
        },
        {
          id: "limits",
          group: "ai",
          q: "What happens when the daily allowance runs out?",
          a: "The current configuration is 10 voice and 10 receipt attempts per day, independent and shared across the user's workspaces. They reset at 00:00 UTC. Your account's displayed remaining allowance is authoritative. Manual entry and review of ready drafts remain available. Temporary throttling is different from daily exhaustion.",
        },
        {
          id: "draft",
          group: "ai",
          q: "Does analysis record an expense automatically?",
          a: "No. Voice and receipt analysis creates a review draft. Correct missing or inaccurate values, choose an eligible account and category, save your changes and explicitly confirm the transaction.",
        },
        {
          id: "archive",
          group: "finance",
          q: "Where can I find an archived account?",
          a: "Open Accounts and choose the archived accounts view. Archiving preserves history, so account details and movements can still be reviewed. It prevents use in new operations that require an active account.",
        },
        {
          id: "balance",
          group: "finance",
          q: "Why was an expense refused because of balance?",
          a: "Check the selected account, currency, balance and its negative-balance rule. Do not confirm incorrect values. Refresh the data and retry once the issue has been resolved.",
        },
        {
          id: "transfer",
          group: "finance",
          q: "Does a transfer here move money through my bank?",
          a: "A SmartSpend transfer records movement between your accounts inside the platform. It does not execute a bank or external wallet transfer, and moving money between accounts should not by itself count as new income or expense.",
        },
        {
          id: "local",
          group: "privacy",
          q: "Do templates and saved views appear on every device?",
          a: "Dashboard customization, templates, saved views and hidden amounts are stored locally in the browser per user and workspace. You may need to set them up again on another device or browser; manage them in Settings.",
        },
        {
          id: "privacy",
          group: "privacy",
          q: "How can I request a Google data correction or unlinking?",
          a: "Use Contact to email the address in the privacy policy. Account ownership verification may be required. Revoking SmartSpend's permission in Google alone does not delete the platform account or financial history.",
        },
      ],
      safety:
        "When contacting us, include the issue and steps and hide sensitive details in screenshots. Never share passwords or sign-in codes.",
    },
  },
};
