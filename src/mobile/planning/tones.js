// Colour is a hint, never the message: every chip says its state in words. Nothing here is green: it is not a ledger "posted".
export const TONES = {
  safe: "calm",
  warning: "warn",
  near_limit: "warn",
  exceeded: "bad",
  active: "calm",
  in_progress: "calm",
  almost_there: "calm",
  achieved: "calm",
  not_started: "neutral",
  paused: "neutral",
  completed: "neutral",
  archived: "neutral",
};

export const toneOf = (state, known) => (known ? TONES[state] ?? "neutral" : "neutral");
