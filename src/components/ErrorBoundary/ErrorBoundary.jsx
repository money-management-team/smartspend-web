import { Component } from "react";
import { useTranslation } from "react-i18next";

import "./ErrorBoundary.css";

/*
 * Catches errors thrown while React renders (a broken component, a lazy chunk
 * that failed to load). It is NOT for API errors: those are caught by the
 * pages and shown with getApiErrorMessage.
 *
 * `variant="app"` replaces the whole screen and offers reload / home;
 * `variant="page"` replaces only the page area, so the dashboard sidebar and
 * header stay usable. The boundary resets itself when `resetKey` changes
 * (the route), so moving to another page clears an error.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(previous) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error, info) {
    // Technical details go to the console for developers, never to the UI.
    console.error("Unexpected render error:", error, info?.componentStack);
  }

  retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <ErrorFallback
        error={error}
        variant={this.props.variant ?? "page"}
        homePath={this.props.homePath ?? "/"}
        onRetry={this.retry}
      />
    );
  }
}

function ErrorFallback({ error, variant, homePath, onRetry }) {
  const { t } = useTranslation();

  return (
    <div
      className={`error-boundary error-boundary--${variant}`}
      role="alert"
    >
      <div className="error-boundary__card">
        <span className="error-boundary__icon" aria-hidden="true">
          !
        </span>

        <h1 className="error-boundary__title">{t("common.errorBoundary.title")}</h1>
        <p className="error-boundary__text">
          {t("common.errorBoundary.description")}
        </p>

        {import.meta.env.DEV && (
          <pre className="error-boundary__details" dir="ltr">
            {String(error?.message ?? error)}
          </pre>
        )}

        <div className="error-boundary__actions">
          <button
            type="button"
            className="error-boundary__button error-boundary__button--primary"
            onClick={onRetry}
          >
            {t("common.retry")}
          </button>
          <button
            type="button"
            className="error-boundary__button"
            onClick={() => window.location.reload()}
          >
            {t("common.errorBoundary.reload")}
          </button>
          {/* A full navigation: the React tree may be in a bad state. */}
          <a className="error-boundary__button" href={homePath}>
            {t(
              variant === "app"
                ? "common.errorBoundary.home"
                : "common.errorBoundary.dashboard",
            )}
          </a>
        </div>
      </div>
    </div>
  );
}
