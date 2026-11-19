import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message || 'An unexpected error occurred.';
    try {
      const parsed = JSON.parse(readable) as { error?: string; operationType?: string; path?: string };
      if (parsed.error) {
        readable = `${parsed.error} (${parsed.operationType || 'operation'} on ${parsed.path || 'database'})`;
      }
    } catch {
      // keep string message
    }
    return { hasError: true, message: readable };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF7F2] text-[#443C35] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-[#E5DDD0] rounded-2xl p-8 text-center shadow-sm">
            <p className="text-xs tracking-[0.2em] uppercase text-[#737C68] mb-3">WEDLINK Studio</p>
            <h1 className="font-cormorant text-3xl font-semibold text-[#443C35] mb-3">
              Something needs your attention
            </h1>
            <p className="text-sm text-[#443C35]/75 mb-6 leading-relaxed break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.href = '/';
              }}
              className="px-6 py-2.5 bg-[#443C35] text-white text-sm font-medium rounded-lg hover:bg-[#5A5047] transition-colors"
            >
              Return Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
