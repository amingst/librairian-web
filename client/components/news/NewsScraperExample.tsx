'use client';

import React, { useEffect, useState } from 'react';
import {
	useMCPClient,
	useSelectedSources,
} from '../../hooks/news/use-mcp-client';
import { TextAnalysisMCPClient } from '@/lib/text-analysis-client';
import type { Document } from '@prisma/client';
import type { NewsArticlePreview } from '@shared/types';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { ScrollArea } from '../ui/scroll-area';
import {
	AlertCircleIcon,
	PlusIcon,
	DatabaseIcon,
	CheckIcon,
} from 'lucide-react';
import { useNewsDock } from '@/lib/context/NewsDockContext';

// Component for displaying source icon with fallback
const SourceIcon = ({
	source,
	isSelected,
}: {
	source: any;
	isSelected: boolean;
}) => {
	const [iconError, setIconError] = useState(false);
	const [iconLoading, setIconLoading] = useState(!!source.icon);

	if (source.icon && !iconError) {
		return (
			<div className='relative w-5 h-5'>
				{iconLoading && (
					<div className='absolute inset-0 animate-pulse bg-gray-200 rounded'></div>
				)}
				<img
					src={source.icon}
					alt={`${source.name} icon`}
					className={`w-5 h-5 rounded transition-opacity ${
						isSelected ? 'opacity-100' : 'opacity-60'
					} ${iconLoading ? 'opacity-0' : 'opacity-100'}`}
					onError={() => {
						setIconError(true);
						setIconLoading(false);
					}}
					onLoad={() => setIconLoading(false)}
				/>
			</div>
		);
	}

	// Fallback to CheckIcon for selected, PlusIcon for unselected
	return isSelected ? (
		<CheckIcon className='w-5 h-5 text-green-600' />
	) : (
		<PlusIcon className='w-5 h-5 text-gray-400' />
	);
};

// Component for displaying document icon with source fallback
const DocumentIcon = ({
	document,
	inDock,
}: {
	document: any;
	inDock: boolean;
}) => {
	const [iconError, setIconError] = useState(false);
	const [iconLoading, setIconLoading] = useState(false);

	// Try to find the exact source icon from mcp.sources based on documentGroup
	const mcp = useMCPClient();

	// More precise matching for the news source
	const sourceInfo = mcp.sources.find((source: any) => {
		const documentGroup = document.documentGroup?.toLowerCase() || '';
		const sourceName = source.name.toLowerCase();
		const sourceId = source.id.toLowerCase();

		// Try exact matches first, then partial matches
		return (
			documentGroup === sourceName ||
			documentGroup === sourceId ||
			documentGroup.includes(sourceName) ||
			sourceName.includes(documentGroup) ||
			sourceId.includes(documentGroup)
		);
	});

	// Set loading state when we have a source icon to load
	useEffect(() => {
		if (sourceInfo?.icon) {
			setIconLoading(true);
		}
	}, [sourceInfo?.icon]);

	if (sourceInfo?.icon && !iconError) {
		return (
			<div className='relative w-5 h-5'>
				{iconLoading && (
					<div className='absolute inset-0 animate-pulse bg-gray-200 rounded'></div>
				)}
				<img
					src={sourceInfo.icon}
					alt={`${sourceInfo.name || document.documentGroup} icon`}
					className={`w-5 h-5 rounded transition-opacity ${
						inDock ? 'opacity-50' : 'opacity-90'
					} ${iconLoading ? 'opacity-0' : 'opacity-100'}`}
					onError={() => {
						setIconError(true);
						setIconLoading(false);
					}}
					onLoad={() => setIconLoading(false)}
				/>
			</div>
		);
	}

	// Fallback to CheckIcon for in dock, PlusIcon for available
	return inDock ? (
		<CheckIcon className='w-5 h-5 text-green-600' />
	) : (
		<PlusIcon className='w-5 h-5 text-blue-600' />
	);
};

export default function NewsScraperExample() {
	const {
		queue,
		removeFromQueue,
		clearQueue,
		reorderQueue,
		setQueue,
		addToQueue,
	} = useNewsDock();

	// Add to NewsDock queue using context - now handled per item
	// Removed multi-select functionality for direct click-to-add interaction

	// Helper function to check if an article is already in the NewsDock
	const isDocumentInDock = (
		doc: Omit<Document, 'createdAt' | 'updatedAt'> | null
	) => {
		if (!doc) return false;
		return queue.some(
			(queueItem: any) =>
				(doc.documentUrl && queueItem.url === doc.documentUrl) ||
				(doc.id && queueItem.id === doc.id)
		);
	};

	// Calculate statistics about documents and dock status
	const getDocumentStats = () => {
		const currentDocuments = Object.values(
			showGrouped ? groupedDocuments : documents
		)
			.flat()
			.filter((doc) => doc != null);
		const totalDocuments = currentDocuments.length;
		const documentsInDock = currentDocuments.filter((doc) =>
			isDocumentInDock(doc)
		).length;
		const availableDocuments = totalDocuments - documentsInDock;
		return { totalDocuments, documentsInDock, availableDocuments };
	};

	const mcp = useMCPClient();
	const selection = useSelectedSources();

	// Document-based state
	const [documents, setDocuments] = useState<
		Record<string, Array<Omit<Document, 'createdAt' | 'updatedAt'>>>
	>({});
	const [groupedDocuments, setGroupedDocuments] = useState<
		Record<string, Array<Omit<Document, 'createdAt' | 'updatedAt'>>>
	>({});

	// Article-based state (for scraped articles)
	const [articles, setArticles] = useState<
		Record<string, NewsArticlePreview[]>
	>({});

	const [scraping, setScraping] = useState(false);
	const [grouping, setGrouping] = useState(false);
	const [loading, setLoading] = useState(false);
	const [textAnalysisClient] = useState(() => new TextAnalysisMCPClient());
	const [showGrouped, setShowGrouped] = useState(false);
	const [useOpenAI, setUseOpenAI] = useState(true); // Enable OpenAI by default

	// Auto-connect and load articles from database on mount
	useEffect(() => {
		const initializeApp = async () => {
			if (!mcp.isConnected && !mcp.isLoading) {
				mcp.connect();
			}

			// Connect to text analysis server
			textAnalysisClient.connect().catch(console.error);

			// TODO: Replace this auto-loading implementation with a more robust solution
			// Current issues:
			// 1. Flashes localStorage cached grouped documents before auto-loading from database
			// 2. Race condition between localStorage loading and database auto-loading
			// 3. Should implement proper loading states and data reconciliation
			// 4. Consider using React Query or SWR for better caching and state management
			// 5. Auto-grouping should be debounced/throttled to avoid excessive API calls
			// Auto-load articles from database when MCP is connected
			if (mcp.isConnected && Object.keys(documents).length === 0) {
				console.log('🔄 Auto-loading articles from database...');
				// Call the actual handleLoadFromDatabase function without the loading state
				try {
					const response = await fetch('/api/news/documents');
					if (!response.ok) {
						throw new Error(
							`Failed to load articles: ${response.statusText}`
						);
					}

					const data = await response.json();
					console.log('✅ Auto-loaded articles from database:', data);
					console.log(
						'🔍 First few articles:',
						data.documents?.slice(0, 3)
					);

					// Convert database articles back to the format expected by the component
					const documentsData: Record<
						string,
						Array<Omit<Document, 'createdAt' | 'updatedAt'>>
					> = {};

					// Group articles by source
					data.documents
						.filter(
							(article: any) =>
								article && article.id && article.title
						) // Filter out invalid articles
						.forEach((article: any) => {
							const source =
								article.source?.name ||
								article.source?.site ||
								'Unknown Source';
							if (!documentsData[source]) {
								documentsData[source] = [];
							}

							// Convert article to document format for backward compatibility
							const convertedDoc = {
								id: article.id,
								oldId: null,
								title: article.title,
								summary: article.summary,
								fullText: article.fullText,
								documentUrl: article.url,
								documentGroup: source,
								documentType: 'news_article',
								document: {
									title: article.title,
									url: article.url,
									summary: article.summary,
									source: article.source,
									media: article.media,
								},
								processingDate: article.publishedAt
									? new Date(article.publishedAt)
									: null,
								earliestDate: article.publishedAt
									? new Date(article.publishedAt)
									: null,
								latestDate: article.publishedAt
									? new Date(article.publishedAt)
									: null,
								// Required array fields
								allNames: [],
								allPlaces: [],
								allDates: [],
								allObjects: [],
								stamps: [],
								normalizedDates: article.publishedAt
									? [new Date(article.publishedAt)]
									: [],
								// Boolean flags
								hasHandwrittenNotes: false,
								hasStamps: false,
								hasFullText: !!article.fullText,
								// Processing fields
								pageCount: 1,
								processingStage: 'completed',
								processingSteps: ['complete'],
								lastProcessed: new Date(),
								processingError: null,
								archiveId: null,
								searchText: `${article.title} ${
									article.summary || ''
								}`.trim(),
							};

							documentsData[source].push(convertedDoc);
						});

					setDocuments(documentsData);
					setShowGrouped(false); // Initially show by source

					console.log(
						`✅ Auto-loaded ${data.documents.length} articles from database`
					);

					// Auto-group by current events disabled to save OpenAI credits
					// if (data.documents.length > 0) {
					// 	console.log(
					// 		'🤖 Auto-grouping documents by current events...'
					// 	);
					// 	try {
					// 		// Convert documents to articles format for text analysis
					// 		const allDocuments =
					// 			Object.values(documentsData).flat();
					// 		const articlesForAnalysis: NewsArticlePreview[] =
					// 			allDocuments.map((doc) => ({
					// 				id: doc.id,
					// 				title: doc.title || 'Untitled',
					// 				link: doc.documentUrl || '',
					// 				excerpt: doc.summary || '',
					// 				source: {
					// 					site:
					// 						doc.documentGroup ||
					// 						'Unknown Source',
					// 					domain:
					// 						doc.documentGroup ||
					// 						'Unknown Source',
					// 				},
					// 			}));

					// 		const grouped =
					// 			await textAnalysisClient.groupArticlesByCurrentEvents(
					// 				articlesForAnalysis,
					// 				{
					// 					maxGroups: 8,
					// 					minArticlesPerGroup: 2,
					// 					useOpenAI: useOpenAI, // Use the toggle state
					// 				}
					// 			);

					// 		// Convert back to documents format
					// 		const groupedDocs: Record<
					// 			string,
					// 			Array<Omit<Document, 'createdAt' | 'updatedAt'>>
					// 		> = {};
					// 		for (const [groupName, articles] of Object.entries(
					// 			grouped
					// 		)) {
					// 			groupedDocs[groupName] = (
					// 				articles as any[]
					// 			).map((article: any) => {
					// 				const originalDoc = allDocuments.find(
					// 					(doc) => doc.id === article.id
					// 				);
					// 				return originalDoc!;
					// 			});
					// 		}

					// 		setGroupedDocuments(groupedDocs);
					// 		setShowGrouped(true); // Automatically show grouped view

					// 		// Store grouped documents in localStorage
					// 		try {
					// 			localStorage.setItem(
					// 				'groupedDocuments',
					// 				JSON.stringify(groupedDocs)
					// 			);
					// 		} catch (err) {
					// 			console.error(
					// 				'Error saving grouped documents to localStorage:',
					// 				err
					// 			);
					// 		}

					// 		console.log(
					// 			'✅ Auto-grouped documents by current events'
					// 		);
					// 	} catch (groupingError) {
					// 		console.error(
					// 			'❌ Failed to auto-group documents:',
					// 			groupingError
					// 		);
					// 		// If grouping fails, just show the regular documents
					// 		setShowGrouped(false);
					// 	}
					// }
				} catch (error) {
					console.error('❌ Failed to auto-load articles:', error);
					// Silently fail auto-load, user can still manually load
				}
			}

			// Load grouped documents from localStorage
			try {
				const storedGrouped = localStorage.getItem('groupedDocuments');
				if (storedGrouped) {
					setGroupedDocuments(JSON.parse(storedGrouped));
					// Only show grouped if no documents are loaded from DB
					if (Object.keys(documents).length === 0) {
						setShowGrouped(true);
					}
				}
			} catch (err) {
				console.error(
					'Error loading grouped documents from localStorage:',
					err
				);
			}
		};

		initializeApp();

		return () => {
			// Don't manually disconnect documentClient since it extends mcp client
			textAnalysisClient.disconnect().catch(console.error);
		};
	}, [mcp.isConnected, mcp.isLoading]);

	const handleScrapeSelected = async () => {
		if (selection.selectedSources.length === 0) {
			alert('Please select at least one news source');
			return;
		}

		setScraping(true);
		try {
			// Limit to max 2 sources to avoid timeouts (was 3)
			const sourcesToScrape = selection.selectedSources.slice(0, 2);
			console.log(
				`🚀 Scraping ${sourcesToScrape.length} sources:`,
				sourcesToScrape
			);

			// Use the existing MCP client instead of separate document client
			const result = await mcp.scrapeSelectedSources(sourcesToScrape, {
				limit: 5, // Reduced from 3 to 5 to get more articles but with timeout protection
				includeMedia: true,
				includeSections: true,
			});

			console.log('📥 Raw scraping result:', result);
			setArticles(result);
		} catch (error) {
			console.error('❌ Scraping failed:', error);
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			// Check if it's a timeout error and provide specific guidance
			if (
				errorMessage.includes('timeout') ||
				errorMessage.includes('timed out')
			) {
				alert(
					`Scraping timed out: ${errorMessage}\n\nTips to avoid timeouts:\n• Select fewer sources (max 2 recommended)\n• Try again later if news sites are slow\n• Check if the MCP server is overloaded`
				);
			} else {
				alert(
					`Scraping failed: ${errorMessage}\n\nPlease check:\n• News servers are running properly\n• Selected sources are accessible\n• MCP server connection is stable`
				);
			}
		} finally {
			setScraping(false);
		}
	};

	const handleLoadFromDatabase = async () => {
		if (loading) return;

		setLoading(true);
		try {
			console.log('📖 Loading news articles from database...');

			const response = await fetch('/api/news/documents');
			if (!response.ok) {
				throw new Error(
					`Failed to load articles: ${response.statusText}`
				);
			}

			const data = await response.json();
			console.log('✅ Loaded articles from database:', data);
			console.log('🔍 First few articles:', data.documents?.slice(0, 3));

			// Convert database articles back to the format expected by the component
			const documentsData: Record<
				string,
				Array<Omit<Document, 'createdAt' | 'updatedAt'>>
			> = {};

			// Group articles by source
			data.documents
				.filter(
					(article: any) => article && article.id && article.title
				) // Filter out invalid articles
				.forEach((article: any) => {
					const source =
						article.source?.name ||
						article.source?.site ||
						'Unknown Source';
					if (!documentsData[source]) {
						documentsData[source] = [];
					}

					// Convert article to document format for backward compatibility
					const convertedDoc = {
						id: article.id,
						oldId: null,
						title: article.title,
						summary: article.summary,
						fullText: article.fullText,
						documentUrl: article.url,
						documentGroup: source,
						documentType: 'news_article',
						document: {
							title: article.title,
							url: article.url,
							summary: article.summary,
							source: article.source,
							media: article.media,
						},
						processingDate: article.publishedAt
							? new Date(article.publishedAt)
							: null,
						earliestDate: article.publishedAt
							? new Date(article.publishedAt)
							: null,
						latestDate: article.publishedAt
							? new Date(article.publishedAt)
							: null,
						// Required array fields
						allNames: [],
						allPlaces: [],
						allDates: [],
						allObjects: [],
						stamps: [],
						normalizedDates: article.publishedAt
							? [new Date(article.publishedAt)]
							: [],
						// Boolean flags
						hasHandwrittenNotes: false,
						hasStamps: false,
						hasFullText: !!article.fullText,
						// Processing fields
						pageCount: 1,
						processingStage: 'completed',
						processingSteps: ['complete'],
						lastProcessed: new Date(),
						processingError: null,
						archiveId: null,
						searchText: `${article.title} ${
							article.summary || ''
						}`.trim(),
					};

					documentsData[source].push(convertedDoc);
				});

			setDocuments(documentsData);
			setShowGrouped(false); // Show raw documents when loading from DB

			alert(
				`Successfully loaded ${data.documents.length} news articles from database!`
			);
		} catch (error) {
			console.error('❌ Failed to load articles:', error);
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			alert(`Failed to load articles: ${errorMessage}`);
		} finally {
			setLoading(false);
		}
	};

	const handleGroupByCurrentEvents = async () => {
		const allDocuments = Object.values(documents).flat();
		if (allDocuments.length === 0) {
			alert('Please scrape some documents first');
			return;
		}

		setGrouping(true);
		try {
			// Convert documents to articles format for text analysis
			const articlesForAnalysis: NewsArticlePreview[] = allDocuments.map(
				(doc) => ({
					id: doc.id,
					title: doc.title || 'Untitled',
					link: doc.documentUrl || '',
					excerpt: doc.summary || '',
					source: {
						site: doc.documentGroup || 'Unknown Source',
						domain: doc.documentGroup || 'Unknown Source',
					},
				})
			);

			const grouped =
				await textAnalysisClient.groupArticlesByCurrentEvents(
					articlesForAnalysis,
					{
						maxGroups: 8,
						minArticlesPerGroup: 2,
						useOpenAI: useOpenAI, // Use the toggle state
					}
				);

			// Convert back to documents format
			const groupedDocs: Record<
				string,
				Array<Omit<Document, 'createdAt' | 'updatedAt'>>
			> = {};
			for (const [groupName, articles] of Object.entries(grouped)) {
				groupedDocs[groupName] = (articles as any[]).map(
					(article: any) => {
						const originalDoc = allDocuments.find(
							(doc) => doc.id === article.id
						);
						return originalDoc!;
					}
				);
			}

			setGroupedDocuments(groupedDocs);
			setShowGrouped(true);
			// Store grouped documents in localStorage
			try {
				localStorage.setItem(
					'groupedDocuments',
					JSON.stringify(groupedDocs)
				);
			} catch (err) {
				console.error(
					'Error saving grouped documents to localStorage:',
					err
				);
			}
		} catch (error) {
			console.error('Grouping failed:', error);
			alert(
				'Failed to group documents. Make sure the text analysis server is running.'
			);
		} finally {
			setGrouping(false);
		}
	};

	const handleSelectByCategory = (category: string) => {
		const sourcesInCategory = mcp.sources
			.filter((source: any) => source.category === category)
			.map((source: any) => source.id);
		selection.selectAll(sourcesInCategory.slice(0, 2)); // Reduced from 3 to 2 for better timeout handling
	};

	if (mcp.isLoading && !mcp.isConnected) {
		return (
			<div className='flex items-center justify-center p-8'>
				<div className='text-center'>
					<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4'></div>
					<p>Connecting to MCP server...</p>
				</div>
			</div>
		);
	}

	if (mcp.error) {
		return (
			<Alert variant='destructive'>
				<AlertCircleIcon />
				<AlertTitle>mcp.error</AlertTitle>
				<AlertDescription>
					<p className='text-red-600'>{mcp.error}</p>
					<button
						onClick={mcp.connect}
						className='hover:cursor-pointer mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700'
					>
						Retry Connection
					</button>
				</AlertDescription>
			</Alert>
		);
	}

	if (!mcp.isConnected) {
		return (
			<div className='text-center p-8'>
				<p>Not connected to MCP server</p>
				<button
					onClick={mcp.connect}
					className='mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
				>
					Connect
				</button>
			</div>
		);
	}

	return (
		<div className='max-w-6xl mx-auto p-6'>
			<div className='mb-8'>
				<h1 className='text-3xl font-bold mb-4'>
					News Document Scraper Dashboard
				</h1>
				<div className='bg-green-50 border border-green-200 rounded-lg p-4 mb-6'>
					<p className='text-green-800'>
						✅ Connected to MCP server • {mcp.sources.length} news
						sources available • Documents stored in unified schema
					</p>
				</div>
			</div>

			{/* Quick Category Selection */}
			<div className='mb-6'>
				<h2 className='text-xl font-semibold mb-3'>
					Quick Select by Category
				</h2>
				<div className='flex flex-wrap gap-2'>
					{[
						'conservative',
						'liberal',
						'centrist',
						'business',
						'tech',
					].map((category) => {
						const categoryCount = mcp.sources.filter(
							(s: any) => s.category === category
						).length;
						const willSelect = Math.min(categoryCount, 2);
						return (
							<button
								key={category}
								onClick={() => handleSelectByCategory(category)}
								className='px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm capitalize'
								title={`Select ${willSelect} of ${categoryCount} sources (limited to 2 for timeout prevention)`}
							>
								{category} ({willSelect}/{categoryCount})
							</button>
						);
					})}
				</div>
			</div>

			{/* Source Selection */}
			<div className='grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6'>
				<div>
					<h2 className='text-xl font-semibold mb-3'>
						Select News Sources ({selection.count} selected) - Click
						to Add/Remove
					</h2>
					<div className='max-h-96 overflow-y-auto border rounded-lg'>
						{mcp.sources.map((source: any) => (
							<div
								key={source.id}
								onClick={() =>
									selection.toggleSource(source.id)
								}
								className={`flex items-center p-3 hover:bg-gray-50 border-b last:border-b-0 cursor-pointer transition-colors ${
									selection.isSelected(source.id)
										? 'bg-blue-50 border-blue-200'
										: ''
								}`}
							>
								<div className='mr-3 flex-shrink-0'>
									<SourceIcon
										source={source}
										isSelected={selection.isSelected(
											source.id
										)}
									/>
								</div>
								<div className='flex-1'>
									<div className='font-medium'>
										{source.name}
									</div>
									<div className='text-sm text-gray-600 capitalize'>
										{source.category} • {source.method}
									</div>
								</div>
							</div>
						))}
					</div>
					<div className='mt-3 flex gap-2'>
						<button
							onClick={() =>
								selection.selectAll(
									mcp.sources.map((s: any) => s.id)
								)
							}
							className='px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 rounded'
						>
							Select All
						</button>
						<button
							onClick={selection.clearSelection}
							className='px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded'
						>
							Clear All
						</button>
					</div>
				</div>

				{/* Scraping Controls */}
				<div>
					<h2 className='text-xl font-semibold mb-3'>
						News Documents
					</h2>
					<div className='border rounded-lg p-4'>
						<button
							onClick={handleScrapeSelected}
							disabled={scraping || selection.count === 0}
							className='w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed mb-3'
						>
							{scraping
								? 'Scraping...'
								: `Scrape ${Math.min(
										selection.count,
										2
								  )} Selected Sources ${
										Math.min(selection.count, 2) === 1
											? '(Fast Mode)'
											: '(Batch Mode)'
								  }`}
						</button>

						{selection.count > 2 && (
							<div className='mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800'>
								⚠️ Only the first 2 sources will be scraped to
								avoid timeouts. Deselect some sources or scrape
								in multiple batches.
							</div>
						)}

						{/* Load from Database button */}
						<button
							onClick={handleLoadFromDatabase}
							disabled={loading}
							className='w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
						>
							<DatabaseIcon className='w-4 h-4' />
							{loading
								? 'Loading...'
								: 'Load News Articles from Database'}
						</button>

						{loading && (
							<div className='mt-3 text-center'>
								<div className='animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto'></div>
								<p className='text-sm text-gray-600 mt-2'>
									Loading news articles from database...
								</p>
							</div>
						)}

						{scraping && (
							<div className='mt-3 text-center'>
								<div className='animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto'></div>
								<p className='text-sm text-gray-600 mt-2'>
									Scraping news from selected sources with
									improved timeout handling...
									<br />
									<span className='text-xs'>
										{Math.min(selection.count, 2) === 1
											? 'Using optimized single-source scraping for faster results'
											: 'Processing in batches to ensure reliability'}
									</span>
								</p>
							</div>
						)}

						{/* Text Analysis Controls */}
						{Object.keys(documents).length > 0 && (
							<div className='mt-4 border-t pt-4'>
								<h3 className='font-semibold mb-2'>
									Text Analysis
								</h3>

								{/* OpenAI Toggle */}
								<div
									onClick={() => setUseOpenAI(!useOpenAI)}
									className='mb-3 flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors'
								>
									<div className='w-4 h-4 flex items-center justify-center'>
										{useOpenAI ? (
											<CheckIcon className='w-4 h-4 text-green-600' />
										) : (
											<PlusIcon className='w-4 h-4 text-gray-400' />
										)}
									</div>
									<label
										htmlFor='useOpenAI'
										className='text-sm text-gray-700 cursor-pointer'
									>
										Use OpenAI for intelligent grouping
										{useOpenAI ? (
											<span className='text-green-600 ml-1'>
												🤖 AI
											</span>
										) : (
											<span className='text-blue-600 ml-1'>
												📊 Keywords
											</span>
										)}
									</label>
								</div>

								<button
									onClick={handleGroupByCurrentEvents}
									disabled={grouping}
									className='w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed'
								>
									{grouping
										? 'Grouping by Events...'
										: `Group by Current Events ${
												useOpenAI
													? '(AI)'
													: '(Keywords)'
										  }`}
								</button>

								{grouping && (
									<div className='mt-3 text-center'>
										<div className='animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto'></div>
										<p className='text-sm text-gray-600 mt-2'>
											{useOpenAI
												? 'Using OpenAI to analyze and group documents by current events...'
												: 'Using keyword analysis to group documents by topics...'}
										</p>
									</div>
								)}

								{Object.keys(groupedDocuments).length > 0 && (
									<div className='mt-3 flex gap-2'>
										<button
											onClick={() =>
												setShowGrouped(false)
											}
											className={`px-3 py-1 text-sm rounded ${
												!showGrouped
													? 'bg-blue-100 text-blue-800'
													: 'bg-gray-100 text-gray-600'
											}`}
										>
											By Source
										</button>
										<button
											onClick={() => setShowGrouped(true)}
											className={`px-3 py-1 text-sm rounded ${
												showGrouped
													? 'bg-purple-100 text-purple-800'
													: 'bg-gray-100 text-gray-600'
											}`}
										>
											By Current Events
										</button>
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Results */}
			{Object.keys(showGrouped ? groupedDocuments : documents).length >
				0 && (
				<div>
					<div className='flex justify-between items-center mb-4'>
						<h2 className='text-xl font-semibold'>
							{showGrouped
								? 'Documents by Current Events'
								: 'Latest Documents'}
						</h2>
						<div className='flex gap-2 items-center'>
							{getDocumentStats().documentsInDock > 0 && (
								<span className='px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded'>
									{getDocumentStats().documentsInDock} in dock
								</span>
							)}
							<span className='px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded'>
								{getDocumentStats().availableDocuments}{' '}
								available to add
							</span>
							<span className='px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded'>
								{getDocumentStats().totalDocuments} total
							</span>
						</div>
					</div>

					{/* Documents Section */}
					<div>
						<h3 className='text-lg font-semibold mb-3 flex items-center gap-2'>
							All Documents ({getDocumentStats().totalDocuments})
							- Click to Add/Remove from Dock
						</h3>
						<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
							{Object.entries(
								showGrouped ? groupedDocuments : documents
							)
								.map(([groupName, groupDocuments]) => {
									if (groupDocuments.length === 0)
										return null;

									return (
										<div
											key={`all-${groupName}`}
											className='border rounded-lg p-4 h-96 flex flex-col'
										>
											<h4 className='font-semibold text-lg mb-3'>
												{showGrouped
													? groupName
													: groupDocuments[0]
															?.documentGroup ||
													  groupName}
												<span className='text-sm text-gray-600 ml-2'>
													({groupDocuments.length}{' '}
													total)
												</span>
											</h4>
											<ScrollArea className='h-80 flex-1'>
												<div className='space-y-2'>
													{groupDocuments
														.filter(
															(document) =>
																document != null
														)
														.map(
															(document, idx) => {
																const documentId =
																	document.id ||
																	document.documentUrl ||
																	`${groupName}-${idx}`;
																const inDock =
																	isDocumentInDock(
																		document
																	);

																const handleToggleDock =
																	() => {
																		if (
																			inDock
																		) {
																			// Remove from dock
																			const queueItem =
																				queue.find(
																					(
																						item
																					) =>
																						item.url ===
																							document.documentUrl ||
																						item.id ===
																							document.id
																				);
																			if (
																				queueItem
																			) {
																				removeFromQueue(
																					queueItem.id
																				);
																			}
																		} else {
																			// Add to dock
																			addToQueue(
																				{
																					id: document.id as string,
																					title:
																						document.title ||
																						'Untitled',
																					url:
																						document.documentUrl ||
																						'',
																					type: 'article',
																					source: {
																						name:
																							document.documentGroup ||
																							'Unknown Source',
																						site:
																							document.documentGroup ||
																							'Unknown Source',
																						domain:
																							document.documentGroup ||
																							'Unknown Source',
																					},
																					publishedAt:
																						document.earliestDate?.toISOString(),
																					excerpt:
																						document.summary ||
																						undefined,
																					summary:
																						document.summary ||
																						undefined,
																				}
																			);
																		}
																	};

																return (
																	<div
																		key={
																			documentId
																		}
																		onClick={
																			handleToggleDock
																		}
																		className={`flex items-center p-3 hover:bg-gray-50 border-b last:border-b-0 cursor-pointer transition-colors rounded-sm ${
																			inDock
																				? 'bg-green-50 border-green-200'
																				: ''
																		}`}
																	>
																		<div className='mr-3 flex-shrink-0'>
																			<DocumentIcon
																				document={
																					document
																				}
																				inDock={
																					inDock
																				}
																			/>
																		</div>
																		<div className='flex-1 min-w-0'>
																			<div className='font-medium text-sm leading-tight mb-1'>
																				{document.title ||
																					'Untitled Document'}
																			</div>
																			{document.summary && (
																				<p className='text-xs text-gray-600 mb-1 line-clamp-2'>
																					{
																						document.summary
																					}
																				</p>
																			)}
																			<div className='flex items-center gap-2 text-xs text-gray-500'>
																				{document.document &&
																					typeof document.document ===
																						'object' &&
																					(
																						document.document as any
																					)
																						?.imageUrl && (
																						<span>
																							📷
																							Image
																						</span>
																					)}
																				<span className='capitalize'>
																					{document.documentGroup ||
																						'Unknown Source'}
																				</span>
																				{document.earliestDate && (
																					<span>
																						{new Date(
																							document.earliestDate
																						).toLocaleDateString()}
																					</span>
																				)}
																			</div>
																		</div>
																	</div>
																);
															}
														)}
												</div>
											</ScrollArea>
										</div>
									);
								})
								.filter(Boolean)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
