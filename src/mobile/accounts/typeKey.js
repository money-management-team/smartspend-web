const KNOWN_TYPES = ["cash", "bank", "wallet", "savings", "savings_goal", "custom", "income", "expense", "transfer", "fee", "refund", "adjustment", "reversal"];

// Account types and transaction types share one label table (types.*); anything else is "other".
export const typeKey = (type) => (KNOWN_TYPES.includes(type) ? type : "other");
