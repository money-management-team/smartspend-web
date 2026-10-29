/** Integration smoke test. Pass a Playwright page already on the local app origin. */
export default async function runAdminSmoke(page) {
  const results = [];
  function assert(condition, label) {
    if (!condition) throw new Error(label);
    results.push(label);
  }
  await page.setViewportSize({ width: 1440, height: 1511 });
  await page.goto(new URL("/admin", page.url()).href);
  await page.evaluate(() => {
    localStorage.setItem("i18nextLng", "en");
    localStorage.setItem("theme", "light");
  });
  await page.reload();
  await page.getByRole("heading", { name: "SmartSpend administration", exact: true }).waitFor();
  for (const [language, theme] of [["en", "light"], ["en", "dark"], ["ar", "dark"], ["ar", "light"]]) {
    if (await page.locator("html").getAttribute("lang") !== language) {
      await page.getByRole("button", { name: "Switch to Arabic", exact: true }).click();
    }
    if (await page.locator("html").getAttribute("data-theme") !== theme) {
      await page.getByRole("button", { name: language === "ar" ? "تبديل مظهر الألوان" : "Switch color theme", exact: true }).click();
    }
    await page.reload();
    await page.locator(".admin-priorities").waitFor();
    assert(await page.locator("html").getAttribute("dir") === (language === "ar" ? "rtl" : "ltr"), `${language}/${theme}: direction persists`);
    assert(await page.locator("html").getAttribute("data-theme") === theme, `${language}/${theme}: theme persists`);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${language}/${theme}: no horizontal overflow`);
    assert(await page.locator(".admin-metric__value").allTextContents().then(values => values.join("|") === "18,492|326|$72.2K|13"), `${language}/${theme}: reference metrics`);
  }
  await page.getByRole("button", { name: "مدفوعات تحتاج إلى متابعة", exact: false }).click();
  await page.locator("dialog[open]").waitFor();
  assert((await page.locator("dialog").innerText()).includes("$1,042"), "Priority details");
  await page.keyboard.press("Escape");
  await page.locator("dialog[open]").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "تحديث", exact: true }).click();
  await page.getByRole("button", { name: "التبديل إلى الإنجليزية", exact: true }).click();
  assert((await page.getByRole("status").innerText()).includes("Demo overview refreshed"), "Status retranslates on language change");
  await page.getByRole("button", { name: "Switch to Arabic", exact: true }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "تصدير الملخص", exact: true }).click();
  const download = await downloading;
  assert(download.suggestedFilename() === "smartspend-admin-demo-ar.csv", "Localized export filename");
  const stream = await download.createReadStream();
  let csv = "";
  for await (const chunk of stream) csv += chunk.toString("utf8");
  assert(csv.includes('"18,492"') && csv.includes("بيانات تجريبية") && csv.includes("مستخدمو الأفراد"), "CSV preserves numbers and Arabic and identifies demo data");
  await page.getByRole("textbox").fill("الدعم");
  await page.getByRole("textbox").press("Enter");
  await page.locator("dialog[open]").waitFor();
  assert((await page.locator("dialog").innerText()).includes("هذا القسم مخطط"), "Search Enter opens and keeps dialog open");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  assert(await page.getByRole("textbox").evaluate(element => element === document.activeElement), "Search keyboard shortcut");
  await page.getByRole("button", { name: "طي القائمة", exact: true }).click();
  assert(await page.locator(".admin-app").getAttribute("class").then(value => value.includes("collapsed")), "Sidebar collapses");
  await page.getByRole("button", { name: "توسيع القائمة الجانبية", exact: true }).click();
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Arabic width ${width}: no overflow`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "فتح قائمة التنقل", exact: true }).click();
  assert(await page.evaluate(() => !!document.activeElement.closest(".admin-sidebar")), "Opening mobile drawer moves focus inside");
  for (let index = 0; index < 14; index++) await page.keyboard.press("Tab");
  assert(await page.evaluate(() => !!document.activeElement.closest(".admin-sidebar")), "Mobile drawer contains keyboard focus");
  await page.keyboard.press("Escape");
  assert(await page.getByRole("button", { name: "فتح قائمة التنقل", exact: true }).evaluate(element => element === document.activeElement), "Escape restores focus to mobile menu toggle");
  await page.getByRole("button", { name: "فتح قائمة التنقل", exact: true }).click();
  await page.getByRole("button", { name: "الفوترة", exact: true }).click();
  await page.locator("dialog[open]").waitFor();
  await page.keyboard.press("Escape");
  assert(await page.locator(".admin-sidebar").getAttribute("class").then(value => !value.includes("--open")), "Selecting section closes mobile navigation");
  await page.getByRole("button", { name: "التبديل إلى الإنجليزية", exact: true }).click();
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `English width ${width}: no overflow`);
  }
  return results;
}
