import { readAccount, readAccountMovements, readAccounts, readAlerts, readDashboard } from "./readApi.js";

/*
 * What each store entry loads: the response's `data`, as the backend sent it.
 * Reading it into something displayable (and refusing what does not hold
 * together) is the models' job, so a bad response is kept out of the screens.
 */

export const loadDashboard = async (signal) => (await readDashboard(signal)).data;
export const loadAlerts = async (signal) => (await readAlerts(signal)).data;
export const loadAccounts = async (signal) => (await readAccounts(signal)).data;

export const accountLoader = (accountId) => async (signal) => (await readAccount(accountId, signal)).data;

// A movements page is returned whole (the envelope), because the paginator numbers live beside `data`.
export const movementsLoader = (accountId, page) => (signal) => readAccountMovements(accountId, page, signal);

export const keys = {
  dashboard: "dashboard",
  alerts: "alerts",
  accounts: "accounts",
  account: (id) => `account:${id}`,
  movements: (id, page) => `movements:${id}:${page}`,
};
