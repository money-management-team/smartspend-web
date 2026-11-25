import { isCurrencyCode } from "../money/decimal.js";
import { amountIn, idText, isRecord, textOrNull } from "./values.js";

/*
 * The answer to POST /transfers (201, TransferController::store; identical on develop @ fd87531 and
 * fix/financial-idempotency-p0 @ 6b696d72): data.transfer is TransferResource with the posted transfer, its two
 * accounts (summary, without balances) and its transactions. A replay of the same Idempotency-Key with the same
 * request answers with the first transfer, in the same shape.
 *
 * The result is shown only when the answer is provably the transfer that was asked for: an id, the two accounts that
 * were sent, and the amount that was sent. Anything else returns null and the screen falls back to the generic
 * "SmartSpend confirmed this" (it was a 2xx), never to figures it could not check. Every figure is the server's; the
 * balances after it are read from the server separately (GET /accounts/{id}), never worked out here.
 */

const sameAmount = (a, b) => typeof a === "string" && typeof b === "string" && a.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") === b.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");

export function buildTransferResult(data, input) {
  const raw = isRecord(data) ? data.transfer : null;
  if (!isRecord(raw) || !isRecord(input)) return null;

  const id = idText(raw.id);
  const fromId = idText(raw.from_account_id ?? raw.from_account?.id);
  const toId = idText(raw.to_account_id ?? raw.to_account?.id);
  if (!id || !fromId || !toId) return null;
  if (fromId !== String(input.from_account_id) || toId !== String(input.to_account_id)) return null;

  const fromAccount = isRecord(raw.from_account) ? raw.from_account : {};
  const toAccount = isRecord(raw.to_account) ? raw.to_account : {};
  const currency = [raw.currency_code, fromAccount.currency_code].find((value) => isCurrencyCode(value)) ?? null;
  const amount = amountIn(raw.amount, currency);
  if (!amount || !sameAmount(amount, input.amount)) return null;

  const fee = amountIn(raw.fee_amount, currency);

  return {
    id,
    status: typeof raw.status === "string" && raw.status ? raw.status : null,
    currency,
    amount,
    fee: fee && !/^0+(\.0+)?$/.test(fee) ? fee : null,
    from: { id: fromId, name: textOrNull(fromAccount.name, 150) },
    to: { id: toId, name: textOrNull(toAccount.name, 150) },
    postedAt: typeof raw.posted_at === "string" && raw.posted_at ? raw.posted_at : null,
  };
}
