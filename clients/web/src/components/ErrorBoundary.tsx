import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '32px' }}>
          <div style={{ maxWidth: '520px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '20px', marginBottom: '8px' }}>Something went wrong</h1>
            <p style={{ opacity: 0.75, marginBottom: '16px' }}>
              Refresh the page to try again. If the issue persists, check the console for details.
            </p>
            {this.state.error?.message && (
              <pre style={{ textAlign: 'left', background: '#111114', padding: '12px', borderRadius: '8px', overflowX: 'auto' }}>
                {this.state.error.message}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
