import { Component, type ReactNode } from 'react';

/** If a screen crashes, show a plain message instead of a blank page, and report it (without anything the user typed). */
export class ErrorBoundary extends Component<{ screen: string; onCrash(message: string, screen: string): void; children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  componentDidCatch(error: Error) { try { this.props.onCrash(String(error?.message ?? error).slice(0, 200), this.props.screen); } catch { /* never throw from here */ } }
  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <section role="alert" className="error-banner">
        <p>Something broke on this screen. Your saved laptops are safe. Please reload the page and try again.</p>
        <button className="btn small" onClick={() => window.location.reload()}>Reload</button>
      </section>
    );
  }
}
