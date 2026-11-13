import { useRef, useState } from "react";

import { readExportFile } from "../data/readApi.js";
import { useIdentityGuard } from "../identity/guardContext.js";

// The full version's built name when the server sends none (docs/report-exports/download.md): smartspend-{report}-{id}.{format}, csv for an unknown format.
const exportFileName = (item) => `smartspend-${item.report ?? "report"}-${item.id}.${["csv", "xlsx", "pdf"].includes(item.format) ? item.format : "csv"}`;

/*
 * The name a downloaded file is saved under: the server's, made safe (no folder
 * part, no control or reserved characters, no leading dots, at most 120
 * characters), or the built name above when nothing usable is left.
 */
const safeFileName = (name, item) => {
  const base = String(name ?? "").split(/[\\/]/).pop() ?? "";
  const clean = [...base].filter((char) => char.charCodeAt(0) >= 32 && !'<>:"|?*'.includes(char)).join("").replace(/^[.\s]+/, "").trim().slice(0, 120);
  return clean || exportFileName(item);
};

// A failed download in words: refused (403), gone or expired (404, 410), or another failure. Nothing is retried by itself.
const downloadFailure = (error) => (error?.status === 403 ? "denied" : error?.status === 404 || error?.status === 410 ? "gone" : "failed");

/*
 * Saves a file the browser already holds. A link with `download` is the most
 * widely supported way; some phone browsers open the file instead of saving it,
 * which is their choice (real-device behaviour is not verified).
 */
const { createObjectURL, revokeObjectURL } = URL;

// `link` is a hidden link the screen renders, so nothing is added to the page outside the Mobile root.
function saveFile(link, blob, name) {
  if (!link) return;
  const url = createObjectURL(blob);
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => revokeObjectURL(url), 60_000);
}

/*
 * Downloading an export's file (GET /report-exports/{id}/download), shared by the history and an export's own page.
 * The screens offer it only for an export the backend says is downloadable (`download_available`); this hook is the
 * one place that fetches the file. It returns the state of each export's download (busy, saved, denied, gone, failed),
 * the function that starts one, and the hidden link the screen must render once (`anchor`).
 */
export default function useExportDownload() {
  const guard = useIdentityGuard();
  const [states, setStates] = useState({});
  const running = useRef(new Set());
  const linkRef = useRef(null);

  const download = async (item) => {
    if (running.current.has(item.id)) return;
    running.current.add(item.id);
    setStates((current) => ({ ...current, [item.id]: "busy" }));
    try {
      guard.assert();
      const file = await readExportFile(item.id);
      // A file that arrives after the signed-in person changed is not saved here.
      if (!guard.check()) return;
      saveFile(linkRef.current, file.blob, safeFileName(file.filename ?? item.fileName, item));
      setStates((current) => ({ ...current, [item.id]: "saved" }));
    } catch (error) {
      if (guard.check()) setStates((current) => ({ ...current, [item.id]: downloadFailure(error) }));
    } finally {
      running.current.delete(item.id);
    }
  };

  return { states, download, anchor: <a ref={linkRef} hidden aria-hidden="true" tabIndex={-1} rel="noopener" /> };
}
