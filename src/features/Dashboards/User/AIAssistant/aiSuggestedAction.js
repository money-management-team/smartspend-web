// Only the known, read-only navigation target is accepted. Never follow an
// API path supplied by an AI response or post a contribution automatically.
export function getSavingsContributionSuggestion(action) {
  if (action?.type !== "open_savings_contribution_form" || action.target_type !== "savings_goal"
    || action.requires_user_confirmation !== true) return null;
  const id = Number(action.target_id);
  const amount = String(action.prefill?.amount ?? "");
  const currency = String(action.prefill?.currency_code ?? "").toUpperCase();
  if (!Number.isSafeInteger(id) || id <= 0 || !/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(amount)
    || Number(amount) <= 0 || !/^[A-Z]{3}$/.test(currency)) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(action.suggested_date ?? "") ? action.suggested_date : null;
  return { targetId: id, amount, currency, date };
}
