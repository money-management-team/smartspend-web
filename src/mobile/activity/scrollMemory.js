/*
 * Where the list was scrolled to when the person opened a transaction, so Back
 * lands in the same place. Memory only, one number per set of filters, no
 * financial data: a scroll offset.
 */
const offsets = new Map();

export const rememberScroll = (signature, top) => {
  if (Number.isFinite(top) && top > 0) offsets.set(signature, Math.round(top));
  else offsets.delete(signature);
};

export const recallScroll = (signature) => offsets.get(signature) ?? 0;
