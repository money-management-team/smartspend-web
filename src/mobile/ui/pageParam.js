/* A page number read from an address parameter: a whole number from 1 to 500, anything else is page 1. */
export function readPageParam(params, key) {
  const requested = Number.parseInt(params.get(key) ?? "1", 10);
  return Number.isSafeInteger(requested) && requested > 1 && requested <= 500 ? requested : 1;
}

/** The address with one parameter set (or removed when `value` is empty), keeping every other parameter. */
export function withParam(location, key, value, { drop = [] } = {}) {
  const copy = new URLSearchParams(location.search);

  if (value === null || value === undefined || value === "") copy.delete(key);
  else copy.set(key, String(value));
  for (const other of drop) copy.delete(other);

  const search = copy.toString();
  return `${location.pathname}${search ? `?${search}` : ""}`;
}
