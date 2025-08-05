'use client';

import React, { useEffect, useState } from 'react';
import {
	useMCPClient,
	useSelectedSources,
} from '../../hooks/news/use-mcp-client';
import { TextAnalysisMCPClient } from '@/lib/text-analysis-client';
import type { Document, Post } from '@prisma/client';
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
		const currentDocuments = Object.values(documents)
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

	// Post-based state (for database articles)
	const [posts, setPosts] = useState<Record<string, Post[]>>({});

	// Article-based state (for scraped articles)
	const [articles, setArticles] = useState<
		Record<string, NewsArticlePreview[]>
	>({});

	const [scraping, setScraping] = useState(false);
	const [loading, setLoading] = useState(false);
	const [textAnalysisClient] = useState(() => new TextAnalysisMCPClient());
	// grouping, showGrouped, and useOpenAI state variables removed
	const [asyncJobStatus, setAsyncJobStatus] = useState<{
		jobId: string;
		status: string;
		message: string;
	} | null>(null);

	// Auto-connect on mount
	useEffect(() => {
		const initializeApp = async () => {
			if (!mcp.isConnected && !mcp.isLoading) {
				mcp.connect();
			}

			// Connect to text analysis server
			textAnalysisClient.connect().catch(console.error);
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

	// handleGroupByCurrentEvents function removed

	const handleStartAsyncScrapeJob = async () => {
		if (selection.selectedSources.length === 0) {
			alert('Please select at least one news source');
			return;
		}

		setScraping(true);
		try {
			// Get URLs for the selected sources
			const selectedSourceDetails = await Promise.all(
				selection.selectedSources.map((id) =>
					mcp.getNewsSourceDetails(id)
				)
			);

			const urls = selectedSourceDetails.map((source) => source.url);
			console.log(
				`🚀 Starting async scraping job for ${urls.length} URLs:`,
				urls
			);

			// Start the scraping job using the new async method
			const result = await mcp.startHomepageFirecrawlJob({
				urls: urls,
				limit: 20, // Get up to 20 articles per site
			});

			console.log('✅ Started async scraping job:', result);
			setAsyncJobStatus(result);

			alert(
				`Scraping job started!\nJob ID: ${result.jobId}\nStatus: ${result.status}\n\nThe articles will be saved to the database in the background.`
			);
		} catch (error) {
			console.error('❌ Failed to start scraping job:', error);
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			alert(`Failed to start scraping job: ${errorMessage}`);
		} finally {
			setScraping(false);
		}
	};

	// Extract full article content from posts with only summaries
	const handleExtractArticleContent = async () => {
		setScraping(true);
		try {
			// Call the MCP client to start article extraction
			// This time we don't provide URLs - the server will find posts needing content
			const result = await mcp.startArticleExtractFirecrawlJob({
				limit: 50, // Process up to 50 posts at a time
			});

			console.log('✅ Started article extraction job:', result);
			setAsyncJobStatus(result);

			alert(
				`Article extraction job started!\nJob ID: ${result.jobId}\nStatus: ${result.status}\n\nFull article content will be extracted from posts in the background.`
			);
		} catch (error) {
			console.error('❌ Failed to start article extraction job:', error);
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			alert(`Failed to start article extraction job: ${errorMessage}`);
		} finally {
			setScraping(false);
		}
	};

	const handleSelectByCategory = (category: string) => {
		const sourcesInCategory = mcp.sources
			.filter((source: any) => source.category === category)
			.map((source: any) => source.id);
		selection.selectAll(sourcesInCategory.slice(0, 2)); // Reduced from 3 to 2 for better timeout handling
	};

	// Load news articles directly from the database
	const handleLoadFromDatabase = async () => {
		setLoading(true);
		try {
			console.log('🔍 Fetching news articles from database...');

			// Call the news articles API endpoint directly
			const response = await fetch('/api/news/posts?limit=50');

			if (!response.ok) {
				const errorText = await response.text();
				console.error(`API response (${response.status}):`, errorText);
				throw new Error(
					`Error fetching news: ${response.status} - ${
						errorText || 'No response body'
					}`
				);
			}

			const data = await response.json();
			const { posts: fetchedPosts } = data;

			if (!fetchedPosts || !Array.isArray(fetchedPosts)) {
				console.error('Invalid response format:', data);
				throw new Error('Invalid response format from API');
			}

			console.log(
				`📊 Loaded ${fetchedPosts.length} news articles from database`
			);

			// Group posts by source
			const grouped: Record<string, Post[]> = {};

			fetchedPosts.forEach((post: Post) => {
				const sourceName =
					post.bylineWritersLocation || 'Unknown Source';
				if (!grouped[sourceName]) {
					grouped[sourceName] = [];
				}
				grouped[sourceName].push(post);
			});

			// Update state with the grouped posts
			setPosts(grouped);

			// Clear documents state since we're using posts now
			setDocuments({});
		} catch (error) {
			console.error('❌ Error loading news articles:', error);
			alert(
				`Failed to load news articles: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
		} finally {
			setLoading(false);
		}
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

						{/* Add Async Job Scraping button */}
						<button
							onClick={handleStartAsyncScrapeJob}
							disabled={scraping || selection.count === 0}
							className='w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed mb-3'
						>
							Start Async Scraping Job ({selection.count} sources)
						</button>

						{/* Extract Article Content button */}
						<button
							onClick={handleExtractArticleContent}
							disabled={scraping}
							className='w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed mb-3'
						>
							Extract Full Article Content from Database
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

						{/* Async Job Status */}
						{asyncJobStatus && (
							<div className='mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded'>
								<h4 className='font-semibold text-indigo-800'>
									Async Job Status
								</h4>
								<div className='text-sm mt-1'>
									<p>
										<span className='font-medium'>
											Job ID:
										</span>{' '}
										{asyncJobStatus.jobId}
									</p>
									<p>
										<span className='font-medium'>
											Status:
										</span>{' '}
										{asyncJobStatus.status}
									</p>
									<p>
										<span className='font-medium'>
											Message:
										</span>{' '}
										{asyncJobStatus.message}
									</p>
								</div>
								<p className='text-xs text-indigo-600 mt-2'>
									This job is processing in the background.
									Articles will be saved directly to the
									database.
								</p>
							</div>
						)}

						{/* Text Analysis Controls - Removed since we're not using documents anymore */}
					</div>
				</div>
			</div>

			{/* Results - Only showing posts now */}
			{Object.keys(posts).length > 0 && (
				<div>
					<div className='flex justify-between items-center mb-4'>
						<h2 className='text-xl font-semibold'>
							News Articles from Database
						</h2>
						<div className='flex gap-2 items-center'>
							<span className='px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded'>
								{Object.values(posts).flat().length} articles
								loaded
							</span>
						</div>
					</div>

					{/* Posts Section */}
					<div className='mb-8'>
						<h3 className='text-lg font-semibold mb-3 flex items-center gap-2'>
							Click to Add/Remove from Dock
						</h3>
						<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
							{Object.entries(posts)
								.map(([sourceName, sourcePosts]) => {
									if (sourcePosts.length === 0) return null;

									return (
										<div
											key={`source-${sourceName}`}
											className='border rounded-lg p-4 h-96 flex flex-col'
										>
											<h4 className='font-semibold text-lg mb-3'>
												{sourceName}
												<span className='text-sm text-gray-600 ml-2'>
													({sourcePosts.length}{' '}
													articles)
												</span>
											</h4>
											<ScrollArea className='h-80 flex-1'>
												<div className='space-y-2'>
													{sourcePosts.map((post) => {
														const postId = post.id;
														const inDock =
															queue.some(
																(item) =>
																	item.id ===
																		postId ||
																	item.url ===
																		post.webUrl
															);

														const handleToggleDock =
															() => {
																if (inDock) {
																	// Remove from dock
																	const queueItem =
																		queue.find(
																			(
																				item
																			) =>
																				item.id ===
																					postId ||
																				item.url ===
																					post.webUrl
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
																	addToQueue({
																		id: postId,
																		title:
																			post.articleText?.split(
																				'\n'
																			)[0] ||
																			'Untitled Article',
																		url:
																			post.webUrl ||
																			'',
																		type: 'article',
																		source: {
																			name:
																				post.bylineWritersLocation ||
																				'Unknown Source',
																			site:
																				post.bylineWritersLocation ||
																				'Unknown Source',
																			domain:
																				post.bylineWritersLocation ||
																				'Unknown Source',
																		},
																		publishedAt:
																			new Date().toISOString(), // No createdAt in Post model
																		excerpt:
																			post.articleText ||
																			undefined,
																		summary:
																			post.articleText ||
																			undefined,
																	});
																}
															};

														return (
															<div
																key={postId}
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
																	{inDock ? (
																		<CheckIcon className='w-5 h-5 text-green-600' />
																	) : (
																		<PlusIcon className='w-5 h-5 text-blue-600' />
																	)}
																</div>
																<div className='flex-1 min-w-0'>
																	<div className='font-medium text-sm leading-tight mb-1'>
																		{post.articleText?.split(
																			'\n'
																		)[0] ||
																			'Untitled Article'}
																	</div>
																	{post.articleText && (
																		<p className='text-xs text-gray-600 mb-1 line-clamp-2'>
																			{
																				post.articleText
																			}
																		</p>
																	)}
																	<div className='flex items-center gap-2 text-xs text-gray-500'>
																		{post.featuredImage && (
																			<span>
																				📷
																				Image
																			</span>
																		)}
																		<span className='capitalize'>
																			{post.bylineWritersLocation ||
																				'Unknown Source'}
																		</span>
																		{post.bylineWriter && (
																			<span>
																				{
																					post.bylineWriter
																				}
																			</span>
																		)}
																		<span>
																			{new Date().toLocaleDateString()}{' '}
																			{/* No createdAt in Post model */}
																		</span>
																	</div>
																</div>
															</div>
														);
													})}
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
