'use client';

import React, { useEffect, useState } from 'react';
import {
	useMCPClient,
	useSelectedSources,
} from '../../hooks/pharos/use-mcp-client';
import { pharosClient } from '@/lib/pharos-client';
import type { Document, Post } from '@prisma/client';
import type { NewsArticlePreview, AIModel } from '@shared/types';

import { ScrollArea } from '../ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import {
	AlertCircleIcon,
	PlusIcon,
	DatabaseIcon,
	CheckIcon,
	Clock,
	Tag,
	X,
	Loader2,
} from 'lucide-react';
import { useNewsDock } from '@/lib/context/NewsDockContext';
import { ModelSelector } from '@/components/ui/ModelSelector';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '../ui/card';

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
	const [summarizing, setSummarizing] = useState(false); // Added
	const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
	// Using unified pharosClient instead of separate textAnalysisClient

	// Set default model on component mount
	useEffect(() => {
		if (!selectedModel) {
			// Set a default model
			setSelectedModel({
				id: 'gpt-4o-mini',
				name: 'GPT-4o Mini',
				description: 'Fast and cost-effective',
				provider: 'OpenAI',
				costTier: 'low',
				maxTokens: 1500,
				temperature: 0.3,
				capabilities: {
					textGeneration: true,
					codeGeneration: true,
					reasoning: true,
				},
			});
		}
	}, [selectedModel]);
	// Tool selection states
	const [homepageTool, setHomepageTool] = useState<'firecrawl' | 'html'>(
		'html'
	);
	const [extractionTool, setExtractionTool] = useState<'firecrawl' | 'html'>(
		'html'
	);
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
			// pharosClient connection already handled by useMCPClient hook
		};

		initializeApp();

		return () => {
			// Don't manually disconnect documentClient since it extends mcp client
			// pharosClient disconnection handled by useMCPClient hook
		};
	}, [mcp.isConnected, mcp.isLoading]);

	// handleGroupByCurrentEvents function removed

	// Extract article content for dock items only using HTML scraper
	const handleExtractDockItemsContent = async () => {
		if (queue.length === 0) {
			alert('No items in dock to extract content for');
			return;
		}

		setScraping(true);
		try {
			// Filter dock items to URLs that can be extracted
			const urlItems = queue.filter((item) => item.url);

			if (urlItems.length === 0) {
				alert('No items with URLs found in dock');
				return;
			}

			console.log(
				`🚀 Starting streaming article extraction for ${urlItems.length} dock items...`
			);

			let processedCount = 0;
			let successCount = 0;

			// Process each URL with streaming
			for (const item of urlItems) {
				try {
					console.log(`📄 Processing: ${item.title} (${item.url})`);

					const response = await fetch('/api/scrape/article', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ url: item.url }),
					});

					if (!response.ok) {
						throw new Error(
							`HTTP ${response.status}: ${response.statusText}`
						);
					}

					if (!response.body) {
						throw new Error('Response body is null');
					}

					const reader = response.body.getReader();
					const decoder = new TextDecoder();
					let buffer = '';
					let extractedArticle = null;

					while (true) {
						const { done, value } = await reader.read();

						if (done) break;

						buffer += decoder.decode(value, { stream: true });

						// Process complete SSE events
						const events = buffer.split('\n\n');
						buffer = events.pop() || ''; // Keep incomplete event in buffer

						for (const eventText of events) {
							if (!eventText.trim()) continue;

							const lines = eventText.split('\n');
							let eventType = 'message';
							let data = '';

							for (const line of lines) {
								if (line.startsWith('event:')) {
									eventType = line.substring(6).trim();
								} else if (line.startsWith('data:')) {
									data = line.substring(5).trim();
								}
							}

							// Parse data
							let parsedData;
							try {
								parsedData = JSON.parse(data);
							} catch {
								parsedData = data;
							}

							// Handle events
							if (eventType === 'progress') {
								console.log(
									`📊 Progress: ${
										typeof parsedData === 'string'
											? parsedData
											: parsedData.message
									}`
								);
							} else if (eventType === 'complete') {
								extractedArticle = parsedData;
								console.log(
									`✅ Completed extraction for: ${item.title}`
								);
								break;
							} else if (eventType === 'error') {
								throw new Error(
									typeof parsedData === 'string'
										? parsedData
										: parsedData.message
								);
							}
						}

						if (extractedArticle) break;
					}

					if (extractedArticle) {
						successCount++;
						console.log(
							`✅ Successfully extracted and saved: ${
								extractedArticle.title
							}${
								extractedArticle.postId
									? ` (Post ID: ${extractedArticle.postId})`
									: ''
							}`
						);
					}
				} catch (error) {
					console.error(
						`❌ Failed to extract content for ${item.title}:`,
						error
					);
				}

				processedCount++;
			}

			console.log(
				`✅ Completed streaming article extraction for dock items. Processed: ${processedCount}, Successful: ${successCount}`
			);

			alert(
				`Streaming article extraction completed!\nProcessed: ${processedCount} articles\nSuccessful extractions: ${successCount}\n\nArticles have been saved to the database. Use the "Load from Database" button to refresh the view.`
			);
		} catch (error) {
			console.error(
				'❌ Failed to extract content for dock items:',
				error
			);
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			alert(`Failed to extract content for dock items: ${errorMessage}`);
		} finally {
			setScraping(false);
		}
	};

	// Unified homepage scraper handler that uses the selected tool
	const handleHomepageScraping = async () => {
		if (selection.selectedSources.length === 0) {
			alert('Please select at least one news source');
			return;
		}

		setScraping(true);
		try {
			// Get URLs for the selected sources from local API
			const response = await fetch('/api/pharos/news-sources');
			if (!response.ok) {
				throw new Error('Failed to fetch news sources');
			}
			const allSources = await response.json();

			// Filter to get only selected sources
			const selectedSourceDetails = allSources.filter((source: any) =>
				selection.selectedSources.includes(source.id)
			);

			const urls = selectedSourceDetails.map((source: any) => source.url);
			console.log(
				`🚀 Starting ${homepageTool} homepage scraping for ${urls.length} URLs:`,
				urls
			);

			if (homepageTool === 'html') {
				// Use HTML scraper (local parsing)
				const result = await mcp.startHomepageHtmlScraperJob({
					urls: urls,
					limit: 20,
				});

				console.log('✅ Completed HTML scraper job:', result);
				alert(
					`HTML scraping completed!\nProcessed: ${result.totalArticlesProcessed} articles\nSources processed: ${result.results.length}\n\nArticles have been saved to the database.`
				);
			} else {
				// Use Firecrawl (async job)
				const result = await mcp.startHomepageFirecrawlJob({
					urls: urls,
					limit: 20,
				});

				console.log('✅ Started Firecrawl job:', result);
				setAsyncJobStatus(result);
				alert(
					`Firecrawl job started!\nJob ID: ${result.jobId}\nStatus: ${result.status}\n\nThe articles will be saved to the database in the background.`
				);
			}

			// Optionally refresh the data
			await handleLoadFromDatabase();
		} catch (error) {
			console.error(
				`❌ Failed to start ${homepageTool} scraper job:`,
				error
			);
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			alert(
				`Failed to start ${homepageTool} scraper job: ${errorMessage}`
			);
		} finally {
			setScraping(false);
		}
	};

	// Unified article extraction handler that uses the selected tool
	const handleArticleExtraction = async () => {
		setScraping(true);
		try {
			console.log(`🚀 Starting ${extractionTool} article extraction...`);

			if (extractionTool === 'html') {
				// Use HTML extractor (local parsing)
				const result = await mcp.startArticleHtmlScraperJob({
					limit: 50,
				});

				console.log('✅ Completed HTML article extraction:', result);
				alert(
					`HTML article extraction completed!\nProcessed: ${result.totalArticlesProcessed} articles\nResults: ${result.results.length} processed\n\nArticles have been updated in the database.`
				);
			} else {
				// Use Firecrawl extractor (async job)
				const result = await mcp.startArticleExtractFirecrawlJob({
					limit: 50,
				});

				console.log(
					'✅ Started Firecrawl article extraction job:',
					result
				);
				alert(
					`Firecrawl article extraction job started!\nJob ID: ${result.jobId}\nStatus: ${result.status}\n\nThe articles will be processed in the background.`
				);
			}

			// Refresh the data to show updated articles
			await handleLoadFromDatabase();
		} catch (error) {
			console.error(
				`❌ Failed ${extractionTool} article extraction:`,
				error
			);
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			alert(
				`Failed ${extractionTool} article extraction: ${errorMessage}`
			);
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

			// Call the pharos articles API endpoint directly
			const response = await fetch('/api/pharos/posts?limit=50');

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

	// Helper: build queue item from a Post
	const buildQueueItemFromPost = (post: Post) => ({
		id: post.id,
		title:
			post.title ||
			post.articleText?.split('\n')[0] ||
			'Untitled Article',
		url: post.webUrl || '',
		type: 'article' as const,
		source: {
			name: post.bylineWritersLocation || 'Unknown Source',
			site: post.bylineWritersLocation || 'Unknown Source',
			domain: post.bylineWritersLocation || 'Unknown Source',
		},
		publishedAt: new Date().toISOString(),
		excerpt: post.articleText || undefined,
		summary: post.articleText || undefined,
	});

	const isPostInDock = (post: Post) =>
		queue.some((item) => item.id === post.id || item.url === post.webUrl);

	const areAllSourcePostsInDock = (sourcePosts: Post[]) =>
		sourcePosts.length > 0 && sourcePosts.every(isPostInDock);

	const handleAddAllSourcePosts = (sourcePosts: Post[]) => {
		sourcePosts.forEach((p) => {
			if (!isPostInDock(p)) addToQueue(buildQueueItemFromPost(p));
		});
	};

	const handleRemoveAllSourcePosts = (sourcePosts: Post[]) => {
		sourcePosts.forEach((p) => {
			const existing = queue.find(
				(item) => item.id === p.id || item.url === p.webUrl
			);
			if (existing) removeFromQueue(existing.id);
		});
	};

	const handleSummarizeDockArticles = async () => {
		console.log('🚀 handleSummarizeDockArticles called!', {
			queueLength: queue.length,
		});

		if (queue.length === 0) {
			alert('No items in dock to summarize');
			return;
		}
		setSummarizing(true);
		try {
			console.log('🔌 Checking text analysis client connection...');
			if (!pharosClient.connected) {
				console.log('📡 Connecting to pharos client...');
				await pharosClient.connect();
				console.log('✅ Connected to pharos client');
			} else {
				console.log('✅ Pharos client already connected');
			}

			console.log(
				'🔍 Queue items to process:',
				queue.map((item) => ({
					id: item.id,
					title: item.title,
					hasContent: !!(item.summary || item.excerpt || '').trim(),
					contentLength: (item.summary || item.excerpt || '').trim()
						.length,
					summary: item.summary,
					excerpt: item.excerpt,
				}))
			);

			let updated = 0;
			for (const item of queue) {
				const content = (item.summary || item.excerpt || '').trim();
				console.log(`🔍 Processing item ${item.id}:`, {
					hasId: !!item.id,
					hasContent: !!content,
					contentLength: content.length,
					title: item.title,
				});

				if (!item.id || !content) {
					console.log(
						`⚠️ Skipping item ${item.id}: missing ${
							!item.id ? 'id' : 'content'
						}`
					);
					continue;
				}

				try {
					// Summarize single article
					console.log('📝 Calling summarizeArticlesBatch with:', {
						title: item.title || 'Untitled',
						contentLength: content.slice(0, 8000).length,
						source: item.source?.name,
						date: item.publishedAt,
						selectedModel: selectedModel?.id || 'gpt-4o-mini',
					});

					console.log(
						'🔧 pharosClient connected:',
						pharosClient.connected
					);
					console.log(
						'🔧 About to call pharosClient.summarizeArticlesBatch...'
					);

					// Ensure connection before calling
					if (!pharosClient.connected) {
						console.log(
							'🔄 Client not connected, attempting to connect...'
						);
						await pharosClient.connect();
						console.log('✅ Client connected successfully');
					}

					const result = await pharosClient.summarizeArticlesBatch(
						[
							{
								title: item.title || 'Untitled',
								content: content.slice(0, 8000),
								source: item.source?.name,
								date: item.publishedAt,
							},
						],
						'general',
						'brief',
						selectedModel?.id || 'gpt-4o-mini' // Use selected model or default
					);
					console.log(
						'🎯 textAnalysisClient.summarizeArticlesBatch completed with result:',
						result
					);

					console.log('📋 Summarization result:', result);

					const summaryText =
						typeof result === 'object' && result?.summary
							? String(result.summary)
							: typeof result === 'string'
							? result
							: JSON.stringify(result);

					console.log('📄 Processed summary text:', {
						summaryText,
						length: summaryText?.length,
						type: typeof summaryText,
					});

					if (summaryText && summaryText.length > 0) {
						console.log(
							`💾 Updating post ${item.id} with summary...`
						);
						const resp = await fetch(
							`/api/pharos/posts/${item.id}`,
							{
								method: 'PUT',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ summary: summaryText }),
							}
						);
						if (resp.ok) {
							updated += 1;
							console.log(
								`✅ Successfully updated post ${item.id}`
							);
						} else {
							const errorText = await resp.text();
							console.warn(
								'❌ Failed to update post',
								item.id,
								errorText
							);
						}
					} else {
						console.warn(
							'⚠️ No valid summary text generated for item',
							item.id
						);
					}
				} catch (articleError) {
					console.error('❌ Error processing article:', {
						articleId: item.id,
						title: item.title,
						error:
							articleError instanceof Error
								? articleError.message
								: String(articleError),
						stack:
							articleError instanceof Error
								? articleError.stack
								: undefined,
					});
					// Continue with next article instead of failing the whole batch
				}
			}

			console.log(
				`🎯 Final result: ${updated} articles were successfully updated`
			);
			alert(
				`Summarized and saved ${updated} article(s) to the database.`
			);
		} catch (e) {
			console.error('Failed batch summarize & save:', e);
			alert(
				`Failed to summarize articles: ${
					e instanceof Error ? e.message : e
				}`
			);
		} finally {
			setSummarizing(false);
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
								className='px-3 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-sm capitalize'
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
								className={`flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-800 border-b last:border-b-0 cursor-pointer transition-colors ${
									selection.isSelected(source.id)
										? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700'
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
							className='px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/50 hover:bg-blue-200 dark:hover:bg-blue-800/70 rounded'
						>
							Select All
						</button>
						<button
							onClick={selection.clearSelection}
							className='px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded'
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

					{/* Tool Selection */}
					<div className='border rounded-lg p-4 mb-4'>
						<h3 className='text-lg font-medium mb-3'>
							Scraping Tools
						</h3>
						<div className='grid grid-cols-2 gap-4'>
							<div>
								<label className='block text-sm font-medium mb-2'>
									Homepage Scraper:
								</label>
								<select
									value={homepageTool}
									onChange={(e) =>
										setHomepageTool(
											e.target.value as
												| 'firecrawl'
												| 'html'
										)
									}
									className='w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
								>
									<option value='html'>
										HTML Parser (Free)
									</option>
									<option value='firecrawl'>
										Firecrawl (Premium)
									</option>
								</select>
							</div>
							<div>
								<label className='block text-sm font-medium mb-2'>
									Article Extractor:
								</label>
								<select
									value={extractionTool}
									onChange={(e) =>
										setExtractionTool(
											e.target.value as
												| 'firecrawl'
												| 'html'
										)
									}
									className='w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
								>
									<option value='html'>
										HTML Parser (Free)
									</option>
									<option value='firecrawl'>
										Firecrawl (Premium)
									</option>
								</select>
							</div>
						</div>
					</div>

					{/* AI Model Selection */}
					<ModelSelector
						selectedModel={selectedModel?.id}
						onModelSelect={setSelectedModel}
						className='mb-4'
					/>

					<div className='border rounded-lg p-4'>
						{/* Main Homepage Scraping Button */}
						<button
							onClick={handleHomepageScraping}
							disabled={scraping || selection.count === 0}
							className='w-full px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed mb-3'
						>
							{scraping
								? 'Scraping...'
								: `Scrape ${Math.min(
										selection.count,
										2
								  )} Selected Sources (${
										homepageTool === 'html'
											? 'HTML - Free'
											: 'Firecrawl - Premium'
								  })`}
						</button>

						{/* Main Article Extraction Button */}
						<button
							onClick={handleArticleExtraction}
							disabled={scraping}
							className='w-full px-4 py-2 bg-purple-600 dark:bg-purple-700 text-white rounded hover:bg-purple-700 dark:hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed mb-3'
						>
							{`Extract Article Content (${
								extractionTool === 'html'
									? 'HTML - Free'
									: 'Firecrawl - Premium'
							})`}
						</button>

						{/* Extract Dock Items Content button */}
						<button
							onClick={handleExtractDockItemsContent}
							disabled={scraping || queue.length === 0}
							className='w-full px-4 py-2 bg-teal-600 dark:bg-teal-700 text-white rounded hover:bg-teal-700 dark:hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed mb-3'
						>
							Extract Content for Dock Items ({queue.length}{' '}
							items) - Streaming
						</button>

						{/* Summarize & Save button */}
						<button
							onClick={() => {
								console.log('🔘 Button clicked!', {
									queue,
									queueLength: queue.length,
								});
								handleSummarizeDockArticles();
							}}
							disabled={queue.length === 0 || summarizing}
							className='w-full px-4 py-2 mt-3 bg-orange-600 dark:bg-orange-700 text-white rounded hover:bg-orange-700 dark:hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed'
						>
							{summarizing
								? 'Summarizing & Saving...'
								: 'Summarize Dock Articles and Save to DB'}
						</button>

						{summarizing && (
							<div className='mt-3 text-center text-sm text-gray-600'>
								Generating summaries and updating posts...
							</div>
						)}

						{selection.count > 2 && (
							<div className='mb-3 p-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded text-sm text-yellow-800 dark:text-yellow-200'>
								⚠️ Only the first 2 sources will be scraped to
								avoid timeouts. Deselect some sources or scrape
								in multiple batches.
							</div>
						)}

						{/* Load from Database button */}
						<button
							onClick={handleLoadFromDatabase}
							disabled={loading}
							className='w-full px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
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
							<div className='mt-3 p-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded'>
								<h4 className='font-semibold text-indigo-800 dark:text-indigo-200'>
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
											<h4 className='font-semibold text-lg mb-3 flex items-center justify-between gap-2'>
												<span>
													{sourceName}
													<span className='text-sm text-gray-600 ml-2'>
														({sourcePosts.length}{' '}
														articles)
													</span>
												</span>
												<span className='flex gap-1'>
													{areAllSourcePostsInDock(
														sourcePosts
													) ? (
														<button
															onClick={(e) => {
																e.stopPropagation();
																handleRemoveAllSourcePosts(
																	sourcePosts
																);
															}}
															className='text-xs px-2 py-1 rounded bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-800/60 text-red-700 dark:text-red-200'
															title={
																"Remove all this source's articles from dock"
															}
														>
															Deselect All
														</button>
													) : (
														<button
															onClick={(e) => {
																e.stopPropagation();
																handleAddAllSourcePosts(
																	sourcePosts
																);
															}}
															className='text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-800/60 text-blue-700 dark:text-blue-200'
															title={
																"Add all this source's articles to dock"
															}
														>
															Select All
														</button>
													)}
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
																			post.title ||
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
																className={`flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-800 border-b last:border-b-0 cursor-pointer transition-colors rounded-sm ${
																	inDock
																		? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700'
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
																		{post.title ||
																			post.articleText?.split(
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
