import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "../../src/features/Dashboards/User/api/apiClient.js";
import {
  DEFAULT_DRAFT_PER_PAGE, draftFiltersToQuery, draftFiltersToSearchParams, formatDraftAmount,
  formatDraftDate, formatDraftInstant, formatDraftTime, getDraftsErrorMessage,
  hasActiveDraftFilters, readDraftFilters, readinessOf,
} from "../../src/features/Dashboards/User/WhatsAppDrafts/draftHelpers.js";
import { buildDraftListQuery, parseWhatsAppDraft } from "../../src/features/Dashboards/User/FinancialOperations/whatsappContract.js";
import { createI18n } from "../helpers/i18n.mjs";
import { draft } from "../whatsapp/fixtures.mjs";

const read = (query) => readDraftFilters(new URLSearchParams(query));

describe("filters and the URL", () => {
  it("defaults to the backend's own default status and page size", () => {
    assert.deepEqual(read(""), { status: "ready_for_review", date: "", account: "", per_page: DEFAULT_DRAFT_PER_PAGE, page: 1 });
  });

  it("accepts valid values", () => {
    assert.deepEqual(
      read("status=confirmed&date=2026-02-28&account=4&per_page=50&page=3"),
      { status: "confirmed", date: "2026-02-28", account: 4, per_page: 50, page: 3 },
    );
  });

  it("falls back to defaults for invalid values instead of passing them on", () => {
    assert.deepEqual(
      read("status=all&date=2026-02-30&account=abc&per_page=7&page=-3"),
      { status: "ready_for_review", date: "", account: "", per_page: 20, page: 1 },
    );
    assert.equal(read("account=0").account, "");
    assert.equal(read("page=1e3").page, 1);
    assert.equal(read("date=%3Cscript%3E").date, "");
    assert.equal(read("status=ready_for_review&status=confirmed").status, "ready_for_review");
  });

  it("round-trips and leaves defaults out of the URL", () => {
    assert.equal(draftFiltersToSearchParams(read("")).toString(), "");
    const filters = read("status=expired&date=2026-10-06&account=2&per_page=10&page=2");
    assert.equal(draftFiltersToSearchParams(filters).toString(), "status=expired&date=2026-10-06&account=2&per_page=10&page=2");
    assert.deepEqual(read(draftFiltersToSearchParams(filters).toString()), filters);
  });

  it("builds a query with only the five documented parameters, accepted by the adapter", () => {
    const filters = { ...read("status=confirmed&date=2026-10-06&account=2&page=2"), workspace_id: 9, user_id: 3 };
    const query = draftFiltersToQuery(filters);
    assert.deepEqual(Object.keys(query).sort(), ["account", "date", "page", "per_page", "status"]);
    assert.deepEqual(buildDraftListQuery(query), query);
    assert.deepEqual(draftFiltersToQuery(read("")), { status: "ready_for_review", per_page: 20, page: 1 });
  });

  it("knows when a filter is active (paging is not a filter)", () => {
    assert.equal(hasActiveDraftFilters(read("page=4&per_page=50")), false);
    assert.equal(hasActiveDraftFilters(read("status=discarded")), true);
    assert.equal(hasActiveDraftFilters(read("date=2026-10-06")), true);
    assert.equal(hasActiveDraftFilters(read("account=3")), true);
  });
});

describe("exact money display", () => {
  it("formats decimal strings without floats", () => {
    assert.equal(formatDraftAmount("25.2500", "ILS", "en"), "₪25.25");
    assert.equal(formatDraftAmount("25.2575", "ILS", "en"), "₪25.2575");
    assert.equal(formatDraftAmount("123456789012345.9999", "ILS", "en"), "₪123,456,789,012,345.9999");
    assert.equal(formatDraftAmount("0.1000", "USD", "en"), "$0.10");
    assert.equal(formatDraftAmount("9007199254740993.0001", "ILS", "en"), "₪9,007,199,254,740,993.0001");
  });

  it("an actual zero is shown as zero; missing or malformed is null, never zero", () => {
    assert.equal(formatDraftAmount("0.0000", "ILS", "en"), "₪0.00");
    for (const bad of [null, undefined, "", " ", "abc", "1,5", "1e3", 25.25, NaN, {}]) {
      assert.equal(formatDraftAmount(bad, "ILS", "en"), null, String(bad));
    }
  });

  it("keeps the currency association and handles unusual currencies", () => {
    assert.match(formatDraftAmount("5.0000", "usd", "en"), /\$5\.00/);
    assert.equal(formatDraftAmount("5.0000", "XXY", "en").includes("5.00"), true);
    assert.equal(formatDraftAmount("5.0000", null, "en"), "5.00");
    assert.equal(formatDraftAmount("5.0000", "", "en"), "5.00");
    assert.match(formatDraftAmount("25.2500", "ILS", "ar"), /[٠-٩]|25/);
  });

  it("never sums or converts: the helper takes one amount and one currency", () => {
    assert.equal(formatDraftAmount.length, 3);
  });
});

describe("dates, times and time zones", () => {
  it("shows a calendar date as that same day", () => {
    assert.equal(formatDraftDate("2026-10-06", "en"), "Oct 6, 2026");
    assert.equal(formatDraftDate("2026-01-01", "en"), "Jan 1, 2026");
    assert.equal(formatDraftDate("2026-12-31", "en"), "Dec 31, 2026");
    assert.equal(formatDraftDate(null, "en"), null);
    assert.equal(formatDraftDate("2026-02-30", "en"), null);
    assert.equal(formatDraftDate("06/10/2026", "en"), null);
  });

  it("shows the wall-clock time the user gave, without conversion", () => {
    assert.equal(formatDraftTime("12:30:00"), "12:30");
    assert.equal(formatDraftTime("08:05"), "08:05");
    assert.equal(formatDraftTime(null), null);
    assert.equal(formatDraftTime("24:00"), null);
  });

  it("formats server instants in the workspace time zone, safely", () => {
    const iso = "2026-10-06T21:30:00.000000Z";
    const gaza = formatDraftInstant(iso, "en", "Asia/Gaza");
    const utc = formatDraftInstant(iso, "en", "UTC");
    assert.notEqual(gaza, utc);
    assert.match(gaza, /Oct 7, 2026/);
    assert.match(utc, /Oct 6, 2026/);
    assert.ok(formatDraftInstant(iso, "en", "Not/AZone"));
    assert.ok(formatDraftInstant(iso, "en", undefined));
    assert.equal(formatDraftInstant("nope", "en", "UTC"), null);
    assert.equal(formatDraftInstant(null, "en", "UTC"), null);
  });
});

describe("readiness", () => {
  const parsed = (over) => parseWhatsAppDraft(draft(over));

  it("is only about drafts under review", () => {
    assert.equal(readinessOf(parsed({})), "complete");
    assert.equal(readinessOf(parsed({ confirmation: { ready: false, issues: [{ field: "amount", code: "amount_required", message: "x" }] } })), "incomplete");
    assert.equal(readinessOf(parsed({ confirmation: { ready: false, issues: [] } })), "none");
    for (const status of ["collecting", "confirmed", "discarded", "expired"]) {
      assert.equal(readinessOf(parsed({ status, confirmation: { ready: true, issues: [] } })), "none", status);
    }
  });
});

describe("error messages", () => {
  const cases = [
    [new ApiError("x", { status: 403, code: "FORBIDDEN" }), "dashboard.whatsappDrafts.errors.forbidden"],
    [new ApiError("x", { status: 404, code: "NOT_FOUND" }), "dashboard.whatsappDrafts.errors.notFound"],
    [new ApiError("x", { status: 422, code: "VALIDATION_ERROR" }), "dashboard.whatsappDrafts.errors.validation"],
    [new ApiError("x", { status: 401, code: "UNAUTHENTICATED" }), "dashboard.whatsappDrafts.errors.unauthenticated"],
  ];

  for (const lng of ["en", "ar"]) {
    it(`${lng}: maps statuses to translated text, never the raw backend text`, async () => {
      const i18n = await createI18n(lng);
      for (const [error, key] of cases) {
        const message = getDraftsErrorMessage(error, i18n.t);
        assert.equal(message, i18n.t(key));
        assert.notEqual(message, "x");
      }
      assert.deepEqual(i18n.missingKeys, []);
    });
  }

  it("429, network and malformed use the shared messages", async () => {
    const i18n = await createI18n("en");
    assert.match(getDraftsErrorMessage(new ApiError("", { status: 429, code: "RATE_LIMITED", retryAfter: "8" }), i18n.t), /8/);
    assert.equal(getDraftsErrorMessage(new ApiError("", { code: "NETWORK_ERROR" }), i18n.t), i18n.t("api.errors.network"));
    assert.equal(getDraftsErrorMessage(new ApiError("", { code: "MALFORMED_RESPONSE" }), i18n.t), i18n.t("api.errors.unexpected"));
  });
});
