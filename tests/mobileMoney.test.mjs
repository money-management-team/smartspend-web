import "./helpers/domSetup.mjs";
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { createElement as h } from "react";
import { installDom, render } from "./helpers/dom.mjs";

import { MINUS, currencyName, formatMoneyParts, formatMoneyText, isNegativeAmount, parseDecimal } from "../src/mobile/money/decimal.js";
import { formatClock, formatDay, formatDayMonth, parseDate } from "../src/mobile/money/format.js";

/*
 * Mobile money. Exact strings: the point of this layer is that a backend
 * decimal is never turned into a JavaScript number, never rounded to hide a
 * digit, and never turned into 0.00 when it is missing or wrong.
 */

const dom = installDom();
after(() => dom.window.close());

describe("parseDecimal", () => {
  it("accepts the backend's decimal strings and keeps their digits", () => {
    assert.deepEqual(parseDecimal("1234.5000"), { negative: false, integer: "1234", fraction: "5000" });
    assert.deepEqual(parseDecimal("-125.5000"), { negative: true, integer: "125", fraction: "5000" });
    assert.deepEqual(parseDecimal("0"), { negative: false, integer: "0", fraction: "" });
    assert.deepEqual(parseDecimal("007.50"), { negative: false, integer: "7", fraction: "50" });
  });

  it("treats negative zero as zero", () => {
    assert.equal(parseDecimal("-0.0000").negative, false);
    assert.equal(isNegativeAmount("-0.0000"), false);
    assert.equal(isNegativeAmount("-0.0001"), true);
  });

  it("refuses anything that is not exactly that shape, instead of guessing", () => {
    for (const bad of ["abc", "", " 5.00", "5.00 ", "+5.00", "5,00", "1e3", "1.23456", ".5", "5.", "--5", "NaN", "Infinity", "1 000", "０１"]) {
      assert.equal(parseDecimal(bad), null, JSON.stringify(bad));
    }

    for (const notText of [null, undefined, 12.5, 0, true, {}, [], 10n]) {
      assert.equal(parseDecimal(notText), null, String(notText));
    }
  });

  it("refuses more than forty integer digits", () => {
    assert.ok(parseDecimal("9".repeat(40)));
    assert.equal(parseDecimal("9".repeat(41)), null);
  });
});

describe("formatMoneyText: exact strings", () => {
  const cases = [
    // [value, currency, locale, expected]
    ["0.0050", "ILS", "en", "0.005 ILS"],
    ["1.0049", "USD", "en", "1.0049 USD"],
    ["123456789012345.6789", "EUR", "en", "123,456,789,012,345.6789 EUR"],
    ["-125.5000", "ILS", "en", `${MINUS}125.50 ILS`],
    ["0.0000", "ILS", "en", "0.00 ILS"],
    ["-0.0000", "USD", "en", "0.00 USD"],
    ["1234567.1", "USD", "en", "1,234,567.10 USD"],
    ["12", "USD", "en", "12.00 USD"],
    ["-0.0050", "EUR", "en", `${MINUS}0.005 EUR`],
    ["9999999999999999999999999999999999999999.9999", "USD", "en", "9,999,999,999,999,999,999,999,999,999,999,999,999,999.9999 USD"],
  ];

  for (const [value, currency, locale, expected] of cases) {
    it(`${JSON.stringify(value)} ${currency} (${locale}) -> ${expected}`, () => {
      assert.equal(formatMoneyText(value, currency, locale), expected);
    });
  }

  it("keeps every digit of a value that a JavaScript number cannot hold", () => {
    // 2^53 + 1 is the first integer a double cannot represent.
    assert.equal(formatMoneyText("9007199254740993.0001", "USD", "en"), "9,007,199,254,740,993.0001 USD");
    assert.notEqual(String(Number("9007199254740993.0001")), "9007199254740993.0001", "the number conversion would have lost digits");
  });

  it("does not round a four-decimal amount to two decimals", () => {
    assert.equal(formatMoneyText("10.9999", "USD", "en"), "10.9999 USD");
    assert.equal(formatMoneyText("10.0049", "USD", "en"), "10.0049 USD");
    assert.equal(formatMoneyText("0.0001", "USD", "en"), "0.0001 USD");
  });

  it("shows a missing or invalid amount as unavailable (null), never as zero", () => {
    for (const bad of [null, undefined, "", "abc", "12,50", 12.5, NaN, {}]) {
      assert.equal(formatMoneyText(bad, "ILS", "en"), null, String(bad));
      assert.equal(formatMoneyParts(bad, "ILS", "en"), null);
    }
  });

  it("will not show an amount without a valid currency code", () => {
    for (const bad of [null, undefined, "", "il", "ILSS", "ils", "123", "I L"]) {
      assert.equal(formatMoneyText("10.00", bad, "en"), null, String(bad));
    }
  });

  it("uses Latin digits in Arabic and keeps the grouping and decimal marks of the locale", () => {
    assert.equal(formatMoneyText("1234567.5", "ILS", "ar"), "1,234,567.50 ILS");
    assert.equal(formatMoneyText("-125.5000", "USD", "ar"), `${MINUS}125.50 USD`);
    assert.doesNotMatch(formatMoneyText("1234567.5", "ILS", "ar"), /[\u0660-\u0669\u06F0-\u06F9]/, "no Arabic-Indic digits");
  });

  it("can show a plus sign on a positive amount, but never on zero or a negative one", () => {
    assert.equal(formatMoneyText("300.0000", "ILS", "en", { plus: true }), "+300.00 ILS");
    assert.equal(formatMoneyText("0.0000", "ILS", "en", { plus: true }), "0.00 ILS");
    assert.equal(formatMoneyText("-5.0000", "ILS", "en", { plus: true }), `${MINUS}5.00 ILS`);
  });

  it("never adds two amounts: there is no function for it in the money module", async () => {
    const module = await import("../src/mobile/money/decimal.js");
    assert.deepEqual(Object.keys(module).sort(), ["MINUS", "currencyName", "formatMoneyParts", "formatMoneyText", "isCurrencyCode", "isNegativeAmount", "parseDecimal"]);
  });
});

describe("multiple currencies", () => {
  it("formats each amount in its own currency and keeps the codes apart", () => {
    const rows = [["500.2500", "USD"], ["1234.5000", "ILS"], ["-20.5000", "EUR"]];
    assert.deepEqual(rows.map(([value, currency]) => formatMoneyText(value, currency, "en")), ["500.25 USD", "1,234.50 ILS", `${MINUS}20.50 EUR`]);
  });

  it("names currencies in the reader's language, and falls back to the code", () => {
    assert.equal(currencyName("USD", "en"), "US Dollar");
    assert.match(currencyName("USD", "ar"), /[\u0600-\u06FF]/);
    assert.equal(currencyName("ZZZ", "en"), "ZZZ");
    assert.equal(currencyName("nope", "en"), "");
  });
});

describe("dates", () => {
  it("reads the backend's date shapes and refuses everything else", () => {
    assert.ok(parseDate("2026-10-20T10:00:00Z"));
    assert.ok(parseDate("2026-10-20"));
    assert.ok(parseDate("2026-10-20 10:00:00"));
    for (const bad of [null, undefined, "", "not a date", 5]) assert.equal(parseDate(bad), null);
  });

  it("formats with Latin digits in the user's time zone, and returns null for a bad value", () => {
    assert.equal(formatDay("2026-10-20", "en", "UTC"), "Oct 20, 2026");
    assert.equal(formatDayMonth("2026-10-01", "en", "UTC"), "Oct 1");
    assert.doesNotMatch(formatDay("2026-10-20", "ar", "UTC"), /[\u0660-\u0669]/);
    assert.equal(formatDay("garbage", "en"), null);
    // The calendar day does not shift for a "YYYY-MM-DD" value, wherever the viewer is.
    assert.equal(formatDay("2026-10-20", "en", "Pacific/Kiritimati"), "Oct 20, 2026");
    assert.equal(formatDay("2026-10-20", "en", "Pacific/Pago_Pago"), "Oct 20, 2026");
  });

  it("falls back to the device zone when the zone name is invalid, instead of throwing", () => {
    assert.match(formatDay("2026-10-20T10:00:00Z", "en", "Not/AZone"), /2026/);
  });

  it("formats a clock time with Latin digits", () => {
    assert.match(formatClock(Date.UTC(2026, 9, 20, 14, 5), "ar"), /^[\d:\s\u200f\u200e]*[\d:]+.*$/);
  });
});

/* ---------- The Money component ---------- */

const { default: i18n } = await import("../src/i18n.js");
await import("../src/mobile/i18n/register.js");
const { default: Money } = await import("../src/mobile/money/Money.jsx");
const { MoneyPrivacyContext } = await import("../src/mobile/money/privacyContext.js");

async function show(props, { language = "en", hidden = false } = {}) {
  await i18n.changeLanguage(language);
  const view = await render(h(MoneyPrivacyContext.Provider, { value: hidden }, h("div", { id: "host" }, h(Money, props))));
  const root = document.querySelector("#host");
  const result = {
    visible: root.querySelector("[aria-hidden='true']")?.textContent ?? null,
    spoken: root.querySelector(".sm-sr")?.textContent ?? null,
    classes: root.firstElementChild.className,
    run: root.querySelector("bdi"),
    unmount: view.unmount,
  };
  return result;
}

describe("<Money>", () => {
  it("shows the amount as one left-to-right run and says it in words for a screen reader", async () => {
    const view = await show({ value: "-125.5000", currency: "ILS" });

    assert.equal(view.visible, `${MINUS}125.50ILS`.replace("ILS", "ILS"));
    assert.equal(view.run.getAttribute("dir"), "ltr");
    assert.equal(view.run.getAttribute("aria-hidden"), "true");
    assert.equal(view.spoken, "minus 125.50 Israeli New Shekel");
    assert.match(view.classes, /sm-money-negative/);
    await view.unmount();
  });

  it("keeps the same left-to-right run inside Arabic, with Arabic words for the reader", async () => {
    const view = await show({ value: "1234567.5000", currency: "USD", plus: true }, { language: "ar" });

    assert.equal(view.run.getAttribute("dir"), "ltr");
    assert.equal(view.visible, "+1,234,567.50USD");
    assert.match(view.spoken, /^موجب 1,234,567\.50 /);
    await view.unmount();
    await i18n.changeLanguage("en");
  });

  it("shows — and 'Not available' for a missing, invalid or currency-less amount; never 0.00", async () => {
    for (const props of [{ value: null, currency: "ILS" }, { value: "abc", currency: "ILS" }, { value: "10.00", currency: null }, { value: undefined, currency: undefined }]) {
      const view = await show(props);
      assert.equal(view.visible, "—");
      assert.equal(view.spoken, "Not available");
      assert.match(view.classes, /sm-money-na/);
      assert.doesNotMatch(document.querySelector("#host").textContent, /0\.00/);
      await view.unmount();
    }
  });

  it("hides the amount when the person chose to hide amounts, in both the text and the spoken version", async () => {
    const view = await show({ value: "1234.5000", currency: "ILS" }, { hidden: true });

    assert.equal(view.visible, "••••");
    assert.equal(view.spoken, "Amount hidden");
    assert.doesNotMatch(document.querySelector("#host").textContent, /1,?234/);
    await view.unmount();
  });
});
