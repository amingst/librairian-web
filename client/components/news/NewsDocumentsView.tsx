'use client';

import React, { useState, useEffect } from 'react';
import { DocumentNewsScraperClient } from '@/lib/document-news-client';
import { useNewsDock } from '@/lib/context/NewsDockContext';
import { Document } from '@prisma/client';

interface NewsDocument
	extends Pick<
		Document,
		| 'id'
		| 'title'
		| 'documentUrl'
		| 'summary'
		| 'processingDate'
		| 'documentGroup'
	> {
	source?: {
		site?: string;
		domain?: string;
	};
}

export default function NewsDocumentsView() {
	const [documents, setDocuments] = useState<NewsDocument[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedSources, setSelectedSources] = useState<string[]>([]);
	const [availableSources, setAvailableSources] = useState<
		Array<{ name: string; icon?: string }>
	>([]);

	const { addToQueue: addToNewsDock } = useNewsDock();
	const newsClient = new DocumentNewsScraperClient();

	useEffect(() => {
		loadNewsSources();
	}, []);

	const loadNewsSources = async () => {
		try {
			const sources = await newsClient.getNewsSources();
			setAvailableSources(sources);
		} catch (error) {
			console.error('Error loading news sources:', error);
		}
	};

	const scrapeAndSaveNews = async () => {
		if (selectedSources.length === 0) {
			setError('Please select at least one news source');
			return;
		}

		setLoading(true);
		setError(null);

		try {
			// Get the full source details for selected sources
			const selectedSourceDetails = [];
			for (const sourceName of selectedSources) {
				try {
					const sourceDetail = await newsClient.getNewsSourceDetails(
						sourceName
					);
					selectedSourceDetails.push(sourceDetail);
				} catch (error) {
					console.warn(
						`Failed to get details for source: ${sourceName}`,
						error
					);
				}
			}

			// Scrape articles from selected sources
			const articlesData = await newsClient.scrapeNewsHomepages({
				sources: selectedSourceDetails,
				limit: 10,
				includeMedia: true,
				includeSections: true,
			});

			// Flatten articles from all sources
			const allArticles = Object.values(articlesData).flat();

			// Save articles as documents to database
			const saveResult = await newsClient.saveArticlesAsDocuments(
				allArticles
			);

			console.log(`Saved ${saveResult.created} articles as documents`);

			if (saveResult.errors > 0) {
				console.warn(
					'Some articles had errors:',
					saveResult.errorDetails
				);
			}

			// Refresh the documents list
			await loadDocuments();
		} catch (error) {
			console.error('Error scraping and saving news:', error);
			setError(
				error instanceof Error
					? error.message
					: 'Unknown error occurred'
			);
		} finally {
			setLoading(false);
		}
	};

	const loadDocuments = async () => {
		try {
			const response = await newsClient.getNewsDocuments({
				group: 'news',
				limit: 50,
			});

			// Transform to include source info from the original article JSON
			const documentsWithSources = response.documents.map((doc) => {
				const originalArticle = (doc as any).document; // Access the original article JSON
				return {
					...doc,
					source: originalArticle?.source || null,
				};
			});

			setDocuments(documentsWithSources);
		} catch (error) {
			console.error('Error loading documents:', error);
			setError('Failed to load news documents');
		}
	};

	const addToQueue = (document: NewsDocument) => {
		addToNewsDock({
			id: document.id,
			title: document.title || 'Untitled',
			url: document.documentUrl || '#',
			type: 'article',
			source: {
				name:
					document.source?.site ||
					document.documentGroup ||
					'Unknown Source',
				site:
					document.source?.site ||
					document.documentGroup ||
					'Unknown Source',
				domain:
					document.source?.domain ||
					document.documentGroup ||
					'Unknown Source',
			},
			publishedAt: document.processingDate?.toString(),
			excerpt: document.summary || undefined,
			summary: document.summary || undefined,
		});
	};

	const formatDate = (date: Date | string | null) => {
		if (!date) return 'Unknown date';
		const d = new Date(date);
		return d.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	return (
		<div className='container mx-auto p-6'>
			<div className='mb-6'>
				<h1 className='text-3xl font-bold mb-4'>News Documents</h1>
				<p className='text-gray-600 mb-4'>
					Articles are now stored as Documents in your database,
					unified with your existing document system.
				</p>

				{/* Source Selection */}
				<div className='mb-4'>
					<h2 className='text-lg font-semibold mb-2'>
						Select News Sources:
					</h2>
					<div className='flex flex-wrap gap-2 mb-4'>
						{availableSources.map((source) => (
							<label
								key={source.name}
								className='flex items-center space-x-2'
							>
								<input
									type='checkbox'
									checked={selectedSources.includes(
										source.name
									)}
									onChange={(e) => {
										if (e.target.checked) {
											setSelectedSources([
												...selectedSources,
												source.name,
											]);
										} else {
											setSelectedSources(
												selectedSources.filter(
													(s) => s !== source.name
												)
											);
										}
									}}
								/>
								<span className='text-sm'>{source.name}</span>
								{source.icon && (
									<img
										src={source.icon}
										alt={source.name}
										className='w-4 h-4'
									/>
								)}
							</label>
						))}
					</div>
				</div>

				{/* Actions */}
				<div className='flex gap-4 mb-6'>
					<button
						onClick={scrapeAndSaveNews}
						disabled={loading || selectedSources.length === 0}
						className='bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400'
					>
						{loading ? 'Scraping...' : 'Scrape & Save News'}
					</button>

					<button
						onClick={loadDocuments}
						disabled={loading}
						className='bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-400'
					>
						Refresh Documents
					</button>
				</div>

				{error && (
					<div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4'>
						{error}
					</div>
				)}
			</div>

			{/* Documents Grid */}
			<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
				{documents.map((document) => (
					<div
						key={document.id}
						className='border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow'
					>
						<div className='flex justify-between items-start mb-2'>
							<h3 className='font-semibold text-lg line-clamp-2'>
								{document.title}
							</h3>

							<button
								onClick={() => addToQueue(document)}
								className='ml-2 bg-blue-100 hover:bg-blue-200 text-blue-600 px-2 py-1 rounded text-xs'
								title='Add to document queue'
							>
								+ Queue
							</button>
						</div>

						{document.source && (
							<div className='text-sm text-gray-500 mb-2'>
								Source:{' '}
								{document.source.site || document.source.domain}
							</div>
						)}

						{document.summary && (
							<p className='text-gray-700 text-sm mb-3 line-clamp-3'>
								{document.summary}
							</p>
						)}

						<div className='flex justify-between items-center text-xs text-gray-500'>
							<span>{formatDate(document.processingDate)}</span>
							<span className='bg-gray-100 px-2 py-1 rounded'>
								{document.documentGroup}
							</span>
						</div>

						{document.documentUrl && (
							<div className='mt-3'>
								<a
									href={document.documentUrl}
									target='_blank'
									rel='noopener noreferrer'
									className='text-blue-500 hover:text-blue-700 text-sm'
								>
									View Original →
								</a>
							</div>
						)}
					</div>
				))}
			</div>

			{documents.length === 0 && !loading && (
				<div className='text-center py-12'>
					<p className='text-gray-500 text-lg'>
						No news documents found. Scrape some news sources to get
						started!
					</p>
				</div>
			)}
		</div>
	);
}
