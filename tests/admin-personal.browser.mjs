/** Pass a Playwright page already on the local app origin. Uses demo data only. */
export default async function runPersonalSmoke(page) {
  const checks = [];
  function assert(condition, label) {
    if (!condition) throw new Error(label);
    checks.push(label);
  }
  const base = new URL(page.url()).origin;
  await page.goto(`${base}/admin/personal`);
  for (const [language, theme] of [["en", "light"], ["en", "dark"], ["ar", "light"], ["ar", "dark"]]) {
    await page.evaluate(({ language, theme }) => {
      localStorage.setItem("i18nextLng", language);
      localStorage.setItem("theme", theme);
    }, { language, theme });
    await page.reload();
    await page.getByRole("heading", { name: language === "en" ? "Personal administration" : "إدارة الأفراد", exact: true }).waitFor();
    assert(await page.locator("html").getAttribute("dir") === (language === "en" ? "ltr" : "rtl"), `${language}/${theme}: direction`);
    assert(await page.locator("html").getAttribute("data-theme") === theme, `${language}/${theme}: theme`);
    assert(await page.locator(".admin-nav__item[aria-current='page']").innerText().then(text => text === (language === "en" ? "Personal" : "الأفراد")), `${language}/${theme}: sidebar selection`);
    assert((await page.locator(".admin-personal-metrics .admin-metric__value").allTextContents()).join("|") === "18,492|12,804|5,312|61", `${language}/${theme}: reference metrics`);
    assert(await page.locator(".admin-personal-health__module").count() === 6, `${language}/${theme}: six module statuses`);
    assert(await page.locator(".admin-personal-health__module").evaluateAll(elements => elements.every(element => element.scrollWidth <= element.clientWidth)), `${language}/${theme}: health badges fit their cells`);
    assert(await page.locator("tbody tr").count() === 4, `${language}/${theme}: four recent users`);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${language}/${theme}: no overflow`);
  }
  await page.getByRole("button", { name: "١٩ حسابًا بانتظار التحقق", exact: false }).click();
  await page.locator("dialog[open]").waitFor();
  assert((await page.locator("dialog").innerText()).includes("حسابًا تجريبيًا"), "Follow-up details identify demo data");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "عرض الكل", exact: true }).click();
  assert(new URL(page.url()).searchParams.get("tab") === "users", "View all opens Users tab");
  const search = page.getByRole("searchbox");
  await search.fill("omar.khalil");
  assert(await page.locator("tbody tr").count() === 1 && (await page.locator("tbody").innerText()).includes("omar.khalil"), "Users search filters names/emails");
  await search.fill("missing-user-999");
  assert((await page.locator("tbody").innerText()).includes("لا يوجد مستخدمون"), "Users search empty state");
  await page.reload();
  await page.getByRole("tab", { name: "المستخدمون", exact: true }).waitFor();
  assert(await page.getByRole("tab", { name: "المستخدمون", exact: true }).getAttribute("aria-selected") === "true", "Direct Users tab URL survives reload");
  const userTab = page.getByRole("tab", { name: "المستخدمون", exact: true });
  await userTab.focus();
  await page.keyboard.press("ArrowLeft");
  assert(new URL(page.url()).searchParams.get("tab") === "health", "RTL arrow keys follow visual tab direction");
  await page.keyboard.press("End");
  assert(new URL(page.url()).searchParams.get("tab") === "reports", "End opens Reports tab");
  await page.getByRole("heading", { name: "التقارير التشغيلية للأفراد", exact: true }).waitFor();
  assert((await page.getByRole("tabpanel").innerText()).includes("لا تتاح تقارير المعاملات الشخصية"), "Reports keep financial data private");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "تصدير الملخص", exact: true }).click();
  const download = await downloading;
  assert(download.suggestedFilename() === "smartspend-personal-demo-ar.csv", "Personal summary localized download");
  const stream = await download.createReadStream();
  let csv = "";
  for await (const chunk of stream) csv += chunk.toString("utf8");
  assert(csv.includes('"12,804"') && csv.includes('"5,312"') && csv.includes("بيانات تجريبية") && !csv.includes("@"), "CSV exports aggregate demo figures without user records");
  await page.getByRole("tab", { name: "نظرة عامة", exact: true }).click();
  for (const language of ["ar", "en"]) {
    if (language === "en") await page.getByRole("button", { name: "التبديل إلى الإنجليزية", exact: true }).click();
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${language}: no body overflow at ${width}px`);
    }
  }
  await page.getByRole("button", { name: "Platform overview", exact: true }).click();
  await page.getByRole("heading", { name: "SmartSpend administration", exact: true }).waitFor();
  assert(new URL(page.url()).pathname === "/admin", "Sidebar returns to platform overview");
  await page.getByRole("button", { name: "Personal Personal administration", exact: false }).click();
  await page.getByRole("heading", { name: "Personal administration", exact: true }).waitFor();
  assert(new URL(page.url()).pathname === "/admin/personal", "Overview product card opens Personal screen");
  for (const path of ["/admin/personal/", "/ADMIN/PERSONAL"]) {
    await page.goto(`${base}${path}`);
    await page.getByRole("heading", { name: "Personal administration", exact: true }).waitFor();
    assert(await page.locator(".admin-nav__item[aria-current='page']").innerText() === "Personal", `Direct route ${path} selects Personal screen`);
  }
  return checks;
}
