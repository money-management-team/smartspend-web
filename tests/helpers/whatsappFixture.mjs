import { account, envelope, failure } from "./mobileApi.mjs";
import { paginator } from "./planningFixture.mjs";

/*
 * Fictional WhatsApp data in the backend's own shapes (WhatsAppIntegrationResource, WhatsAppExpenseDraftResource), and a
 * fake backend that answers like GET /integrations/whatsapp, its draft summary, the draft list and one draft. The list
 * follows the real rule: without a `status` it lists ready_for_review only.
 */

/** The answer of GET /integrations/whatsapp. */
export const integrationAnswer = (over = {}) => ({
  enabled: true,
  state: "linked",
  capabilities: { can_link: false, can_manage_link: true, can_review_drafts: true },
  public_number: "970591234567",
  integration: {
    linked: true,
    status: "active",
    workspace_id: 1,
    phone_last_digits: "4321",
    language: "ar",
    generation: 1,
    default_account_id: 3,
    default_account: { id: 3, name: "Everyday wallet", currency_code: "ILS" },
    linked_at: "2026-09-01T10:00:00Z",
    revoked_at: null,
  },
  ...over,
});

/** One draft in the backend's WhatsAppExpenseDraftResource shape. */
export const whatsappDraft = (id, over = {}) => ({
  id,
  workspace_id: 1,
  source: "whatsapp",
  status: "ready_for_review",
  review_version: 3,
  can_edit: true,
  can_confirm: true,
  can_discard: true,
  review_values: { account_id: 3, category_id: 4, amount: "18.0000", currency_code: "ILS", description: "Taxi", transaction_date: "2026-10-28", transaction_time: "09:15:00", workspace_timezone: "Asia/Hebron" },
  confirmation: { ready: true, issues: [] },
  timestamps: {
    ready_for_review_at: "2026-10-28T07:16:00Z",
    confirmed_at: null,
    discarded_at: null,
    expired_at: null,
    expires_at: "2099-11-04T07:16:00Z",
    created_at: "2026-10-28T07:15:30Z",
    updated_at: "2026-10-28T07:16:00Z",
  },
  account: { ...account({ id: 3, name: "Everyday wallet", currency_code: "ILS" }), current_balance: "1284.5000" },
  category: { id: 4, name: "Transport", type: "expense" },
  ...over,
});

const issue = (code, message, field = "account_id") => ({ field, code, message });
export const draftIssue = issue;

/**
 * @param {{ integration?: object | null, drafts?: object[], pending?: number | null, accounts?: object[] }} data
 * `pending` is the backend's own count (`null`: the summary answers 404).
 */
export function whatsappBackend({ integration = integrationAnswer(), drafts = [], pending = null } = {}) {
  return (call) => {
    const q = call.query;
    const page = { page: Number(q.page ?? 1), perPage: Number(q.per_page ?? 20) };

    if (call.path === "/integrations/whatsapp") return integration === null ? failure(500, "Server error") : { body: envelope(integration) };
    if (call.path === "/integrations/whatsapp/expense-drafts/summary") return pending === null ? failure(404, "Not found") : { body: envelope({ pending_review_count: pending }) };

    if (call.path === "/integrations/whatsapp/expense-drafts") {
      const status = q.status ?? "ready_for_review";
      return { body: envelope({ drafts: paginator(drafts.filter((row) => row.status === status), page) }) };
    }

    const one = /^\/integrations\/whatsapp\/expense-drafts\/(\d+)$/.exec(call.path);
    if (one) {
      const found = drafts.find((row) => String(row.id) === one[1]);
      return found ? { body: envelope({ draft: found }) } : failure(404, "Not found");
    }

    if (call.path === "/accounts") return { body: envelope({ accounts: [account({ id: 3, name: "Everyday wallet" })] }) };
    if (call.path === "/categories") return { body: envelope({ categories: [{ id: 4, name: "Transport", type: "expense", is_system: false, is_active: true }] }) };

    return failure(404, "Not found");
  };
}
