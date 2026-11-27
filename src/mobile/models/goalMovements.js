import { isCurrencyCode, parseDecimal } from "../money/decimal.js";
import { GOAL_MOVEMENTS_PER_PAGE } from "./goalMovementTabs.js";
import { buildPlanningPage } from "./planning.js";
import { idText, isRecord, textOrNull } from "./values.js";

/*
 * A goal's movements, one page of GET /savings-goals/{id}/activity or /contributions (GoalMovementResource): each row
 * is a posted transfer into or out of the goal. Read-only, and strict in the way the account's movements are: a page
 * that does not hold together is refused whole, so Mobile shows an error and never a half-right list.
 *
 * - every row must be this goal's (`savings_goal_id`), in this goal's currency (a row in another currency would
 *   put two currencies in one list), and carry a decimal amount;
 * - the amount is the backend's string; a withdrawal is shown with a minus because it takes money out of the goal
 *   (the full version does the same), a contribution without one. Nothing is added up and no balance is derived;
 * - a movement whose transfer was reversed stays listed, marked as reversed;
 * - a type that is neither contribution nor withdrawal is shown as sent, unsigned.
 */

export const MOVEMENT_TYPES = ["contribution", "withdrawal"];

const negate = (amount) => (amount.startsWith("-") || /^0+(\.0+)?$/.test(amount) ? amount : `-${amount}`);

function normalizeMovement(raw, goal) {
  if (!isRecord(raw)) return null;

  const id = idText(raw.id);
  const amount = typeof raw.amount === "string" && parseDecimal(raw.amount) ? raw.amount : null;
  if (!id || amount === null) return null;
  if (idText(raw.savings_goal_id) !== goal.id) return null;
  if (!isCurrencyCode(raw.currency_code) || raw.currency_code !== goal.currency) return null;

  const type = typeof raw.type === "string" && /^[a-z_]{1,40}$/.test(raw.type) ? raw.type : null;
  const known = MOVEMENT_TYPES.includes(type);
  const transferStatus = typeof raw.transfer_status === "string" && /^[a-z_]{1,40}$/.test(raw.transfer_status) ? raw.transfer_status : null;

  return {
    id,
    type,
    known,
    amount,
    signed: type === "withdrawal" ? negate(amount) : amount,
    currency: raw.currency_code,
    transferId: idText(raw.transfer_id),
    transferStatus,
    reversed: raw.is_reversed === true || transferStatus === "reversed",
    from: textOrNull(raw.from_account?.name, 80),
    to: textOrNull(raw.to_account?.name, 80),
    occurredAt: typeof raw.occurred_at === "string" ? raw.occurred_at : typeof raw.created_at === "string" ? raw.created_at : null,
  };
}

/**
 * @param {object} response the whole envelope
 * @param {{ id: string, currency: string }} goal the goal the page was asked for
 * @param {{ tab: "all" | "contribution" | "withdrawal", page: number }} asked
 */
export function buildGoalMovements(response, goal, { tab, page }) {
  const key = tab === "contribution" ? "contributions" : "activity";
  return buildPlanningPage(response, { page, perPage: GOAL_MOVEMENTS_PER_PAGE }, key, (raw) => normalizeMovement(raw, goal));
}
