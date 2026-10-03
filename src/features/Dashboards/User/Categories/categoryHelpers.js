import { createElement } from "react";
import {
  LuBriefcase,
  LuCar,
  LuCoffee,
  LuGamepad2,
  LuGift,
  LuGraduationCap,
  LuHeartPulse,
  LuHouse,
  LuPiggyBank,
  LuPlane,
  LuReceipt,
  LuShirt,
  LuShoppingCart,
  LuSmartphone,
  LuTag,
  LuTrendingDown,
  LuTrendingUp,
  LuUtensils,
  LuWallet,
  LuZap,
} from "react-icons/lu";

import { getApiErrorMessage } from "../api/apiClient";

export const CATEGORY_TYPES = ["expense", "income"];

// Preset tints offered by the form; any valid hex from the backend is kept.
export const CATEGORY_COLORS = [
  "#3366FF",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#64748B",
];

// Icon names the form offers (stored as `category.icon`), in picker order.
// None of them repeats a type's default icon (see TYPE_ICONS).
const PICKER_ICONS = {
  wallet: LuWallet,
  briefcase: LuBriefcase,
  gift: LuGift,
  "piggy-bank": LuPiggyBank,
  utensils: LuUtensils,
  coffee: LuCoffee,
  "shopping-cart": LuShoppingCart,
  shirt: LuShirt,
  car: LuCar,
  plane: LuPlane,
  home: LuHouse,
  zap: LuZap,
  receipt: LuReceipt,
  smartphone: LuSmartphone,
  "heart-pulse": LuHeartPulse,
  "graduation-cap": LuGraduationCap,
  gamepad: LuGamepad2,
  tag: LuTag,
};

export const CATEGORY_ICONS = Object.keys(PICKER_ICONS);

// Other names the backend (e.g. system categories) may store.
const NAMED_ICONS = {
  ...PICKER_ICONS,
  house: LuHouse,
  food: LuUtensils,
  shopping: LuShoppingCart,
  transport: LuCar,
  travel: LuPlane,
  bills: LuReceipt,
  utilities: LuZap,
  health: LuHeartPulse,
  education: LuGraduationCap,
  entertainment: LuGamepad2,
  salary: LuBriefcase,
  savings: LuPiggyBank,
  "trending-up": LuTrendingUp,
  "trending-down": LuTrendingDown,
};

const TYPE_ICONS = {
  income: LuTrendingUp,
  expense: LuTrendingDown,
};

const isKnownCategoryIcon = (icon) => Object.hasOwn(NAMED_ICONS, icon ?? "");

// Returns the icon element (not a component type) so render code never
// creates components on the fly. Unknown names fall back to the type's icon.
export function renderCategoryIcon({ icon, type } = {}) {
  return createElement(
    (isKnownCategoryIcon(icon) && NAMED_ICONS[icon]) || TYPE_ICONS[type] || LuTag,
  );
}

// Only plain hex colors are used as a tint.
export function getCategoryColor(category) {
  return /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(category?.color ?? "")
    ? category.color
    : null;
}

const isTrue = (value) =>
  value === true || value === 1 || value === "1" || value === "true";

// System categories are shared, read-only, and never editable or archivable.
export const isSystemCategory = (category) => isTrue(category?.is_system);

// A missing `is_active` counts as active: the list only returns active ones.
export const isActiveCategory = (category) =>
  category?.is_active == null || isTrue(category.is_active);

export const canManageCategory = (category) =>
  Boolean(category) && !isSystemCategory(category) && isActiveCategory(category);

export const isCategoryEntity = (value, expectedId) =>
  Boolean(
    value &&
      typeof value === "object" &&
      value.id != null &&
      (expectedId == null || String(value.id) === String(expectedId)),
  );

/*
 * Category wording for codes where the generic message would mislead.
 * A 403 is usually a system category or another workspace's category; a 404
 * never says which of "doesn't exist" / "not yours" it is.
 */
export function getCategoryErrorMessage(error, t) {
  if (error?.code === "FORBIDDEN") return t("dashboard.categories.errors.forbidden");
  if (error?.code === "NOT_FOUND") return t("dashboard.categories.errors.notFound");

  return getApiErrorMessage(error, t);
}
