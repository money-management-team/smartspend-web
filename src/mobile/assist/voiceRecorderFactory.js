import { VOICE_RECORDING_POLICY as POLICY } from "../../features/Dashboards/User/FinancialOperations/voiceCaptureContract.js";
import { createVoiceRecorder } from "../../features/Dashboards/User/FinancialOperations/voiceRecorder.js";

export const VOICE_RECORDING_POLICY = POLICY;

// `import.meta.env.MODE` is a literal in every Vite build; only the test runner reports "test" (see data/writeGate.js).
const TESTING = import.meta.env.MODE === "test";
let testFactory = null;

/*
 * The one place MobileVoiceNew.jsx gets its recorder from — never the full
 * version's module directly — so a test can replace the real microphone/WAV
 * engine with a fake one (jsdom has no Web Audio API to drive it with
 * deterministic timers) without MobileVoiceNew.jsx itself needing a test-only
 * prop. Mirrors data/writeGate.js's setWriteApprovalsForTests(): production
 * code always takes this branch, since testFactory is null outside a test.
 */
export const createMobileVoiceRecorder = () => (TESTING && testFactory ? testFactory : createVoiceRecorder)();

/** Tests only: replace the recorder the next MobileVoiceNew.jsx creates, or `null` to go back to the real one. */
export function setVoiceRecorderForTests(factory) {
  if (!TESTING) throw new Error("SMARTSPEND_TEST_ONLY_VOICE_RECORDER: the recorder can only be replaced by the test runner.");
  testFactory = factory;
}
