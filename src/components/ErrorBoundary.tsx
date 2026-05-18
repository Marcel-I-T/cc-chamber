import React from 'react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ckaude] React error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-bg p-8 text-fg">
          <div className="max-w-2xl rounded-lg border border-err/40 bg-err/5 p-6">
            <h1 className="mb-3 text-[15px] font-semibold text-err">
              ckaude crashed while rendering
            </h1>
            <div className="mb-3 font-mono text-[12px] text-fg">
              {this.state.error.message}
            </div>
            <pre className="max-h-[400px] overflow-auto rounded bg-bg-elevated p-3 font-mono text-[11px] text-fg-muted">
{this.state.error.stack}
            </pre>
            <div className="mt-4 text-[11px] text-fg-subtle">
              Open DevTools (⌥⌘I) for full context. Reload with ⌘R.
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
