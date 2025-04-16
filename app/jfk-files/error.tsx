'use client';

import { useEffect } from 'react';
import { Button } from '@mui/material';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('JFK Files Error:', error);
  }, [error]);

  return (
    <div className="container mx-auto p-8 flex flex-col items-center justify-center min-h-[50vh]">
      <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong!</h2>
      <p className="text-gray-700 mb-6 text-center max-w-md">
        An error occurred while loading the JFK documents. This might be due to a temporary issue or a problem with your connection.
      </p>
      {error.message && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6 max-w-lg">
          <p className="text-red-800 text-sm font-mono">{error.message}</p>
        </div>
      )}
      <div className="flex space-x-4">
        <Button 
          variant="contained" 
          color="primary" 
          onClick={reset}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Try Again
        </Button>
        <Button 
          variant="outlined" 
          color="secondary" 
          onClick={() => window.location.href = '/'}
        >
          Return Home
        </Button>
      </div>
    </div>
  );
} 