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
import { AlertCircleIcon, PlusIcon, DatabaseIcon } from 'lucide-react';
import { useDocumentDock } from '@/lib/context/DocumentDockContext';

export default function NewsScraperExample() {
	const {
		queue,
		removeFromQueue,
		clearQueue,
		reorderQueue,
		setQueue,
		addToQueue,
	} = useDocumentDock();
	
	// Selection state for documents
	const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
	
	// Add to DocumentDock queue using context
	const handleAddSelectedToDock = () => {
		const currentDocuments = Object.values(
			showGrouped ? groupedDocuments : documents
		).flat();
		const selectedDocuments = currentDocuments.filter(
			(doc) => doc.id && selectedDocumentIds.includes(doc.id)
		);
		selectedDocuments.forEach((doc) => {
			addToQueue({
				id: doc.id as string,
				title: doc.title || 'Untitled',
				url: doc.documentUrl || '',
				type: 'document',
				source: {
					site: doc.documentGroup || 'Unknown Source',
					domain: doc.documentGroup || 'Unknown Source',
				},
				publishDate: doc.earliestDate?.toISOString(),
				excerpt: doc.summary || undefined,
			});
		});
		setSelectedDocumentIds([]);
	};

	// Helper functions for document selection
	const handleSelectAllDocuments = () => {
		const currentDocuments = Object.values(
			showGrouped ? groupedDocuments : documents
		).flat();
		const allDocumentIds = currentDocuments
			.map((doc) => doc.id)
			.filter(Boolean) as string[];
		setSelectedDocumentIds(allDocumentIds);
	};

	const handleClearSelection = () => {
		setSelectedDocumentIds([]);
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
	
	const [scraping, setScraping] = useState(false);
	const [grouping, setGrouping] = useState(false);
	const [loading, setLoading] = useState(false);
	const [textAnalysisClient] = useState(() => new TextAnalysisMCPClient());
	const [showGrouped, setShowGrouped] = useState(false);
	const [useOpenAI, setUseOpenAI] = useState(true); // Enable OpenAI by default

	// Auto-connect and load grouped documents from localStorage on mount
	useEffect(() => {
		if (!mcp.isConnected && !mcp.isLoading) {
			mcp.connect();
		}

		// Connect to text analysis server
		textAnalysisClient.connect().catch(console.error);

		// Load grouped documents from localStorage
		try {
			const storedGrouped = localStorage.getItem('groupedDocuments');
			if (storedGrouped) {
				setGroupedDocuments(JSON.parse(storedGrouped));
				setShowGrouped(true);
			}
		} catch (err) {
			console.error(
				'Error loading grouped documents from localStorage:',
				err
			);
		}

		return () => {
			// Don't manually disconnect documentClient since it extends mcp client
			textAnalysisClient.disconnect().catch(console.error);
		};
	}, [mcp.isConnected, mcp.isLoading, mcp.connect, textAnalysisClient]);

	const handleScrapeSelected = async () => {
		if (selection.selectedSources.length === 0) {
			alert('Please select at least one news source');
			return;
		}

		setScraping(true);
		try {
			// Limit to max 3 sources to avoid timeouts
			const sourcesToScrape = selection.selectedSources.slice(0, 3);
			console.log(`🚀 Scraping ${sourcesToScrape.length} sources:`, sourcesToScrape);
			
			// Use the existing MCP client instead of separate document client
			const result = await mcp.scrapeSelectedSources(
				sourcesToScrape,
				{
					limit: 3, // Reduce limit to avoid timeouts
					includeMedia: true,
					includeSections: true,
				}
			);
			
			console.log('📥 Raw scraping result:', result);
			
			// TODO: Move article-to-document conversion to the backend
			// The MCP server should return documents directly instead of articles
			// This conversion logic belongs in the news scraper server, not the client
			// Benefits: reduces client processing, ensures consistent conversion, better error handling
			
			// Convert articles to documents manually
			const documentsData: Record<string, Array<Omit<Document, 'createdAt' | 'updatedAt'>>> = {};
			
			for (const [sourceName, articles] of Object.entries(result)) {
				console.log(`🔄 Converting ${articles.length} articles from ${sourceName}`);
				documentsData[sourceName] = articles.map((article) => {
					// Convert NewsArticlePreview to Document format
					const { newsArticleToDocument } = require('@shared/backend/src/utils/articleToDocument');
					return newsArticleToDocument(article);
				});
			}
			
			console.log('✅ Converted to documents:', documentsData);
			setDocuments(documentsData);
			setShowGrouped(false); // Reset to show scraped view
			
			// TODO: Move this auto-save logic to the backend MCP server
			// The news scraper MCP server should automatically save to DB after scraping
			// This would eliminate the need for separate conversion + save steps
			// Consider adding a `autoSave: boolean` parameter to scrape_news_homepages tool
			
			// Optional: Save to database
			const shouldSave = confirm('Save these documents to the database?');
			if (shouldSave) {
				try {
					console.log('💾 Saving documents to database...');
					
					// TODO: Replace this frontend API call with backend integration
					// The MCP server should handle document persistence directly
					// This reduces client-server round trips and ensures data consistency
					
					// We need to send the original articles, not the converted documents
					const allArticles = Object.values(result).flat();
					
					const saveResponse = await fetch('/api/articles/to-documents', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							articles: allArticles,
							type: 'news-preview'
						}),
					});
					
					if (saveResponse.ok) {
						const saveResult = await saveResponse.json();
						console.log('✅ Documents saved to database:', saveResult);
						alert(`Successfully saved ${saveResult.createdDocuments?.length || saveResult.created || 0} documents to database!`);
					} else {
						const errorText = await saveResponse.text();
						console.error('❌ Failed to save documents:', errorText);
						alert('Failed to save documents to database');
					}
				} catch (saveError) {
					console.error('❌ Error saving documents:', saveError);
					alert('Error saving documents to database');
				}
			}
		} catch (error) {
			console.error('❌ Scraping failed:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			alert(`Scraping failed: ${errorMessage}. Try selecting fewer sources or check if the news servers are running properly.`);
		} finally {
			setScraping(false);
		}
	};

	const handleLoadFromDatabase = async () => {
		if (loading) return;
		
		setLoading(true);
		try {
			console.log('📖 Loading news documents from database...');
			
			const response = await fetch('/api/news/documents');
			if (!response.ok) {
				throw new Error(`Failed to load documents: ${response.statusText}`);
			}
			
			const data = await response.json();
			console.log('✅ Loaded documents from database:', data);
			
			// Convert database documents back to the format expected by the component
			const documentsData: Record<string, Array<Omit<Document, 'createdAt' | 'updatedAt'>>> = {};
			
			// Group documents by source/documentGroup
			data.documents.forEach((doc: Document) => {
				const source = doc.documentGroup || 'Unknown Source';
				if (!documentsData[source]) {
					documentsData[source] = [];
				}
				
				// Convert dates from strings back to Date objects
				const convertedDoc = {
					...doc,
					processingDate: doc.processingDate ? new Date(doc.processingDate) : null,
					earliestDate: doc.earliestDate ? new Date(doc.earliestDate) : null,
					latestDate: doc.latestDate ? new Date(doc.latestDate) : null,
				};
				
				// Remove createdAt/updatedAt as they're not in our component type
				const { createdAt, updatedAt, ...docWithoutTimestamps } = convertedDoc;
				documentsData[source].push(docWithoutTimestamps);
			});
			
			setDocuments(documentsData);
			setShowGrouped(false); // Show raw documents when loading from DB
			
			alert(`Successfully loaded ${data.documents.length} news documents from database!`);
		} catch (error) {
			console.error('❌ Failed to load documents:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			alert(`Failed to load documents: ${errorMessage}`);
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
			const articlesForAnalysis: NewsArticlePreview[] = allDocuments.map(doc => ({
				id: doc.id,
				title: doc.title || 'Untitled',
				link: doc.documentUrl || '',
				excerpt: doc.summary || '',
				source: {
					site: doc.documentGroup || 'Unknown Source',
					domain: doc.documentGroup || 'Unknown Source'
				}
			}));

			const grouped = await textAnalysisClient.groupArticlesByCurrentEvents(
				articlesForAnalysis,
				{
					maxGroups: 8,
					minArticlesPerGroup: 2,
					useOpenAI: useOpenAI, // Use the toggle state
				}
			);
			
			// Convert back to documents format
			const groupedDocs: Record<string, Array<Omit<Document, 'createdAt' | 'updatedAt'>>> = {};
			for (const [groupName, articles] of Object.entries(grouped)) {
				groupedDocs[groupName] = (articles as any[]).map((article: any) => {
					const originalDoc = allDocuments.find(doc => doc.id === article.id);
					return originalDoc!;
				});
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
		selection.selectAll(sourcesInCategory.slice(0, 3)); // Limit to 3 for demo
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
					].map((category) => (
						<button
							key={category}
							onClick={() => handleSelectByCategory(category)}
							className='px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm capitalize'
						>
							{category} (
							{
								mcp.sources.filter(
									(s: any) => s.category === category
								).length
							}
							)
						</button>
					))}
				</div>
			</div>

			{/* Source Selection */}
			<div className='grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6'>
				<div>
					<h2 className='text-xl font-semibold mb-3'>
						Select News Sources ({selection.count} selected)
					</h2>
					<div className='max-h-96 overflow-y-auto border rounded-lg'>
						{mcp.sources.map((source: any) => (
							<label
								key={source.id}
								className='flex items-center p-3 hover:bg-gray-50 border-b last:border-b-0'
							>
								<input
									type='checkbox'
									checked={selection.isSelected(source.id)}
									onChange={() =>
										selection.toggleSource(source.id)
									}
									className='mr-3'
								/>
								<div className='flex-1'>
									<div className='font-medium'>
										{source.name}
									</div>
									<div className='text-sm text-gray-600 capitalize'>
										{source.category} • {source.method}
									</div>
								</div>
							</label>
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
					<h2 className='text-xl font-semibold mb-3'>News Documents</h2>
					<div className='border rounded-lg p-4'>
						<button
							onClick={handleScrapeSelected}
							disabled={scraping || selection.count === 0}
							className='w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed mb-3'
						>
							{scraping
								? 'Scraping...'
								: `Scrape ${selection.count} Selected Sources as Documents`}
						</button>

						{/* Load from Database button */}
						<button
							onClick={handleLoadFromDatabase}
							disabled={loading}
							className='w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
						>
							<DatabaseIcon className='w-4 h-4' />
							{loading ? 'Loading...' : 'Load News Documents from Database'}
						</button>

						{loading && (
							<div className='mt-3 text-center'>
								<div className='animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto'></div>
								<p className='text-sm text-gray-600 mt-2'>
									Loading news documents from database...
								</p>
							</div>
						)}

						{scraping && (
							<div className='mt-3 text-center'>
								<div className='animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto'></div>
								<p className='text-sm text-gray-600 mt-2'>
									Scraping news from selected sources and converting to unified document format...
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
							<div className='mb-3 flex items-center gap-2'>
								<input
									type='checkbox'
									id='useOpenAI'
									checked={useOpenAI}
									onChange={(e) =>
										setUseOpenAI(e.target.checked)
									}
									className='w-4 h-4'
								/>
								<label
									htmlFor='useOpenAI'
									className='text-sm text-gray-700'
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
											useOpenAI ? '(AI)' : '(Keywords)'
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
										onClick={() => setShowGrouped(false)}
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
						<div className='flex gap-2'>
							<button
								onClick={handleSelectAllDocuments}
								className='px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 rounded'
							>
								Select All
							</button>
							<button
								onClick={handleClearSelection}
								className='px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded'
							>
								Clear Selection
							</button>
							{selectedDocumentIds.length > 0 && (
								<span className='px-3 py-1 text-sm bg-green-100 text-green-800 rounded'>
									{selectedDocumentIds.length} selected
								</span>
							)}
						</div>
					</div>
					<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
						{Object.entries(
							showGrouped ? groupedDocuments : documents
						).map(([groupName, groupDocuments]) => (
							<div
								key={groupName}
								className='border rounded-lg p-4 h-96 flex flex-col'
							>
								<h3 className='font-semibold text-lg mb-3'>
									{showGrouped
										? groupName
										: groupDocuments[0]?.documentGroup ||
										  groupName}
									<span className='text-sm text-gray-500 ml-2'>
										({groupDocuments.length} documents)
									</span>
								</h3>
								<ScrollArea className='h-80 flex-1'>
									<div className='space-y-3 pr-4'>
										{groupDocuments.map((document, idx) => (
											<div
												key={`${groupName}-${
													document.id ||
													document.documentUrl ||
													idx
												}`}
												className={`border-b pb-3 last:border-b-0 flex items-start gap-2 ${
													document.id &&
													selectedDocumentIds.includes(
														document.id
													)
														? 'bg-blue-50'
														: ''
												}`}
											>
												<input
													type='checkbox'
													checked={
														!!(
															document.id &&
															selectedDocumentIds.includes(
																document.id
															)
														)
													}
													onChange={(e) => {
														if (!document.id) return;

														setSelectedDocumentIds(
															(prev) => {
																if (!document.id)
																	return prev;
																if (
																	e.target
																		.checked
																) {
																	return [
																		...new Set(
																			[
																				...prev,
																				document.id,
																			]
																		),
																	];
																} else {
																	return prev.filter(
																		(id) =>
																			id !==
																			document.id
																	);
																}
															}
														);
													}}
													className='mt-1 mr-2'
												/>
												<div className='flex-1'>
													<a
														href={document.documentUrl || '#'}
														target='_blank'
														rel='noopener noreferrer'
														className='text-blue-600 hover:text-blue-800 font-medium text-sm leading-tight block'
													>
														{document.title || 'Untitled Document'}
													</a>
													{document.summary && (
														<p className='text-xs text-gray-600 mt-1 line-clamp-2'>
															{document.summary}
														</p>
													)}
													<div className='flex items-center gap-2 mt-1'>
														{document.document && 
															typeof document.document === 'object' && 
															(document.document as any)?.imageUrl && (
															<span className='text-xs text-gray-500'>
																📷 Image
															</span>
														)}
														<span className='text-xs text-gray-500'>
															{document.documentGroup || 'Unknown Source'}
														</span>
														{document.earliestDate && (
															<span className='text-xs text-gray-500'>
																{new Date(document.earliestDate).toLocaleDateString()}
															</span>
														)}
													</div>
												</div>
											</div>
										))}
									</div>
								</ScrollArea>
							</div>
						))}
					</div>
					{/* Add to DocumentDock button at the bottom of all results */}
					<div className='w-full flex justify-between items-center mt-6 p-4 bg-gray-50 rounded-lg border'>
						<div className='text-sm text-gray-600'>
							{selectedDocumentIds.length > 0 
								? `${selectedDocumentIds.length} document${selectedDocumentIds.length === 1 ? '' : 's'} selected`
								: 'Select documents using the checkboxes above to add them to Document Dock'
							}
						</div>
						{selectedDocumentIds.length > 0 && (
							<button
								onClick={handleAddSelectedToDock}
								className='px-6 py-3 bg-primary text-primary-foreground rounded text-base font-semibold flex items-center gap-2 shadow-lg hover:bg-primary/90 transition-colors'
							>
								<PlusIcon className='w-5 h-5' />
								Add to Document Dock ({selectedDocumentIds.length})
							</button>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
