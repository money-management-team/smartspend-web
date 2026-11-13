/* The text of a failed download, said in words and never retried by itself. Shared by the export history and an export's own page. */
export const downloadMessageKey = (state) => (state === "failed" ? "exports.downloadFailed" : `exports.download_${state}`);
