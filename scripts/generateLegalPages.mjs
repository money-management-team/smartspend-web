import { copyFile, mkdir, writeFile } from "node:fs/promises";
import {
  POLICY_SUPPORT_EMAIL,
  POLICY_UPDATED_ON,
  policyContent,
} from "../src/components/AccessExperience/policyContent.js";

// Public HTML stays readable without authentication, the API or JavaScript.
// Generate from the same copy used by the existing consent dialog.
const publicDirectory = new URL("../public/", import.meta.url);
// Canonical origin of the production frontend (Hostinger).
const website = "https://smartspend.anasalharazeen.com";
const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);

const shield = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 3 4.5 6v5.5c0 4.5 3 7.5 7.5 9.5 4.5-2 7.5-5 7.5-9.5V6L12 3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>';

function languageSection(kind, language) {
  const copy = policyContent[language];
  const sections = copy[`${kind}Sections`];
  return `
      <section id="${language}" lang="${language}" dir="${language === "ar" ? "rtl" : "ltr"}" aria-labelledby="${language}-heading" class="policy-language">
        <div class="policy-language__heading">
          <span class="policy-eyebrow">${language === "ar" ? "النص العربي" : "English version"}</span>
          <h2 id="${language}-heading">${escapeHtml(copy[kind])}</h2>
          <p>${escapeHtml(copy[`${kind}Intro`])}</p>
        </div>
        <ol class="policy-sections" role="list">
${sections.map((section, index) => `          <li id="${language}-${index + 1}">
            <div class="policy-section__heading"><span aria-hidden="true">${String(index + 1).padStart(2, "0")}</span><h3>${escapeHtml(section.title)}</h3></div>
            <p>${escapeHtml(section.body)}</p>
          </li>`).join("\n")}
        </ol>
      </section>`;
}

function page(kind) {
  const other = kind === "privacy" ? "terms" : "privacy";
  const title = `${policyContent.ar[kind]} | ${policyContent.en[kind]} — SmartSpend`;
  const arabicDate = new Intl.DateTimeFormat("ar", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${POLICY_UPDATED_ON}T12:00:00Z`));
  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(`SmartSpend — ${policyContent.ar[`${kind}Intro`]} ${policyContent.en[`${kind}Intro`]}`)}" />
    <link rel="canonical" href="${website}/${kind}.html" />
    <link rel="icon" type="image/png" href="/smart-spend-logo.png" />
    <link rel="stylesheet" href="/legal-policy.css" />
  </head>
  <body>
    <a class="policy-skip" href="#main-content">انتقل إلى المحتوى / Skip to content</a>
    <header class="policy-header">
      <a class="policy-brand" href="/" aria-label="SmartSpend — الصفحة الرئيسية">
        <img src="/smart-spend-logo.png" alt="" width="42" height="42" />
        <span><strong dir="ltr">SmartSpend</strong><small>مساحة أوضح لقراراتك المالية</small></span>
      </a>
      <nav aria-label="التنقل واللغة / Navigation and language" class="policy-header__links">
        <a href="#ar" lang="ar">العربية</a>
        <a href="#en" lang="en" dir="ltr">English</a>
        <a href="/" class="policy-home">الصفحة الرئيسية</a>
      </nav>
    </header>
    <main id="main-content" class="policy-main" tabindex="-1">
      <section class="policy-hero" aria-labelledby="page-heading">
        <div class="policy-hero__icon">${shield}</div>
        <span class="policy-eyebrow">SmartSpend · الثقة تبدأ بالوضوح</span>
        <h1 id="page-heading">${escapeHtml(policyContent.ar[kind])}</h1>
        <p lang="en" dir="ltr" class="policy-hero__english">${escapeHtml(policyContent.en[kind])}</p>
        <p>${escapeHtml(policyContent.ar[`${kind}Intro`])}</p>
        <div class="policy-hero__meta"><span>آخر تحديث / Last updated</span><time datetime="${POLICY_UPDATED_ON}">${escapeHtml(arabicDate)}</time></div>
      </section>
      <div class="policy-layout">
        <aside class="policy-sidebar" aria-label="دليل القراءة / Reading guide">
          <nav class="policy-card policy-contents" aria-labelledby="contents-heading">
            <h2 id="contents-heading">في هذه الصفحة</h2>
            <ol>
${policyContent.ar[`${kind}Sections`].map((section, index) => `              <li><a href="#ar-${index + 1}">${escapeHtml(section.title)}</a></li>`).join("\n")}
            </ol>
            <a class="policy-english-link" href="#en" lang="en" dir="ltr">Read the English version →</a>
          </nav>
          <div class="policy-card policy-help">
            <span class="policy-eyebrow">نحن هنا للمساعدة</span>
            <h2>استفسار عن بياناتك؟</h2>
            <p>تواصل معنا للاستفسارات وطلبات الخصوصية.</p>
            <a href="mailto:${escapeHtml(POLICY_SUPPORT_EMAIL)}" dir="ltr">${escapeHtml(POLICY_SUPPORT_EMAIL)}</a>
          </div>
        </aside>
        <div class="policy-document">
${languageSection(kind, "ar")}
${languageSection(kind, "en")}
          <section class="policy-contact" aria-labelledby="contact-heading">
            <h2 id="contact-heading">تواصل معنا / Contact us</h2>
            <p>للاستفسار عن ${escapeHtml(policyContent.ar[kind])} أو تقديم طلب يتعلق ببياناتك، راسل فريق SmartSpend.</p>
            <p lang="en" dir="ltr">For questions about this ${escapeHtml(policyContent.en[kind])} or requests concerning your data, contact the SmartSpend team. Account-related requests require verification of account ownership.</p>
            <a href="mailto:${escapeHtml(POLICY_SUPPORT_EMAIL)}" dir="ltr">${escapeHtml(POLICY_SUPPORT_EMAIL)}</a>
          </section>
          <nav class="policy-bottom-links" aria-label="روابط ذات صلة / Related links">
            <a href="/${other}.html">${escapeHtml(policyContent.ar[other])} <span lang="en" dir="ltr">${escapeHtml(policyContent.en[other])}</span></a>
            <a href="/">العودة إلى SmartSpend <span lang="en" dir="ltr">Back to SmartSpend</span></a>
          </nav>
        </div>
      </div>
    </main>
    <footer class="policy-footer"><span dir="ltr">© 2026 SmartSpend.</span><span>وضوح أكبر، وقرارات بيدك.</span></footer>
  </body>
</html>
`;
}

// Validate all copy before writing either page.
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(POLICY_SUPPORT_EMAIL)) {
  throw new Error("A valid public support email is required.");
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(POLICY_UPDATED_ON) || !Number.isFinite(Date.parse(POLICY_UPDATED_ON))) {
  throw new Error("A valid policy update date is required.");
}
for (const language of ["ar", "en"]) {
  for (const kind of ["privacy", "terms"]) {
    const copy = policyContent[language];
    const sections = copy?.[`${kind}Sections`];
    if (!copy?.[kind] || !copy?.[`${kind}Intro`] || !Array.isArray(sections) || sections.length === 0 || sections.some((section) => !section?.title || !section?.body)) {
      throw new Error(`Incomplete ${language} ${kind} policy copy.`);
    }
  }
}
const pages = ["privacy", "terms"].map((kind) => [kind, page(kind)]);
await mkdir(publicDirectory, { recursive: true });
const fontsDirectory = new URL("legal-fonts/", publicDirectory);
await mkdir(fontsDirectory, { recursive: true });
for (const file of ["Cairo-Regular.ttf", "Cairo-Bold.ttf", "Tajawal-Bold.ttf"]) {
  await copyFile(
    new URL(`../src/assets/fonts/${file}`, import.meta.url),
    new URL(file, fontsDirectory),
  );
}
for (const [kind, html] of pages) {
  await writeFile(new URL(`${kind}.html`, publicDirectory), html, "utf8");
}
console.log("Generated public/privacy.html and public/terms.html from shared policy copy.");
