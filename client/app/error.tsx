'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		// Log the error to an error reporting service
		console.error('Application Error:', error);
	}, [error]);

	return (
		<div className='min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50'>
			<div className='max-w-md w-full bg-white p-8 rounded-lg shadow-md'>
				<h2 className='text-2xl font-bold text-red-600 mb-4'>
					Application Error
				</h2>
				<p className='text-gray-700 mb-6'>
					Something went wrong in the application. We've been notified
					and are working to fix the issue.
				</p>
				{error.message && (
					<div className='bg-red-50 border border-red-200 rounded-md p-4 mb-6'>
						<p className='text-red-800 text-sm font-mono break-words'>
							{error.message}
						</p>
						{error.digest && (
							<p className='text-red-600 text-xs mt-2'>
								Error ID: {error.digest}
							</p>
						)}
					</div>
				)}
				<div className='flex space-x-4'>
					<button
						onClick={reset}
						className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
					>
						Try Again
					</button>
					<Link
						href='/'
						className='px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 transition-colors'
					>
						Return Home
					</Link>
				</div>
			</div>
		</div>
	);
}
