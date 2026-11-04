import { VOICE_RECORDING_POLICY as POLICY } from "../../features/Dashboards/User/FinancialOperations/voiceCaptureContract.js";
import { createVoiceRecorder } from "../../features/Dashboards/User/FinancialOperations/voiceRecorder.js";

export const VOICE_RECORDING_POLICY = POLICY;

let testFactory = null;

/*
 * The one place MobileVoiceNew.jsx gets its recorder from — never the full
 * version's module directly — so a test can replace the real microphone/WAV
 * engine with a fake one (jsdom has no Web Audio API to drive it with
 * deterministic timers) without MobileVoiceNew.jsx itself needing a test-only
 * prop. Mirrors data/writeGate.js's setWriteApprovalsForTests(): production
 * code always takes this branch, since testFactory is null outside a test.
 */
export const createMobileVoiceRecorder = () => (testFactory ?? createVoiceRecorder)();

/** Tests only: replace the recorder the next MobileVoiceNew.jsx creates, or `null` to go back to the real one. */
export function setVoiceRecorderForTests(factory) {
  testFactory = factory;
}
