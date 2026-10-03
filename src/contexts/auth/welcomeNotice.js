const userId = (value) =>
  /^[1-9]\d{0,14}$/.test(String(value ?? "")) &&
  Number.isSafeInteger(Number(value))
    ? String(value)
    : null;

// In-memory UI notices only. Never retain a token, password or financial data.
export function createWelcomeNotice(user, kind, sequence) {
  const id = userId(user?.id);
  return id &&
    ["login", "register"].includes(kind) &&
    Number.isSafeInteger(sequence) &&
    sequence > 0
    ? { id: sequence, userId: id, kind }
    : null;
}
export function dismissWelcomeNotice(current, id) {
  return current?.id === id ? null : current;
}
export function isWelcomeForUser(notice, user) {
  return Boolean(notice && notice.userId === userId(user?.id));
}
export function welcomeGreeting(timeZone, now = new Date()) {
  let hour;
  try {
    hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "numeric",
        hourCycle: "h23",
      }).format(now),
    );
  } catch {
    hour = now.getHours();
  }
  return hour >= 5 && hour < 12
    ? "morning"
    : hour >= 12 && hour < 18
      ? "afternoon"
      : hour >= 18 && hour < 22
        ? "evening"
        : "night";
}
