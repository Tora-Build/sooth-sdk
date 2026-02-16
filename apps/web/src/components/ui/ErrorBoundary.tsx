import { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { logger } from '../../lib/logger';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Fallback UI to render on error. If not provided, a default is used. */
  fallback?: ReactNode;
  /** Optional callback when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Context label for logging (e.g., "Pro Trading", "Portfolio") */
  context?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary for graceful error handling
 * 
 * Catches JavaScript errors in child components and displays
 * a fallback UI instead of crashing the whole app.
 * 
 * @example
 * <ErrorBoundary context="Trading Panel">
 *   <TradingPanel />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const { context = 'Unknown', onError } = this.props;
    
    // Log to our production-safe logger
    logger.ui.error(`[ErrorBoundary:${context}] Caught error:`, error.message);
    logger.ui.error(`[ErrorBoundary:${context}] Stack:`, errorInfo.componentStack);
    
    // Call optional callback
    onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, context } = this.props;

    if (hasError) {
      // Custom fallback provided
      if (fallback) {
        return fallback;
      }

      // Default fallback UI
      return (
        <div className="flex flex-col items-center justify-center p-8 min-h-[200px] bg-dark-card/50 rounded-xl border border-red-500/20">
          <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            Something went wrong
          </h3>
          <p className="text-sm text-dark-text-secondary text-center mb-4 max-w-md">
            {context ? `Error in ${context}. ` : ''}
            {error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-4 py-2 bg-accent-blue/20 hover:bg-accent-blue/30 text-accent-blue rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      );
    }

    return children;
  }
}

/**
 * Wrapper for async component loading errors
 * Used with React.lazy() and Suspense
 */
export function AsyncErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 min-h-[200px]">
      <AlertTriangle className="w-10 h-10 text-red-400 mb-3" />
      <h3 className="text-base font-medium text-white mb-2">Failed to load</h3>
      <p className="text-sm text-dark-text-secondary text-center mb-4">
        {error.message || 'Could not load this section.'}
      </p>
      <button
        onClick={resetError}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-dark-card hover:bg-dark-border text-white rounded-lg transition-colors"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Retry
      </button>
    </div>
  );
}

export default ErrorBoundary;
