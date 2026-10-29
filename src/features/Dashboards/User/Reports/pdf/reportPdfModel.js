import { COMMON_ANALYTICS_KEYS, OCCURRENCE_STATES, REPORT_DEFINITIONS } from "../reportDefinitions";
import {
  getExtraScalarKeys,
  getFieldLabel,
  getNestedGroups,
  getRowCurrency,
  getValueLabel,
  getValueType,
  getVisibleColumns,
  isCurrencyCode,
  isEmptyValue,
  isObject,
  parseComparison,
  parseDistribution,
  parseRankedGroups,
  parseTransactions,
  parseTrend,
  pickScalar,
  pickValue,
  reportHasItems,
  toBarWidth,
  toCurrencyRows,
  toRankedRow,
  toTransactionRow,
} from "../reportHelpers";
import {
  formatPdfDate,
  formatPdfDateTime,
  formatPdfLabel,
  formatPdfMoney,
  formatPdfMoneyParts,
  formatPdfNumber,
  formatPdfPercentage,
  formatPdfValue,
  getMoneyTone,
  getPdfLocale,
  getSignTone,
  getStatusTone,
  isRtlLanguage,
} from "./pdfFormatters";

/*
 * Turns a parsed report (reportHelpers.parseReport, all item pages merged)
 * into what the PDF prints: every value already formatted, with its
 * alignment and semantic tone. Nothing is calculated — figures, totals and
 * currencies are the backend's, and currencies are never combined. The PDF
 * components only lay this model out.
 *
 * Cell:   { text, tone?, strong?, sub?, badge?: { text, tone }, bar?: { width, tone } }
 * Column: { label, weight, align: "start" | "end" }
 * Block:  { kind: "table", caption?, columns, rows }
 *       | { kind: "list", caption?, rows: [{ label, value, tone }] }
 *       | { kind: "note", text }
 */

const EMPTY = "—";
const NUMERIC_TYPES = new Set(["money", "count", "decimal", "percent"]);
// Relative column widths by content: names get room, counts stay narrow.
const COLUMN_WEIGHTS = {
  primary: 2.3,
  text: 1.4,
  date: 1.2,
  datetime: 1.5,
  money: 1.3,
  count: 0.95,
  decimal: 0.85,
  percent: 0.85,
  status: 1,
  enum: 1,
  currency: 0.7,
  range: 1.75,
  progress: 1.25,
  occurrences: 1.9,
  frequency: 1.1,
};
// From this many item columns on, the report is laid out in landscape.
const LANDSCAPE_COLUMNS = 8;
const MAX_AUTO_COLUMNS = 8;
const hasMetricKeys = (value) =>
  Object.keys(value).some((key) => /count|total|amount|balance|percentage|outstanding|saved|target/.test(key));

const column = (label, type, extra = {}) => ({
  label,
  weight: COLUMN_WEIGHTS[type] ?? 1,
  align: NUMERIC_TYPES.has(type) ? "end" : "start",
  ...extra,
});

const statusCell = (value, ctx) =>
  value == null || value === "" ? { text: EMPTY } : { badge: { text: getValueLabel(value, ctx.t, ctx.i18n), tone: getStatusTone(value) } };

/* ---------- Values ---------- */

// One field as a label / value row, money in its own currency.
function fieldRow(row, key, currency, ctx) {
  const value = row[key];
  const type = getValueType(key, value);

  return {
    label: getFieldLabel(key, ctx.t, ctx.i18n),
    value: formatPdfValue(value, type, { ...ctx, currency }),
    tone: type === "money" ? getMoneyTone(key, value) : "neutral",
  };
}

function kpi(row, key, currency, ctx) {
  const value = row[key];
  const type = getValueType(key, value);
  const label = getFieldLabel(key, ctx.t, ctx.i18n);

  if (type === "money") {
    const parts = formatPdfMoneyParts(value, currency);
    return { label, value: parts.amount, unit: parts.currency, tone: getMoneyTone(key, value) };
  }

  return { label, value: formatPdfValue(value, type, { ...ctx, currency }), unit: null, tone: "neutral" };
}

/* ---------- Summary (summary_by_currency) ---------- */

/*
 * One block per currency. The report's first summary group becomes the key
 * figures; the other groups, any undocumented field and nested objects
 * (e.g. cash-flow buckets) become labelled lists.
 */
function buildSummary(rows, groups, ctx) {
  const listed = new Set(["currency_code", ...groups.flatMap((group) => group.fields)]);

  return rows.map((row) => {
    const currency = isCurrencyCode(row.currency_code) ? row.currency_code : null;
    const visible = groups
      .map((group) => ({ ...group, fields: group.fields.filter((key) => key in row && !isEmptyValue(row[key])) }))
      .filter((group) => group.fields.length > 0);
    const [hero, ...rest] = visible;
    const lists = rest.map((group) => ({
      title: group.title ? ctx.t(`dashboard.reports.summaryGroups.${group.title}`) : null,
      forecast: Boolean(group.forecast),
      rows: group.fields.map((key) => fieldRow(row, key, currency, ctx)),
    }));
    const extraKeys = getExtraScalarKeys(row, listed);

    if (extraKeys.length > 0) {
      lists.push({
        title: ctx.t("dashboard.reports.summaryGroups.other"),
        forecast: false,
        rows: extraKeys.map((key) => fieldRow(row, key, currency, ctx)),
      });
    }

    getNestedGroups(row, listed).forEach(({ key, value }) => {
      const nestedCurrency = isCurrencyCode(value.currency_code) ? value.currency_code : currency;
      lists.push({
        title: getFieldLabel(key, ctx.t, ctx.i18n),
        forecast: false,
        rows: getExtraScalarKeys(value, new Set(["currency_code"])).map((field) =>
          fieldRow(value, field, nestedCurrency, ctx),
        ),
      });
    });

    return {
      currency: row.currency_code ?? null,
      kpiTitle: hero?.title ? ctx.t(`dashboard.reports.summaryGroups.${hero.title}`) : null,
      kpiForecast: Boolean(hero?.forecast),
      kpis: hero ? hero.fields.map((key) => kpi(row, key, currency, ctx)) : [],
      lists: lists.filter((list) => list.rows.length > 0),
    };
  });
}

/* ---------- Analytics blocks ---------- */

const signed = (text, value) => (getSignTone(value) === "success" && text !== EMPTY ? `+${text}` : text);

function comparisonBlock(group, ctx) {
  const currency = isCurrencyCode(group.currency) ? group.currency : null;
  const hasChange = group.metrics.some((metric) => metric.change != null);
  const hasPercent = group.metrics.some((metric) => metric.percent != null);
  const columns = [
    column(ctx.t("dashboard.reports.comparison.metric"), "primary", { weight: 2.2 }),
    column(ctx.t("dashboard.reports.comparison.current"), "money"),
    column(ctx.t("dashboard.reports.comparison.previous"), "money"),
    ...(hasChange ? [column(ctx.t("dashboard.reports.comparison.change"), "money")] : []),
    ...(hasPercent ? [column(ctx.t("dashboard.reports.comparison.changePercent"), "percent", { weight: 1 })] : []),
  ];

  const rows = group.metrics.map((metric) => {
    const type = getValueType(metric.key, metric.current ?? metric.previous ?? metric.change);
    const value = (raw) => formatPdfValue(raw, type, { ...ctx, currency });

    return [
      { text: getFieldLabel(metric.key, ctx.t, ctx.i18n), strong: true },
      { text: value(metric.current) },
      { text: value(metric.previous), tone: "muted" },
      ...(hasChange ? [{ text: signed(value(metric.change), metric.change), tone: getSignTone(metric.change) }] : []),
      ...(hasPercent
        ? [{ text: signed(formatPdfPercentage(metric.percent), metric.percent), tone: getSignTone(metric.percent) }]
        : []),
    ];
  });

  return { kind: "table", caption: group.currency || null, columns, rows };
}

function trendBlock(group, ctx) {
  const currency = isCurrencyCode(group.currency) ? group.currency : null;
  const seriesLabel = (key) =>
    key
      .split(".")
      .map((part) => getFieldLabel(part, ctx.t, ctx.i18n))
      .join(" · ");

  return {
    kind: "table",
    caption: group.currency || null,
    columns: [
      column(getFieldLabel("period", ctx.t, ctx.i18n), "text", { weight: 1.3 }),
      ...group.series.map((key) => column(seriesLabel(key), "money")),
    ],
    rows: group.points.map((point) => [
      { text: formatPdfLabel(point.label, ctx.locale), strong: true },
      ...group.series.map((key) => ({
        text: formatPdfMoney(point.values[key], currency) ?? EMPTY,
        tone: getMoneyTone(key, point.values[key]),
      })),
    ]),
  };
}

function rankedBlock(group, ctx) {
  const rows = group.rows.map(toRankedRow);
  const has = (key) => rows.some((row) => row[key] != null);
  const captionParts = [group.currency, group.type ? getValueLabel(group.type, ctx.t, ctx.i18n) : null].filter(Boolean);

  return {
    kind: "table",
    caption: captionParts.join(" · ") || null,
    columns: [
      column(getFieldLabel("category", ctx.t, ctx.i18n), "primary"),
      ...(has("amount") ? [column(getFieldLabel("total", ctx.t, ctx.i18n), "money")] : []),
      ...(has("percent") ? [column(getFieldLabel("percentage", ctx.t, ctx.i18n), "progress", { align: "end" })] : []),
      ...(has("count") ? [column(getFieldLabel("transaction_count", ctx.t, ctx.i18n), "count")] : []),
    ],
    rows: rows.map((row) => {
      const currency = isCurrencyCode(row.currency) ? row.currency : group.currency;

      return [
        { text: row.name ?? ctx.t("dashboard.reports.uncategorized"), strong: true },
        ...(has("amount") ? [{ text: formatPdfMoney(row.amount, currency) ?? EMPTY }] : []),
        ...(has("percent")
          ? [{ text: formatPdfPercentage(row.percent), bar: { width: toBarWidth(row.percent), tone: "primary" } }]
          : []),
        ...(has("count") ? [{ text: formatPdfNumber(row.count) }] : []),
      ];
    }),
  };
}

function transactionsBlock(list, ctx) {
  const rows = list.map(toTransactionRow);

  return {
    kind: "table",
    caption: null,
    columns: [
      column(getFieldLabel("date", ctx.t, ctx.i18n), "date"),
      column(getFieldLabel("description", ctx.t, ctx.i18n), "primary"),
      column(getFieldLabel("type", ctx.t, ctx.i18n), "status", { weight: 0.9 }),
      column(getFieldLabel("amount", ctx.t, ctx.i18n), "money", { weight: 1.4 }),
    ],
    rows: rows.map((row) => [
      { text: formatPdfDate(row.date, ctx.locale) },
      {
        text: row.title ?? ctx.t("dashboard.reports.untitledTransaction"),
        strong: true,
        sub: [row.category, row.account].filter(Boolean).join(" · ") || null,
      },
      statusCell(row.type, ctx),
      { text: formatPdfMoney(row.amount, row.currency), tone: row.type === "income" ? "success" : "neutral" },
    ]),
  };
}

function distributionBlocks(groups, ctx) {
  return groups.map((group) => ({
    kind: "table",
    caption: group.currency || null,
    columns: [
      column(getFieldLabel("status", ctx.t, ctx.i18n), "status", { weight: 2 }),
      column(getFieldLabel("count", ctx.t, ctx.i18n), "count", { weight: 1 }),
    ],
    rows: group.entries.map((entry) => [statusCell(entry.key, ctx), { text: formatPdfNumber(entry.count) }]),
  }));
}

// A list of objects as a table of their scalar fields.
function autoTableBlock(rows, currency, caption, ctx) {
  const keys = [];
  rows.forEach((row) => {
    getExtraScalarKeys(row, new Set()).forEach((key) => {
      if (!keys.includes(key) && keys.length < MAX_AUTO_COLUMNS) keys.push(key);
    });
  });
  if (keys.length === 0) return null;

  const types = keys.map((key) =>
    key === "currency_code" ? "currency" : getValueType(key, rows.find((row) => row[key] != null)?.[key]),
  );

  return {
    kind: "table",
    caption,
    columns: keys.map((key, index) => column(getFieldLabel(key, ctx.t, ctx.i18n), types[index])),
    rows: rows.map((row) =>
      keys.map((key, index) => ({
        text: formatPdfValue(row[key], types[index], {
          ...ctx,
          currency: isCurrencyCode(row.currency_code) ? row.currency_code : currency,
        }),
        tone: types[index] === "money" ? getMoneyTone(key, row[key]) : "neutral",
      })),
    ),
  };
}

function listBlock(row, fields, currency, caption, ctx, depth = 0) {
  const known = fields.filter((key) => !isEmptyValue(row[key]));
  const keys = [...known, ...getExtraScalarKeys(row, new Set(["currency_code", ...fields]))];
  const blocks = [];

  if (keys.length > 0) {
    blocks.push({ kind: "list", caption, rows: keys.map((key) => fieldRow(row, key, currency, ctx)) });
  }
  if (depth < 1) {
    getNestedGroups(row, new Set(["currency_code", ...fields])).forEach(({ key, value }) => {
      blocks.push(...metricsBlocks(value, [], currency, ctx, getFieldLabel(key, ctx.t, ctx.i18n), depth + 1));
    });
  }

  return blocks;
}

/*
 * Any analytics value by its shape, like ReportMetrics on screen:
 * per-currency rows become one list (or table) per currency, counts by
 * status become a distribution, a list of objects becomes a table.
 */
function metricsBlocks(value, fields, currency, ctx, caption = null, depth = 0) {
  const rows = toCurrencyRows(value);

  if (rows.length > 0 && rows.every((row) => Array.isArray(row.points))) {
    return rows
      .map((row) => autoTableBlock(row.points.filter(isObject), row.currency_code, row.currency_code, ctx))
      .filter(Boolean);
  }

  if (rows.length > 0) {
    return rows.flatMap((row) =>
      listBlock(
        row,
        fields,
        isCurrencyCode(row.currency_code) ? row.currency_code : currency,
        [caption, row.currency_code].filter(Boolean).join(" · ") || null,
        ctx,
        depth,
      ),
    );
  }

  if (!isObject(value) || !hasMetricKeys(value)) {
    const distribution = parseDistribution(value);
    if (distribution.length > 0) return distributionBlocks(distribution, ctx);
  }

  if (Array.isArray(value)) {
    const objects = value.filter(isObject);
    if (objects.length > 0) return [autoTableBlock(objects, currency, caption, ctx)].filter(Boolean);

    const scalars = value.filter((item) => item != null && typeof item !== "object");
    return scalars.length > 0 ? [{ kind: "note", text: scalars.join(", ") }] : [];
  }

  if (isObject(value)) return listBlock(value, fields, currency, caption, ctx, depth);

  return isEmptyValue(value) ? [] : [{ kind: "note", text: formatPdfValue(value, getValueType("", value), ctx) }];
}

function sectionBlocks(section, value, ctx) {
  if (section.kind === "ranked") {
    const groups = parseRankedGroups(value);
    if (groups.length > 0) return groups.map((group) => rankedBlock(group, ctx));
  }
  if (section.kind === "transactions") {
    const rows = parseTransactions(value);
    if (rows.length > 0) return [transactionsBlock(rows, ctx)];
  }
  if (section.kind === "distribution") {
    const groups = parseDistribution(value);
    if (groups.length > 0) return distributionBlocks(groups, ctx);
  }

  return metricsBlocks(value, section.fields ?? [], null, ctx);
}

function buildSections(report, definition, ctx) {
  const { analytics } = report;
  const sections = [];
  const comparison = parseComparison({
    comparison: analytics.comparison_by_currency,
    previousSummary: analytics.previous_summary_by_currency,
    summary: report.summary,
    order: definition.summary.flatMap((group) => group.fields),
  });

  if (comparison.length > 0) {
    sections.push({
      title: ctx.t("dashboard.reports.sections.comparison"),
      hint: ctx.t("dashboard.reports.sections.comparisonHint"),
      blocks: comparison.map((group) => comparisonBlock(group, ctx)),
    });
  }

  definition.analytics
    .filter((section) => !isEmptyValue(analytics[section.key]))
    .forEach((section) => {
      const blocks = sectionBlocks(section, analytics[section.key], ctx);
      if (blocks.length === 0) return;

      sections.push({
        title: ctx.t(`dashboard.reports.sections.${section.title}`),
        badge: section.forecast ? ctx.t("dashboard.reports.forecastBadge") : null,
        blocks,
      });
    });

  const definedKeys = new Set(definition.analytics.map((section) => section.key));
  Object.keys(analytics)
    .filter((key) => !COMMON_ANALYTICS_KEYS.has(key) && !definedKeys.has(key) && !isEmptyValue(analytics[key]))
    .forEach((key) => {
      const blocks = metricsBlocks(analytics[key], [], null, ctx);
      if (blocks.length > 0) sections.push({ title: getFieldLabel(key, ctx.t, ctx.i18n), blocks });
    });

  const trend = parseTrend(analytics.trend_by_currency);
  if (trend.length > 0) {
    sections.push({
      title: ctx.t("dashboard.reports.sections.trend"),
      hint: ctx.t("dashboard.reports.pdf.trendHint", {
        unit: ctx.t(`dashboard.reports.filters.groupByOptions.${ctx.groupBy}`, { defaultValue: ctx.groupBy }),
      }),
      blocks: trend.map((group) => trendBlock(group, ctx)),
    });
  }

  return sections;
}

/* ---------- Items (data.items) ---------- */

function itemCell(column, row, currency, tableCurrency, ctx) {
  const value = pickScalar(row, column.keys);

  if (column.primary) {
    const path = column.link?.(row);
    const description = typeof row.description === "string" ? row.description : null;

    return {
      text: value ?? (path ? ctx.t("dashboard.reports.untitledTransaction") : EMPTY),
      strong: true,
      sub: column.id !== "description" && description && description !== value ? description : null,
      badge: row.is_archived === true ? { text: getValueLabel("archived", ctx.t, ctx.i18n), tone: "neutral" } : null,
    };
  }

  switch (column.type) {
    case "money": {
      const tone = column.tone
        ? getSignTone(value)
        : column.id === "amount" && row.type === "income"
          ? "success"
          : getMoneyTone(column.id, value);
      const text = tableCurrency ? formatPdfMoneyParts(value, null).amount : formatPdfMoney(value, currency);
      return { text: value == null ? EMPTY : text, tone };
    }
    case "status":
      return statusCell(value, ctx);
    case "enum":
      return { text: value == null ? EMPTY : getValueLabel(value, ctx.t, ctx.i18n) };
    case "currency":
      return { text: value ?? EMPTY };
    case "frequency": {
      if (value == null) return { text: EMPTY };
      const interval = Number(pickScalar(row, column.intervalKeys));
      const label = getValueLabel(value, ctx.t, ctx.i18n);
      return {
        text:
          Number.isInteger(interval) && interval > 1
            ? ctx.t("dashboard.reports.everyInterval", { interval, unit: label })
            : label,
      };
    }
    case "progress": {
      const status = pickScalar(row, column.statusKeys);
      const tone = status ? getStatusTone(status) : "primary";
      return {
        text: formatPdfPercentage(value),
        bar: value == null ? null : { width: toBarWidth(value), tone: tone === "neutral" ? "primary" : tone },
        badge: status ? { text: getValueLabel(status, ctx.t, ctx.i18n), tone } : null,
      };
    }
    case "range": {
      const end = pickScalar(row, column.endKeys);
      return { text: `${formatPdfDate(value, ctx.locale)} – ${formatPdfDate(end, ctx.locale)}` };
    }
    case "occurrences": {
      const counts = pickValue(row, column.keys);
      if (!isObject(counts)) return { text: EMPTY };

      const states = [
        ...OCCURRENCE_STATES.filter((state) => counts[state] != null),
        ...Object.keys(counts).filter((state) => !OCCURRENCE_STATES.includes(state) && counts[state] != null),
      ];
      return {
        text: states
          .map((state) => `${getValueLabel(state, ctx.t, ctx.i18n)} ${formatPdfNumber(counts[state])}`)
          .join(" · ") || EMPTY,
      };
    }
    default:
      return { text: formatPdfValue(value, column.type, { ...ctx, currency }) };
  }
}

function buildItems(report, definition, filters, totalRows, ctx) {
  const rows = report.items;
  const title = ctx.t(`dashboard.reports.itemsTitle.${report.report}`, { defaultValue: "" }) || null;

  if (rows.length === 0) return { title, table: null, empty: ctx.t("dashboard.reports.states.emptyItems"), columns: 0 };

  const visible = getVisibleColumns(definition.columns, rows);
  const fallback = isCurrencyCode(filters.currency) ? filters.currency : null;
  const currencies = new Set(rows.map((row) => getRowCurrency(row, fallback)));
  // One currency for the whole table: shown once in the column headers.
  const tableCurrency = currencies.size === 1 ? [...currencies][0] : null;
  const columns = visible
    .filter((item) => !(tableCurrency && item.type === "currency"))
    .map((item) => {
      const label = getFieldLabel(item.id, ctx.t, ctx.i18n);
      return column(
        tableCurrency && item.type === "money" ? `${label} (${tableCurrency})` : label,
        item.primary ? "primary" : item.type,
        item.type === "progress" ? { align: "start" } : {},
      );
    });

  return {
    title,
    columns: columns.length,
    table: {
      kind: "table",
      columns,
      rows: rows.map((row) =>
        visible
          .filter((item) => !(tableCurrency && item.type === "currency"))
          .map((item) => itemCell(item, row, getRowCurrency(row, fallback), tableCurrency, ctx)),
      ),
    },
    truncated:
      totalRows > rows.length
        ? ctx.t("dashboard.reports.pdf.truncated", { shown: formatPdfNumber(rows.length), total: formatPdfNumber(totalRows) })
        : null,
    empty: null,
  };
}

/* ---------- Document ---------- */

/*
 * `report`: parseReport() output with every item page merged.
 * `filters`: the Reports page filters the report was requested with.
 * `totalRows`: the backend's item total (pagination.total).
 */
export function buildReportPdfModel({ report, filters, totalRows = 0, t, i18n, generatedAt = new Date() }) {
  const language = i18n.language;
  const locale = getPdfLocale(language);
  const name = report.report ?? filters.report;
  const definition = REPORT_DEFINITIONS[name] ?? REPORT_DEFINITIONS.overview;
  const groupBy = report.filters?.group_by ?? filters.group_by;
  const ctx = { t, i18n, locale, groupBy };

  const from = report.period?.date_from ?? filters.from;
  const to = report.period?.date_to ?? filters.to;
  const currency = report.filters?.currency ?? filters.currency;
  const generated = formatPdfDateTime(generatedAt.toISOString(), locale);
  const meta = [
    from || to
      ? {
          label: getFieldLabel("period", t, i18n),
          value: t("dashboard.reports.period.range", { from: formatPdfDate(from, locale), to: formatPdfDate(to, locale) }),
        }
      : null,
    { label: t("dashboard.reports.filters.currency"), value: currency || t("dashboard.reports.filters.allCurrencies") },
    groupBy
      ? {
          label: t("dashboard.reports.filters.groupBy"),
          value: t(`dashboard.reports.filters.groupByOptions.${groupBy}`, { defaultValue: String(groupBy) }),
        }
      : null,
    report.period?.timezone ? { label: t("dashboard.reports.period.timezone"), value: report.period.timezone } : null,
  ].filter(Boolean);

  const flags = [];
  if (report.analytics.templates_are_forecast_only === true) flags.push(t("dashboard.reports.flags.forecastOnly"));
  if (typeof report.analytics.actual_source === "string" && report.analytics.actual_source) {
    flags.push(t("dashboard.reports.flags.actualSource", { source: getValueLabel(report.analytics.actual_source, t, i18n) }));
  }

  const summary = buildSummary(report.summary, definition.summary, ctx);
  const sections = buildSections(report, definition, ctx);
  const items = reportHasItems(name) ? buildItems(report, definition, filters, totalRows, ctx) : null;
  const title = t(`dashboard.reports.names.${name}`, { defaultValue: name });

  return {
    rtl: isRtlLanguage(language),
    language: isRtlLanguage(language) ? "ar" : "en",
    orientation: items && items.columns >= LANDSCAPE_COLUMNS ? "landscape" : "portrait",
    brand: t("dashboard.reports.pdf.brand"),
    tagline: t("dashboard.reports.pdf.tagline"),
    title,
    description: t(`dashboard.reports.descriptions.${name}`, { defaultValue: "" }) || null,
    generatedLabel: t("dashboard.reports.pdf.generated"),
    generated,
    footer: t("dashboard.reports.pdf.footer", { date: generated }),
    pageLabel: (page, total) => t("dashboard.reports.pdf.page", { page, total }),
    meta,
    notes: definition.notes.map((note) => t(`dashboard.reports.notes.${note}`)),
    flags,
    summaryTitle: t("dashboard.reports.sections.summary"),
    summaryHint: summary.length > 1 ? t("dashboard.reports.sections.summaryMultiCurrency") : null,
    forecastBadge: t("dashboard.reports.forecastBadge"),
    summary,
    sections,
    items,
    isEmpty: summary.length === 0 && sections.length === 0 && (!items || !items.table),
    emptyTitle: t("dashboard.reports.pdf.emptyTitle"),
    emptyHint: t("dashboard.reports.states.emptyHint"),
  };
}
