/* Mobile sign-in and registration (auth/). The sign-in itself is the app's AuthProvider. */
export const auth = {
  en: {
    titles: { signin: "Sign in", register: "Create an account" },
    auth: {
      identifier: "Email or phone number",
      password: "Password",
      show: "Show",
      hide: "Hide",
      forgot: "Forgot your password?",
      remember: "Keep me signed in on this device",
      fix: "Some details need attention.",
      google: "Continue with Google",
      googleNote: "Google sign-in opens in the full version's sign-in page.",
      noAccount: "New to SmartSpend?",
      haveAccount: "Already have an account?",
      fullVersion: "Use the full version instead",
      signin: { title: "Sign in to SmartSpend", intro: "Your money, on your phone.", submit: "Sign in", busy: "Signing in…", link: "Sign in", wrong: "That email or phone number and password don't match an account.", invalid: "Check the details and try again." },
      register: {
        title: "Create your account", intro: "It takes a minute.", link: "Create an account", name: "Your name", confirmation: "Confirm the password",
        passwordHint: "At least {{min}} characters.", consent: "I agree to the", terms: "Terms of use", privacy: "Privacy policy", consentRequired: "Agree to the terms and the privacy policy to continue.",
        submit: "Create the account", busy: "Creating…", invalid: "Check the details and try again.", verifyNote: "After creating your account, SmartSpend emails you a link to verify your address.",
      },
    },
  },
  ar: {
    titles: { signin: "تسجيل الدخول", register: "إنشاء حساب" },
    auth: {
      identifier: "البريد الإلكتروني أو رقم الهاتف",
      password: "كلمة المرور",
      show: "إظهار",
      hide: "إخفاء",
      forgot: "نسيت كلمة المرور؟",
      remember: "أبقني مسجّل الدخول على هذا الجهاز",
      fix: "بعض التفاصيل تحتاج إلى انتباه.",
      google: "المتابعة باستخدام Google",
      googleNote: "يفتح تسجيل الدخول عبر Google في صفحة تسجيل الدخول في النسخة الكاملة.",
      noAccount: "جديد على SmartSpend؟",
      haveAccount: "لديك حساب بالفعل؟",
      fullVersion: "استخدم النسخة الكاملة بدلًا من ذلك",
      signin: { title: "تسجيل الدخول إلى SmartSpend", intro: "أموالك على هاتفك.", submit: "تسجيل الدخول", busy: "جارٍ تسجيل الدخول…", link: "تسجيل الدخول", wrong: "البريد الإلكتروني أو رقم الهاتف وكلمة المرور لا يطابقان أي حساب.", invalid: "تحقّق من التفاصيل وحاول مرة أخرى." },
      register: {
        title: "أنشئ حسابك", intro: "يستغرق ذلك دقيقة.", link: "إنشاء حساب", name: "اسمك", confirmation: "تأكيد كلمة المرور",
        passwordHint: "{{min}} أحرف على الأقل.", consent: "أوافق على", terms: "شروط الاستخدام", privacy: "سياسة الخصوصية", consentRequired: "وافق على الشروط وسياسة الخصوصية للمتابعة.",
        submit: "أنشئ الحساب", busy: "جارٍ الإنشاء…", invalid: "تحقّق من التفاصيل وحاول مرة أخرى.", verifyNote: "بعد إنشاء حسابك، يرسل SmartSpend رابطًا إلى بريدك لتأكيد عنوانك.",
      },
    },
  },
};
