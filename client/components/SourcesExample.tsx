'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckSquare, Square, Eye, Settings } from 'lucide-react';
import {
	useNewsSources,
	useSourceCategories,
} from '@/lib/context/NewsSourceContext';
import { SourcesManager, SourcesQuickSelector } from './SourcesManager';

export function SourcesExample() {
	const {
		sources,
		isLoading,
		error,
		refreshSources,
		getEnabledSources,
		getEnabledSourceIds,
		getEnabledCount,
		getTotalCount,
		enableAllSources,
		disableAllSources,
		resetToDefaults,
	} = useNewsSources();

	const { categories, getCategoryStats } = useSourceCategories();

	const enabledSources = getEnabledSources();
	const enabledSourceIds = getEnabledSourceIds();
	const enabledCount = getEnabledCount();
	const totalCount = getTotalCount();

	return (
		<div className='space-y-8 max-w-6xl mx-auto p-6'>
			<div className='text-center space-y-2'>
				<h1 className='text-3xl font-bold flex items-center justify-center gap-2'>
					<Settings className='h-8 w-8' />
					News Sources Manager
				</h1>
				<p className='text-gray-600'>
					Example component demonstrating the NewsSourcesContext
				</p>
			</div>

			{/* Context Status */}
			<div className='border rounded-lg p-6 space-y-4'>
				<h2 className='text-xl font-semibold flex items-center gap-2'>
					<Eye className='h-5 w-5' />
					Context Status
				</h2>

				<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
					<div className='bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4'>
						<div className='text-2xl font-bold text-blue-600 dark:text-blue-400'>
							{totalCount}
						</div>
						<div className='text-sm text-blue-600 dark:text-blue-400'>
							Total Sources
						</div>
					</div>

					<div className='bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4'>
						<div className='text-2xl font-bold text-green-600 dark:text-green-400'>
							{enabledCount}
						</div>
						<div className='text-sm text-green-600 dark:text-green-400'>
							Enabled Sources
						</div>
					</div>

					<div className='bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-4'>
						<div className='text-2xl font-bold text-purple-600 dark:text-purple-400'>
							{categories.length}
						</div>
						<div className='text-sm text-purple-600 dark:text-purple-400'>
							Categories
						</div>
					</div>

					<div
						className={`${
							isLoading
								? 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800'
								: error
								? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
								: 'bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800'
						} border rounded-lg p-4`}
					>
						<div
							className={`text-2xl font-bold ${
								isLoading
									? 'text-yellow-600 dark:text-yellow-400'
									: error
									? 'text-red-600 dark:text-red-400'
									: 'text-gray-600 dark:text-gray-400'
							}`}
						>
							{isLoading ? '⏳' : error ? '❌' : '✅'}
						</div>
						<div
							className={`text-sm ${
								isLoading
									? 'text-yellow-600 dark:text-yellow-400'
									: error
									? 'text-red-600 dark:text-red-400'
									: 'text-gray-600 dark:text-gray-400'
							}`}
						>
							{isLoading
								? 'Loading...'
								: error
								? 'Error'
								: 'Ready'}
						</div>
					</div>
				</div>

				<div className='flex gap-2'>
					<Button
						onClick={refreshSources}
						disabled={isLoading}
						variant='outline'
						size='sm'
					>
						<RefreshCw
							className={`h-4 w-4 mr-2 ${
								isLoading ? 'animate-spin' : ''
							}`}
						/>
						Refresh Sources
					</Button>
					<Button
						onClick={enableAllSources}
						variant='outline'
						size='sm'
					>
						<CheckSquare className='h-4 w-4 mr-2' />
						Enable All
					</Button>
					<Button
						onClick={disableAllSources}
						variant='outline'
						size='sm'
					>
						<Square className='h-4 w-4 mr-2' />
						Disable All
					</Button>
					<Button
						onClick={resetToDefaults}
						variant='outline'
						size='sm'
					>
						Reset to Defaults
					</Button>
				</div>
			</div>

			{/* Category Overview */}
			{categories.length > 0 && (
				<div className='border rounded-lg p-6 space-y-4'>
					<h2 className='text-xl font-semibold'>Category Overview</h2>

					<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
						{categories.map((category) => {
							const stats = getCategoryStats(category);
							const percentage =
								stats.total > 0
									? Math.round(
											(stats.enabled / stats.total) * 100
									  )
									: 0;

							return (
								<div
									key={category}
									className='border rounded-lg p-4'
								>
									<div className='flex justify-between items-center mb-2'>
										<h3 className='font-semibold capitalize'>
											{category}
										</h3>
										<span className='text-sm text-gray-500'>
											{percentage}%
										</span>
									</div>

									<div className='w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2'>
										<div
											className='bg-blue-600 h-2 rounded-full transition-all'
											style={{ width: `${percentage}%` }}
										/>
									</div>

									<div className='text-sm text-gray-600'>
										{stats.enabled} of {stats.total} enabled
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* Quick Selector Demo */}
			<div className='border rounded-lg p-6 space-y-4'>
				<h2 className='text-xl font-semibold'>
					Selected Sources (for scraping)
				</h2>
				<SourcesQuickSelector />

				{enabledSources.length > 0 && (
					<div className='bg-gray-50 dark:bg-gray-900 rounded-lg p-4'>
						<h3 className='font-medium mb-2'>
							Example: How to use enabled sources in your code
						</h3>
						<pre className='text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto'>
							{`// Get enabled sources
const enabledSources = getEnabledSources();
const enabledSourceIds = getEnabledSourceIds();

// Use in your scraping logic
console.log('Sources to scrape:', enabledSources);
console.log('Source IDs:', enabledSourceIds);

// Example scraping call (you would implement this)
// await scrapeNews({ sources: enabledSources });`}
						</pre>
					</div>
				)}
			</div>

			{/* Full Sources Manager */}
			<SourcesManager />

			{/* Debug Info */}
			{process.env.NODE_ENV === 'development' && (
				<details className='border rounded-lg p-4'>
					<summary className='cursor-pointer font-medium'>
						Debug Information (Development Only)
					</summary>
					<div className='mt-4 space-y-2'>
						<div className='bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs'>
							<strong>Enabled Source IDs:</strong>
							<pre>
								{JSON.stringify(enabledSourceIds, null, 2)}
							</pre>
						</div>
						<div className='bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs'>
							<strong>All Sources:</strong>
							<pre>
								{JSON.stringify(
									sources.map((s) => ({
										id: s.id,
										name: s.name,
										category: s.category,
									})),
									null,
									2
								)}
							</pre>
						</div>
					</div>
				</details>
			)}
		</div>
	);
}
