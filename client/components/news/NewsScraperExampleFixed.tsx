'use client';

import React, { useEffect, useState } from 'react';
import {
	useMCPClient,
	useSelectedSources,
} from '../../hooks/news/use-mcp-client';
import { TextAnalysisMCPClient } from '@/lib/text-analysis-client';
import { DocumentNewsScraperClient } from '@/lib/document-news-client';
import type { Document } from '@prisma/client';
import type { NewsArticlePreview } from '@shared/types';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { ScrollArea } from '../ui/scroll-area';
import { AlertCircleIcon } from 'lucide-react';
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
	const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>(
		[]
	);

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
	const [textAnalysisClient] = useState(() => new TextAnalysisMCPClient());
	const [documentClient] = useState(() => new DocumentNewsScraperClient());
	const [showGrouped, setShowGrouped] = useState(false);
	const [useOpenAI, setUseOpenAI] = useState(true); // Enable OpenAI by default

	// Auto-connect and load grouped documents from localStorage on mount
	useEffect(() => {
		if (!mcp.isConnected && !mcp.isLoading) {
			mcp.connect();
		}

		// Connect document client
		documentClient.connect().catch(console.error);

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
			documentClient.disconnect().catch(console.error);
			textAnalysisClient.disconnect().catch(console.error);
		};
	}, [
		mcp.isConnected,
		mcp.isLoading,
		mcp.connect,
		textAnalysisClient,
		documentClient,
	]);

	const handleScrapeSelected = async () => {
		if (selection.selectedSources.length === 0) {
			alert('Please select at least one news source');
			return;
		}

		setScraping(true);
		try {
			const result = await documentClient.scrapeNewsHomepagesAsDocuments({
				sources: selection.selectedSources
					.map((sourceId: string) =>
						mcp.sources.find((s: any) => s.id === sourceId)
					)
					.filter(Boolean),
				limit: 5,
				includeMedia: true,
				includeSections: true,
			});
			setDocuments(result);
			setShowGrouped(false); // Reset to show scraped view
		} catch (error) {
			console.error('Scraping failed:', error);
		} finally {
			setScraping(false);
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
					<h2 className='text-xl font-semibold mb-3'>
						Scrape News as Documents
					</h2>
					<div className='border rounded-lg p-4'>
						<button
							onClick={handleScrapeSelected}
							disabled={scraping || selection.count === 0}
							className='w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
						>
							{scraping
								? 'Scraping...'
								: `Scrape ${selection.count} Selected Sources as Documents`}
						</button>

						{scraping && (
							<div className='mt-3 text-center'>
								<div className='animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto'></div>
								<p className='text-sm text-gray-600 mt-2'>
									Scraping news from selected sources and
									converting to unified document format...
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
					<h2 className='text-xl font-semibold mb-4'>
						{showGrouped
							? 'Documents by Current Events'
							: 'Latest Documents'}
					</h2>
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
														if (!document.id)
															return;

														setSelectedDocumentIds(
															(prev) => {
																if (
																	!document.id
																)
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
														href={
															document.documentUrl ||
															'#'
														}
														target='_blank'
														rel='noopener noreferrer'
														className='text-blue-600 hover:text-blue-800 font-medium text-sm leading-tight block'
													>
														{document.title ||
															'Untitled Document'}
													</a>
													{document.summary && (
														<p className='text-xs text-gray-600 mt-1 line-clamp-2'>
															{document.summary}
														</p>
													)}
													<div className='flex items-center gap-2 mt-1'>
														{document.document &&
															typeof document.document ===
																'object' &&
															(
																document.document as any
															)?.imageUrl && (
																<span className='text-xs text-gray-500'>
																	📷 Image
																</span>
															)}
														<span className='text-xs text-gray-500'>
															{document.documentGroup ||
																'Unknown Source'}
														</span>
														{document.earliestDate && (
															<span className='text-xs text-gray-500'>
																{new Date(
																	document.earliestDate
																).toLocaleDateString()}
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
					{selectedDocumentIds.length > 0 && (
						<div className='w-full flex justify-end mt-6'>
							<button
								onClick={handleAddSelectedToDock}
								className='px-6 py-3 bg-primary text-primary-foreground rounded text-base font-semibold flex items-center gap-2 shadow-lg'
							>
								Add Selected to Document Dock (
								{selectedDocumentIds.length})
							</button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
