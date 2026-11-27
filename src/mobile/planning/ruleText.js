/** "Monthly", or "Monthly · repeats every 2" when the rule's interval is more than one. Words only: no date is worked out. */
export function cadenceText(rule, t) {
  if (!rule.frequency) return null;

  const label = rule.frequencyKnown ? t(`planning.recurring.frequency.${rule.frequency}`) : rule.frequency.replace(/_/g, " ");
  return rule.interval && rule.interval > 1 ? t("planning.recurring.cadenceEvery", { label, interval: rule.interval }) : label;
}

export function typeText(rule, t) {
  if (!rule.type) return null;
  return rule.typeKnown ? t(`planning.recurring.type.${rule.type}`) : rule.type.replace(/_/g, " ");
}
