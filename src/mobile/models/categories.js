import { readState } from "./planning.js";
import { dateOnlyOrNull, flagOrNull, idText, isRecord, textOrNull } from "./values.js";

/*
 * Categories as Mobile shows them: the list, one category.
 *
 * What the repo establishes (docs/categories/api.md, the Desktop pages that read
 * it; nothing here is invented):
 *
 * - GET /categories answers with `data.categories`, the ACTIVE categories of the
 *   workspace (system ones included), optionally for one `type` (income |
 *   expense); it is not paginated. GET /categories/{id} answers `data.category`.
 * - A category has id, workspace_id, parent_id, name, slug, type, icon, color,
 *   is_system, is_active, sort_order (and created_at / updated_at on one page).
 * - A system category is shared and read-only: only a category that says
 *   `is_system: false` (and is active) is treated as something the person may
 *   change. An unclear flag means "not changeable", never the other way round.
 * - `parent_id` is only ever READ here. No create or update parameter for a
 *   parent is documented, so Mobile has no parent selector and nothing that
 *   claims a hierarchy can be edited.
 *
 * No count, total or balance is shown for a category: the contract has none.
 */

export const CATEGORY_TYPES = ["income", "expense"];
export const NAME_MAX = 255;

const HEX = /^#(?:[\da-f]{3}|[\da-f]{6})$/i;
const ICON = /^[a-z0-9-]{1,40}$/;

const invalid = () => Object.assign(new Error("Categories could not be validated."), { code: "MALFORMED_RESPONSE" });

/** One category, or null when it is not an object with a usable id. */
export function normalizeCategory(raw) {
  if (!isRecord(raw)) return null;

  const id = idText(raw.id);
  if (!id) return null;

  const type = readState(raw.type, CATEGORY_TYPES);
  const system = flagOrNull(raw.is_system);
  // A missing `is_active` counts as active (the list only returns active ones); anything unclear is unknown.
  const active = raw.is_active === undefined ? true : flagOrNull(raw.is_active);

  return {
    id,
    name: textOrNull(raw.name, NAME_MAX),
    type: type.word,
    typeKnown: type.known,
    parentId: idText(raw.parent_id),
    icon: typeof raw.icon === "string" && ICON.test(raw.icon) ? raw.icon : null,
    color: typeof raw.color === "string" && HEX.test(raw.color) ? raw.color : null,
    system,
    active,
    // Fail closed: only an explicit "not system" and an explicit "active" may be changed.
    manageable: system === false && active === true,
    slug: textOrNull(raw.slug, 120),
    workspaceId: idText(raw.workspace_id),
    createdAt: dateOnlyOrNull(raw.created_at),
    updatedAt: dateOnlyOrNull(raw.updated_at),
  };
}

/** GET /categories, refused whole when anything in it is unusable: a row without an id, an id twice, no `categories` array. */
export function buildCategoryList(data) {
  const rows = isRecord(data) ? data.categories : null;
  if (!Array.isArray(rows)) throw invalid();

  const items = rows.map(normalizeCategory);
  if (items.some((item) => item === null)) throw invalid();
  if (new Set(items.map((item) => item.id)).size !== items.length) throw invalid();

  return items;
}

/*
 * The list as it is shown: the person's own categories, then the system ones,
 * each as groups of a category and the categories under it.
 *
 * Only ONE level of grouping is shown, and only when the data clearly supports
 * it: a category is listed under another when its `parent_id` names a category
 * that is in this list, is not itself, is in the same section, and is itself not
 * under anything. A parent that is missing (the type filter took it out, or it is
 * archived), a parent that points back, and anything deeper are listed on their
 * own: a relationship that cannot be read safely is not guessed. The backend's
 * order is kept.
 */
export function arrangeCategories(items) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const sectionOf = (item) => (item.system === false ? "custom" : "system");
  const validParent = (item) => {
    const parent = item.parentId ? byId.get(item.parentId) : null;
    return parent && parent.id !== item.id && sectionOf(parent) === sectionOf(item) ? parent : null;
  };
  const topLevel = (item) => validParent(item) === null;
  const parentOf = (item) => {
    const parent = validParent(item);
    return parent && topLevel(parent) ? parent : null;
  };

  const sections = { custom: [], system: [] };
  const groups = new Map();

  for (const item of items) {
    if (parentOf(item)) continue;
    const group = { category: item, children: [] };
    groups.set(item.id, group);
    sections[sectionOf(item)].push(group);
  }

  for (const item of items) {
    const parent = parentOf(item);
    if (parent) groups.get(parent.id).children.push(item);
  }

  return sections;
}

/** GET /categories/{id}. The category must be the one asked for: a response about another id is refused. */
export function buildCategoryDetail(data, requestedId) {
  const category = normalizeCategory(isRecord(data) ? data.category : null);
  return category && category.id === String(requestedId) ? category : null;
}

/* ---------- Filters ---------- */

export function readCategoryFilters(search) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search ?? "");
  const type = params.get("type") ?? "";
  return { type: CATEGORY_TYPES.includes(type) ? type : "" };
}

export const categoryFiltersToSearch = (filters) => (filters.type ? `?type=${filters.type}` : "");
