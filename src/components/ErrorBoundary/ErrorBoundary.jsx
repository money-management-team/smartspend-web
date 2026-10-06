import { Component } from "react";

import ErrorFallback from "./ErrorFallback";

/*
 * Catches unexpected rendering / lifecycle errors below it (a bug, a failed
 * lazy-chunk download) and shows ErrorFallback instead of a blank page.
 * Expected failures (API errors, validation) are not handled here: pages show
 * those as their own states.
 *
 * `resetKey` clears the error when it changes, so a route-level boundary
 * recovers as soon as the user navigates somewhere else. `variant="page"`
 * renders inside a layout; "app" fills the screen.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Technical details are for developers only; users see the fallback.
    if (import.meta.env.DEV) {
      console.error("Unexpected UI error:", error, info.componentStack);
    }
  }

  componentDidUpdate(previousProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.reset();
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <ErrorFallback
        variant={this.props.variant ?? "app"}
        onRetry={this.reset}
      />
    );
  }
}
