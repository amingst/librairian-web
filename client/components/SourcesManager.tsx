'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckSquare, Square, Eye, EyeOff } from 'lucide-react';
import {
	useNewsSources,
	useSourceCategories,
} from '@/lib/context/NewsSourceContext';

interface SourcesManagerProps {
	className?: string;
}

export function getNewsSourceIcon(url: string, size: number = 32): string {
	const domain = new URL(url).hostname.replace('www.', '');
	return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}

export function SourcesManager({ className }: SourcesManagerProps) {
	const {
		sources,
		isLoading,
		error,
		refreshSources,
		toggleSource,
		enableAllSources,
		disableAllSources,
		isSourceEnabled,
		getEnabledCount,
		getTotalCount,
		resetToDefaults,
	} = useNewsSources();

	const { categories, getCategoryStats, enableCategory, disableCategory } =
		useSourceCategories();

	if (error) {
		return (
			<div className={`border rounded-lg p-6 ${className}`}>
				<div className='text-center space-y-4'>
					<div className='flex items-center justify-center gap-2 text-red-500'>
						<EyeOff className='h-5 w-5' />
						<h3 className='text-lg font-semibold'>
							Error Loading Sources
						</h3>
					</div>
					<p className='text-sm text-gray-600'>{error}</p>
					<Button onClick={refreshSources} variant='outline'>
						<RefreshCw className='h-4 w-4 mr-2' />
						Retry
					</Button>
				</div>
			</div>
		);
	}

	const enabledCount = getEnabledCount();
	const totalCount = getTotalCount();

	return (
		<div className={`border rounded-lg p-6 space-y-6 ${className}`}>
			{/* Header */}
			<div className='space-y-4'>
				<div className='flex items-center justify-between'>
					<div>
						<h2 className='text-xl font-semibold flex items-center gap-2'>
							<Eye className='h-5 w-5' />
							News Sources
						</h2>
						<p className='text-sm text-gray-600'>
							Manage which news sources to include in scraping
						</p>
					</div>
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
						Refresh
					</Button>
				</div>

				<div className='flex items-center justify-between'>
					<div className='px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-sm'>
						{enabledCount} of {totalCount} enabled
					</div>
					<div className='flex gap-2'>
						<Button
							onClick={enableAllSources}
							variant='outline'
							size='sm'
						>
							<CheckSquare className='h-4 w-4 mr-1' />
							All
						</Button>
						<Button
							onClick={disableAllSources}
							variant='outline'
							size='sm'
						>
							<Square className='h-4 w-4 mr-1' />
							None
						</Button>
						<Button
							onClick={resetToDefaults}
							variant='outline'
							size='sm'
						>
							Reset
						</Button>
					</div>
				</div>
			</div>

			{/* Content */}
			{isLoading ? (
				<div className='flex items-center justify-center py-8'>
					<RefreshCw className='h-6 w-6 animate-spin' />
					<span className='ml-2'>Loading sources...</span>
				</div>
			) : (
				<div className='space-y-6'>
					{categories.map((category) => {
						const stats = getCategoryStats(category);
						const categorySources = sources.filter(
							(s) => s.category === category
						);

						return (
							<div key={category} className='space-y-3'>
								<div className='flex items-center justify-between'>
									<div className='flex items-center gap-2'>
										<h3 className='font-semibold capitalize'>
											{category}
										</h3>
										<span className='px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs'>
											{stats.enabled}/{stats.total}
										</span>
									</div>
									<div className='flex gap-2'>
										<Button
											onClick={() =>
												enableCategory(category)
											}
											disabled={stats.allEnabled}
											variant='outline'
											size='sm'
										>
											<CheckSquare className='h-3 w-3 mr-1' />
											All
										</Button>
										<Button
											onClick={() =>
												disableCategory(category)
											}
											disabled={stats.noneEnabled}
											variant='outline'
											size='sm'
										>
											<Square className='h-3 w-3 mr-1' />
											None
										</Button>
									</div>
								</div>

								<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'>
									{categorySources.map((source) => (
										<div
											key={source.id}
											className={`
												flex items-center justify-between p-3 border rounded-lg 
												hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
												${
													isSourceEnabled(source.id)
														? 'border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800'
														: ''
												}
											`}
										>
											<div className='flex-1 min-w-0'>
												<div className='flex items-center gap-2'>
													<img
														src={source.icon}
														alt={`${source.name} favicon`}
														className='w-4 h-4'
													/>
													<input
														type='checkbox'
														checked={isSourceEnabled(
															source.id
														)}
														onChange={() =>
															toggleSource(
																source.id
															)
														}
														id={source.id}
														className='h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
													/>
													<label
														htmlFor={source.id}
														className='text-sm font-medium cursor-pointer'
													>
														{source.name}
													</label>
												</div>
												<p className='text-xs text-gray-500 mt-1'>
													ID: {source.id}
												</p>
											</div>
										</div>
									))}
								</div>

								{category !==
									categories[categories.length - 1] && (
									<hr className='my-4 border-gray-200 dark:border-gray-700' />
								)}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

// Quick selector component for enabled sources
export function SourcesQuickSelector({ className }: { className?: string }) {
	const { getEnabledSources, isLoading, error } = useNewsSources();

	if (isLoading || error) {
		return null;
	}

	const enabledSources = getEnabledSources();

	if (enabledSources.length === 0) {
		return (
			<div className={`text-sm text-gray-500 ${className}`}>
				No sources selected for scraping
			</div>
		);
	}

	return (
		<div className={`space-y-2 ${className}`}>
			<div className='text-sm font-medium'>
				Selected Sources ({enabledSources.length}):
			</div>
			<div className='flex flex-wrap gap-1'>
				{enabledSources.map((source) => (
					<span
						key={source.id}
						className='px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs'
					>
						{source.name}
					</span>
				))}
			</div>
		</div>
	);
}
