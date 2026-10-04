/*
 * Dirty-state helper shared by the forms that warn before losing edits.
 *
 * Values are compared after normalising, so formatting alone never counts as
 * a change: strings are trimmed, null / undefined / "" are the same "empty",
 * numbers and booleans compare as text, and lists / objects by content.
 */
const normalize = (value) => {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

// `fields` limits the comparison; by default every key of `baseline` is used.
export function isFormDirty(current, baseline, fields = Object.keys(baseline)) {
  return fields.some(
    (field) => normalize(current?.[field]) !== normalize(baseline?.[field]),
  );
}
