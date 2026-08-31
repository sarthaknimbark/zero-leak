import { AlertCircle, RefreshCw } from 'lucide-react';

interface QueryErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function QueryError({ message, onRetry }: QueryErrorProps) {
  return (
    <div className="card flex flex-col items-center justify-center p-10 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-error-50 text-error-500">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">Couldn't load data</h3>
      <p className="mt-1 max-w-xs text-sm text-slate-500">
        {message || 'Something went wrong. Please try again.'}
      </p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary mt-4">
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      )}
    </div>
  );
}
