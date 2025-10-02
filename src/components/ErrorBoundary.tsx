import { Component, ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console -- surfaced for local debugging
      console.error("ErrorBoundary captured an error", error, info);
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-lg space-y-4">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-slate-200">
            The application encountered an unexpected error. Try refreshing the page. If the issue persists, contact support with any console details displayed.
          </p>
          {this.state.error ? (
            <pre className="w-full overflow-auto rounded-md bg-slate-900 p-4 text-left text-xs text-rose-200">
              {this.state.error.message}
            </pre>
          ) : null}
          <button
            type="button"
            onClick={this.handleReload}
            className="inline-flex items-center justify-center rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-white"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
