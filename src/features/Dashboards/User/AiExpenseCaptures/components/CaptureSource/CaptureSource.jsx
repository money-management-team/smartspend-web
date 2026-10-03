import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuDownload, LuExternalLink, LuFileText, LuImage, LuRefreshCw } from "react-icons/lu";

import Loading from "../../../../../../components/Loading/Loading";
import { getApiErrorMessage, saveBlobAsFile } from "../../../api/apiClient";
import { aiExpenseCapturesApi } from "../../../api/aiExpenseCapturesApi";
import { isImageSource, isPdfSource, isSourceLinkExpired } from "../../captureHelpers";

import "./CaptureSource.css";

/*
 * The original receipt behind a capture (GET /ai/expense-captures/{id}/source).
 *
 * The file is private and the route is signed, so:
 * - nothing is fetched when the page opens. The user asks for the preview,
 *   and Download is always an explicit action — a details page never pulls a
 *   potentially large file by itself.
 * - the signed URL stays in props for the lifetime of this component and is
 *   never stored, logged or written anywhere.
 * - what the backend streamed (`Content-Type`) decides how it is shown; the
 *   bytes are only ever treated as binary media, never as markup.
 *
 * The caller keys this component by the signed URL, so a refreshed link
 * remounts it: the previous blob is revoked by the unmount cleanup and no
 * state survives from the link it belonged to.
 */
export default function CaptureSource({ sourceUrl, onRefreshLink, isRefreshing = false }) {
  const { t } = useTranslation();

  // { blob, filename, contentType } once loaded.
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /*
   * Every object URL this component creates, revoked when it is replaced and
   * again on unmount, so none is leaked and none outlives the page.
   */
  const previewUrlRef = useRef("");

  const releasePreview = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
  };

  useEffect(() => releasePreview, []);

  const load = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const loaded = await aiExpenseCapturesApi.downloadSource(sourceUrl);

      setFile(loaded);

      if (isImageSource(loaded.contentType) || isPdfSource(loaded.contentType)) {
        releasePreview();
        const url = URL.createObjectURL(loaded.blob);
        previewUrlRef.current = url;
        setPreviewUrl(url);
      }
    } catch (requestError) {
      // 401 is the global session-expired flow; nothing to show here.
      if (requestError?.code !== "UNAUTHENTICATED") setError(requestError);
    } finally {
      setIsLoading(false);
    }
  };

  const download = () => {
    if (!file) return;
    // The backend's own filename first; `apiDownload` read it from
    // Content-Disposition. A generic name is used only when it sent none.
    saveBlobAsFile(file.blob, file.filename || t("dashboard.aiCaptures.source.fallbackName"));
  };

  const isImage = file && isImageSource(file.contentType);
  const isPdf = file && isPdfSource(file.contentType);
  const isExpired = isSourceLinkExpired(error);

  return (
    <section className="capture-source" aria-labelledby="capture-source-title">
      <header className="capture-source__header">
        <h2 id="capture-source-title">
          <LuImage aria-hidden="true" />
          {t("dashboard.aiCaptures.source.title")}
        </h2>
        <p>{t("dashboard.aiCaptures.source.description")}</p>
      </header>

      <div className="capture-source__body">
        {isLoading && <Loading message={t("dashboard.aiCaptures.source.loading")} />}

        {!isLoading && error && (
          <div className="capture-source__error" role="alert">
            <p dir="auto">
              {isExpired
                ? t("dashboard.aiCaptures.source.expired")
                : error.code === "NOT_FOUND"
                  ? t("dashboard.aiCaptures.source.notFound")
                  : getApiErrorMessage(error, t)}
            </p>

            {/*
             * An expired signature can't be re-signed here: only a fresh
             * capture fetch brings a newly signed URL.
             */}
            {isExpired && onRefreshLink ? (
              <button type="button" onClick={onRefreshLink} disabled={isRefreshing}>
                <LuRefreshCw aria-hidden="true" />
                {t("dashboard.aiCaptures.source.refreshLink")}
              </button>
            ) : (
              error.code !== "NOT_FOUND" && (
                <button type="button" onClick={load}>{t("common.retry")}</button>
              )
            )}
          </div>
        )}

        {!isLoading && !error && !file && (
          <button type="button" className="capture-source__load" onClick={load}>
            <LuImage aria-hidden="true" />
            {t("dashboard.aiCaptures.source.loadPreview")}
          </button>
        )}

        {!isLoading && !error && file && (
          <>
            {isImage && previewUrl && (
              <img
                className="capture-source__image"
                src={previewUrl}
                alt={t("dashboard.aiCaptures.source.imageAlt")}
              />
            )}

            {isPdf && previewUrl && (
              <object
                className="capture-source__pdf"
                data={previewUrl}
                type="application/pdf"
                aria-label={t("dashboard.aiCaptures.source.pdfLabel")}
              >
                {/* Shown when the browser has no inline PDF viewer. */}
                <p className="capture-source__fallback">
                  {t("dashboard.aiCaptures.source.pdfFallback")}
                </p>
              </object>
            )}

            {!isImage && !isPdf && (
              <p className="capture-source__fallback">
                {t("dashboard.aiCaptures.source.notPreviewable")}
              </p>
            )}

            <div className="capture-source__actions">
              <button type="button" className="capture-source__download" onClick={download}>
                <LuDownload aria-hidden="true" />
                {t("dashboard.aiCaptures.source.download")}
              </button>

              {isPdf && previewUrl && (
                <a
                  className="capture-source__open"
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <LuExternalLink aria-hidden="true" />
                  {t("dashboard.aiCaptures.source.openPdf")}
                </a>
              )}

              {file.filename && (
                <span className="capture-source__filename">
                  <LuFileText aria-hidden="true" />
                  <bdi dir="auto">{file.filename}</bdi>
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
