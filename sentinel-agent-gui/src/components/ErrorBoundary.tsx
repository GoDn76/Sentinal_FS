import { Component, ErrorInfo, ReactNode } from 'react';

import { AlertOctagon, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[SentinelFS Agent GUI ErrorBoundary Caught]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-mono">
          <div className="max-w-3xl w-full bg-slate-900 border border-red-500/40 rounded-lg p-6 space-y-4 shadow-2xl shadow-red-950/30">
            <div className="flex items-center space-x-3 text-red-400">
              <AlertOctagon className="w-8 h-8 flex-shrink-0 animate-pulse" />
              <div>
                <h1 className="text-lg font-bold text-red-400">SentinelFS Agent Runtime Error</h1>
                <p className="text-xs text-slate-400 font-sans">
                  An uncaught exception or IPC interface failure occurred. Review stack trace below.
                </p>
              </div>
            </div>

            <div className="bg-slate-950 border border-red-900/50 p-4 rounded text-xs overflow-x-auto space-y-2">
              <div className="text-red-300 font-semibold">
                {this.state.error?.name}: {this.state.error?.message}
              </div>
              {this.state.error?.stack && (
                <pre className="text-slate-400 text-[11px] leading-relaxed whitespace-pre-wrap">
                  {this.state.error.stack}
                </pre>
              )}
              {this.state.errorInfo?.componentStack && (
                <div className="pt-2 border-t border-slate-800 text-slate-500">
                  <span className="text-slate-400 font-semibold">Component Stack:</span>
                  <pre className="text-[10px] whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500 font-sans">
                Tauri Environment: {typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window ? 'Native Desktop' : 'Web Browser'}
              </span>
              <button
                onClick={this.handleReload}
                className="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-4 py-2 rounded flex items-center space-x-2 transition-all shadow-lg shadow-red-600/20"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Application</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
