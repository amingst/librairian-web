'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Root Layout Error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-100">
          <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg border border-red-100">
            <h1 className="text-3xl font-bold text-red-600 mb-6">Critical Error</h1>
            <p className="text-gray-700 mb-6">
              The application encountered a critical error and cannot continue.
            </p>
            {error.message && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                <p className="text-red-800 text-sm">{error.message}</p>
                {error.digest && (
                  <p className="text-red-600 text-xs mt-2">Error ID: {error.digest}</p>
                )}
              </div>
            )}
            <div className="mt-6">
              <button
                onClick={reset}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Try Reloading
              </button>
              <p className="text-sm text-gray-500 mt-4 text-center">
                If the problem persists, please contact support or try again later.
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
} 