import { Component, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

import "../i18n/register.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import Skeleton from "../ui/Skeleton.jsx";

/* What the browsers say when a lazily loaded module could not be fetched (offline, a deploy that replaced the file, a blocked request). */
const CHUNK_FAILURE = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk .* failed|Unable to preload CSS/i;
const isChunkFailure = (error) => error?.name === "ChunkLoadError" || CHUNK_FAILURE.test(String(error?.message ?? ""));

function Loading({ standalone }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);

  // The same loading marks every screen uses, so the page area says "loading" the way it always has (and tests wait for it).
  return (
    <section className={standalone ? "sm-root sm-standalone" : "sm-page"} data-sm-screen="loading" data-sm-state="loading" aria-busy="true">
      <Skeleton lines={5} label={t("screenBoundary.loading")} />
    </section>
  );
}

function ChunkFailed({ standalone }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);

  return (
    <section className={standalone ? "sm-root sm-standalone" : "sm-page"} data-sm-screen="chunk-failed" data-sm-state="error">
      <div className="sm-card sm-error" role="alert">
        <h2 className="sm-card-title">{t("screenBoundary.failedTitle")}</h2>
        <p className="sm-text">{t("screenBoundary.failedBody")}</p>
        {/* A module that failed to load is remembered as failed until the page is loaded again, so this is a reload, not a retry of the import. */}
        <button type="button" className="sm-button" onClick={() => globalThis.location?.reload()} data-sm-action="reload-screen">{t("screenBoundary.reload")}</button>
      </div>
    </section>
  );
}

/*
 * Catches only a screen's code failing to download. Every other error is passed on to the app's own error boundary, as
 * before. It is keyed by the address (see ScreenBoundary), so going elsewhere clears it.
 */
class ChunkBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError(error) {
    if (isChunkFailure(error)) return { failed: true };
    throw error;
  }

  render() {
    return this.state.failed ? <ChunkFailed standalone={this.props.standalone} /> : this.props.children;
  }
}

/*
 * Around the part of Mobile that loads on demand. A screen's code is requested the first time its address is shown;
 * until it arrives this shows the loading state in the page area only, so the app bar and the dock stay where they are.
 * If the download fails (typically: offline, on a screen not opened before) it says so and offers a reload; opening
 * another screen works as usual.
 */
export default function ScreenBoundary({ children, standalone = false }) {
  const { pathname } = useLocation();

  return (
    <ChunkBoundary key={pathname} standalone={standalone}>
      <Suspense fallback={<Loading standalone={standalone} />}>{children}</Suspense>
    </ChunkBoundary>
  );
}
