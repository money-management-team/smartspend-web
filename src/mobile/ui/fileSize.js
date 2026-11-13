const groups = new Map();

function grouping(locale) {
  if (!groups.has(locale)) groups.set(locale, new Intl.NumberFormat(locale, { numberingSystem: "latn", maximumFractionDigits: 1 }));
  return groups.get(locale);
}

/**
 * A file's size in words ("12 bytes", "3.4 KB", "1.2 MB") from the backend's byte count, or null when there is none.
 * `section` is the strings section that holds `size.bytes`, `size.kb` and `size.mb`. Latin digits, like the amounts.
 */
export function fileSizeText(bytes, t, section, locale = "en") {
  if (!Number.isSafeInteger(bytes) || bytes < 0) return null;
  if (bytes < 1024) return t(`${section}.size.bytes`, { n: bytes });
  if (bytes < 1024 * 1024) return t(`${section}.size.kb`, { n: grouping(locale).format(bytes / 1024) });
  return t(`${section}.size.mb`, { n: grouping(locale).format(bytes / (1024 * 1024)) });
}
