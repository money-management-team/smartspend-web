/*
 * Which of Mobile's own messages describes a failed read. Only the error's
 * code is used, never the backend's message text: a read failure is reported
 * in a fixed, translated sentence, with the next step.
 *
 * `online` is navigator.onLine, so a request that failed while the device
 * reports no connection is described as "offline" and not as a server fault.
 */
export function errorKind(error, online = true) {
  switch (error?.code) {
    case "UNAUTHENTICATED":
      return "session";
    case "FORBIDDEN":
      return "forbidden";
    case "NOT_FOUND":
      return "notFound";
    case "WORKSPACE_UNAVAILABLE":
      return "workspace";
    case "RATE_LIMITED":
      return "rate";
    case "TIMEOUT":
      return online ? "timeout" : "offline";
    case "NETWORK_ERROR":
      return online ? "network" : "offline";
    case "MALFORMED_RESPONSE":
      return "malformed";
    case "SERVER_ERROR":
      return "server";
    default:
      return online ? "generic" : "offline";
  }
}

// A second try can help for these; for the rest the next step is different (sign in again, go back).
export const isRetryable = (kind) => !["session", "forbidden", "notFound"].includes(kind);
