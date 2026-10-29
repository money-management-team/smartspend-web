// Shapes copied from the verified backend resources (smartspend-backend @ b7ca549).
export const account = (over = {}) => ({
  id: 1, name: "Cash", currency_code: "ILS", current_balance: "1234.5600", ...over,
});

export const draft = (over = {}) => ({
  id: 7,
  workspace_id: 1,
  source: "whatsapp",
  status: "ready_for_review",
  review_version: 3,
  can_edit: true,
  can_confirm: true,
  can_discard: true,
  review_values: {
    account_id: 1, category_id: 2, amount: "25.2500", currency_code: "ILS",
    description: "Lunch", transaction_date: "2026-10-06", transaction_time: "12:30:00",
    workspace_timezone: "Asia/Gaza",
  },
  confirmation: { ready: true, issues: [] },
  timestamps: { ready_for_review_at: "2026-10-06T09:00:00.000000Z", expires_at: "2026-10-20T09:00:00.000000Z" },
  account: account(),
  category: { id: 2, name: "Food" },
  ...over,
});

export const integration = (over = {}) => ({
  linked: true, status: "active", workspace_id: 1, phone_last_digits: "5678", language: "ar",
  generation: 1, default_account_id: 1, default_account: null,
  linked_at: "2026-10-06T09:00:00.000000Z", revoked_at: null, ...over,
});

export const availability = (over = {}) => ({
  enabled: true,
  state: "linked",
  capabilities: { can_link: false, can_manage_link: true, can_review_drafts: true },
  integration: integration(),
  ...over,
});

export const challenge = (over = {}) => ({
  status: "pending", sender_verified: false, phone_last_digits: null,
  expires_at: "2026-10-06T09:15:00.000000Z", sender_verified_at: null, confirmed_at: null, cancelled_at: null,
  ...over,
});

export const TOKEN = "0123456789abcdef0123456789abcdef";
export const DISABLED_BODY = {
  status: false, message: "WhatsApp integration is currently unavailable.", code: "whatsapp_disabled",
};
