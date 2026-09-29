import { createElement } from "react";
import {
  LuBanknote,
  LuCreditCard,
  LuLandmark,
  LuPiggyBank,
  LuWalletCards,
} from "react-icons/lu";

import { getApiErrorMessage } from "../api/apiClient";

export const ACCOUNT_TYPES = ["cash", "bank", "wallet", "savings", "custom"];
export const ACCOUNT_CURRENCIES = ["ILS", "USD", "EUR", "JOD", "SAR", "AED"];

const TYPE_ICONS = {
  bank: LuLandmark,
  wallet: LuWalletCards,
  cash: LuBanknote,
  savings: LuLandmark,
  custom: LuWalletCards,
};

// `account.icon` names the backend may store; unknown names fall back to the type.
const NAMED_ICONS = {
  ...TYPE_ICONS,
  card: LuCreditCard,
  "credit-card": LuCreditCard,
  "piggy-bank": LuPiggyBank,
};

// Returns the icon element (not a component type) so render code never
// creates components on the fly.
export function renderAccountIcon(account) {
  return createElement(
    NAMED_ICONS[account?.icon] ?? TYPE_ICONS[account?.type] ?? LuWalletCards,
  );
}

// Only plain hex colors are used as a tint.
export function getAccountColor(account) {
  return /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(account?.color ?? "")
    ? account.color
    : null;
}

// Sign check on the backend's decimal string, without converting to a float.
export function isNegativeMoney(value) {
  const text = String(value ?? "").trim();
  return text.startsWith("-") && /[1-9]/.test(text);
}

export const getDisplayLocale = (language) =>
  language?.startsWith("ar") ? "ar" : "en";

/*
 * Account wording for codes where the generic message would mislead.
 * A 404 covers both "doesn't exist" and "not in your workspaces", so it never
 * says which.
 */
export function getAccountErrorMessage(error, t) {
  if (error?.code === "FORBIDDEN") return t("dashboard.accounts.errors.forbidden");
  if (error?.code === "NOT_FOUND") return t("dashboard.accounts.errors.notFound");
  if (error?.code === "CONFLICT") {
    return t("dashboard.accounts.errors.openingBalanceLocked");
  }

  return getApiErrorMessage(error, t);
}
