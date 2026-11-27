import StateChip from "../ui/StateChip.jsx";

const STAGE_TONES = { pending: "warn", processing: "warn", ready: "good", unavailable: "neutral", failed: "bad" };
const STATUS_TONES = { expired: "neutral", cancelled: "neutral" };

/*
 * Where an export stands as one chip: waiting to start, being built, ready to download, failed, or (for the two
 * endings) expired or cancelled. "Ready" is only said when the backend's own `download_available` flag says there is
 * a file; a completed export without it reads "File no longer available". A status Mobile does not know is shown as sent.
 */
export default function ExportStageChip({ item }) {
  if (!item.statusKnown || !item.stage) return <StateChip state={item.status} known={false} labels="exports.status" />;
  if (item.stage === "ended") return <StateChip state={item.status} known labels="exports.status" tones={STATUS_TONES} />;

  return <StateChip state={item.stage} known labels="exportView.stage" tones={STAGE_TONES} />;
}
