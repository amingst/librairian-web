'use client';
// Add type declaration at the top of the file
declare global {
	interface Window {
		updateDocumentDock?: () => void;
		documentDetailsCache?: Record<string, any>;
	}
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
	useDocumentDock,
	DocumentItem,
} from '@/lib/context/DocumentDockContext';
import {
	X,
	GripVertical,
	ChevronUp,
	ChevronDown,
	Mic,
	Radio,
	MessageSquare,
	FileText,
	Image,
	AlignLeft,
	Play,
	Pause,
	Loader,
	FileSearch,
	User,
	MapPin,
	Package,
	ChevronLeft,
	ChevronRight,
} from 'lucide-react';
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	DragEndEvent,
	DragOverlay,
	DragStartEvent,
} from '@dnd-kit/core';
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Sheet, SheetContent, SheetTrigger } from './sheet';
import { ScrollArea } from './scroll-area';
import { useSidebar } from './sidebar';
import InvestigationsPanel from './InvestigationsPanel';
import SortableDocumentItem from './SortableDocumentItem';
import AudioPlayerHeader from './AudioPlayerHeader';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.oip.onl';

// Sortable item component for drag and drop

export function DocumentDock() {
	const {
		queue,
		removeFromQueue,
		clearQueue,
		reorderQueue,
		setQueue,
		addToQueue,
	} = useDocumentDock();
	const { state: sidebarState, isMobile } = useSidebar();
	const [isOpen, setIsOpen] = useState(false);
	const [documentDetails, setDocumentDetails] = useState<Record<string, any>>(
		{}
	);
	const [activeTab, setActiveTab] = useState<Record<string, string>>({});
	const [expandedSection, setExpandedSection] = useState<
		Record<string, string | null>
	>({});
	const [currentPage, setCurrentPage] = useState<Record<string, number>>({});
	const [podcastStatus, setPodcastStatus] = useState<
		'idle' | 'generating' | 'ready' | 'error'
	>('idle');
	const [podcastUrl, setPodcastUrl] = useState<string | null>(null);
	const [podcastProgress, setPodcastProgress] = useState<string>('');
	const [reportStatus, setReportStatus] = useState<
		'idle' | 'generating' | 'ready' | 'error'
	>('idle');
	const [reportUrl, setReportUrl] = useState<string | null>(null);
	const [reportProgress, setReportProgress] = useState<string>('');
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentPlayer, setCurrentPlayer] = useState<
		'podcast' | 'report' | null
	>(null);
	const [tokenCount, setTokenCount] = useState<number>(0);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const [pageContentLoading, setPageContentLoading] = useState<
		Record<string, boolean>
	>({});
	const [pageContent, setPageContent] = useState<Record<string, any>>({});
	const [playlist, setPlaylist] = useState<
		Array<{
			id: string;
			title: string;
			showName: string;
			tags: string[];
			documentIds: string[];
			audioUrl: string;
			timestamp: string;
		}>
	>([]);
	const [currentPlaylistItem, setCurrentPlaylistItem] = useState<
		number | null
	>(null);
	const [showPlaylist, setShowPlaylist] = useState<boolean>(false);
	const [activeId, setActiveId] = useState<string | null>(null);

	// Load saved playlists from localStorage
	useEffect(() => {
		try {
			const savedPlaylists = JSON.parse(
				localStorage.getItem('investigativeReportPlaylists') || '[]'
			);
			setPlaylist(savedPlaylists);
		} catch (err) {
			console.error('Error loading saved playlists:', err);
		}
	}, []);

	// Helper functions for document display
	const handleTabChange = (itemId: string, tab: string) => {
		setActiveTab((prev) => ({ ...prev, [itemId]: tab }));
	};

	const getPageImageUrl = (docId: string, pageNum: number) => {
		return `${API_BASE_URL}/api/jfk/media?id=${docId}&type=image&filename=page-${pageNum}.png`;
	};

	const toggleExpandedSection = (itemId: string, section: string) => {
		setExpandedSection((prev) => ({
			...prev,
			[itemId]: prev[itemId] === section ? null : section,
		}));
	};

	// Configure sensors for drag and drop
	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	// Handle drag start
	const handleDragStart = (event: DragStartEvent) => {
		setActiveId(event.active.id as string);
	};

	// Handle drag end
	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;

		if (active.id !== over?.id) {
			const oldIndex = queue.findIndex((item) => item.id === active.id);
			const newIndex = queue.findIndex((item) => item.id === over?.id);

			if (oldIndex !== -1 && newIndex !== -1) {
				reorderQueue(oldIndex, newIndex);
			}
		}

		setActiveId(null);
	};

	// Fetch document details for items in queue
	useEffect(() => {
		const fetchDocumentDetails = async () => {
			const details: Record<string, any> = {};

			for (const item of queue) {
				if (!documentDetails[item.id]) {
					try {
						// First check if there's cached data available from window.documentDetailsCache
						if (
							typeof window !== 'undefined' &&
							window.documentDetailsCache &&
							window.documentDetailsCache[item.id]
						) {
							console.log(
								`Using cached document details for ${item.id}`
							);
							details[item.id] =
								window.documentDetailsCache[item.id];
						} else {
							// No cached data, fetch from API
							console.log(
								`Fetching document details for ${item.id}`
							);

							// Try to fetch from the internal API first
							const response = await fetch(
								`${API_BASE_URL}/api/jfk/documents/${item.id}`
							);

							if (response.ok) {
								const data = await response.json();
								details[item.id] = data;
							} else {
								// If internal API fails, try the external API
								console.log(
									`Internal API failed for ${item.id}, trying external API`
								);
								const externalResponse = await fetch(
									`${API_BASE_URL}/api/jfk/media?id=${item.id}&type=analysis&getLatestPageData=true`
								);

								if (externalResponse.ok) {
									const data = await externalResponse.json();
									details[item.id] = data;
								} else {
									console.error(
										`Failed to fetch details for document ${item.id} from both APIs`
									);
								}
							}
						}

						// Initialize tabs and current page if not set
						if (!activeTab[item.id]) {
							setActiveTab((prev) => ({
								...prev,
								[item.id]: 'summary',
							}));
						}
						if (!currentPage[item.id]) {
							setCurrentPage((prev) => ({
								...prev,
								[item.id]: 1,
							}));
						}
					} catch (error) {
						console.error(
							`Error fetching details for document ${item.id}:`,
							error
						);
					}
				}
			}

			if (Object.keys(details).length > 0) {
				setDocumentDetails((prev) => ({ ...prev, ...details }));
			}
		};

		fetchDocumentDetails();
	}, [queue, documentDetails, activeTab, currentPage]);

	// Function to get full document data
	const getFullDocumentData = async (docId: string) => {
		try {
			const response = await fetch(
				`${API_BASE_URL}/api/jfk/media?id=${docId}&type=analysis&getLatestPageData=true`
			);
			if (response.ok) {
				return await response.json();
			} else {
				console.error(
					`Failed to fetch full data for document ${docId}`
				);
				return null;
			}
		} catch (error) {
			console.error(
				`Error fetching full data for document ${docId}:`,
				error
			);
			return null;
		}
	};

	// Function to estimate tokens in text
	const estimateTokens = (text: string): number => {
		// Rough estimate: 1 token ≈ 4 characters
		return Math.ceil(text.length / 4);
	};

	// Function to calculate total tokens for investigative report
	const calculateReportTokens = async () => {
		if (queue.length === 0) {
			setTokenCount(0);
			return;
		}

		try {
			// Get full data for each document in the queue
			const fullDocumentsData = await Promise.all(
				queue.map(async (item) => {
					const fullData = await getFullDocumentData(item.id);
					console.log('fullData', fullData);
					return { item, fullData };
				})
			);

			let totalTokens = 0;

			for (const { fullData } of fullDocumentsData) {
				if (!fullData) continue;

				// Count tokens in summary
				if (fullData.summary) {
					totalTokens += estimateTokens(fullData.summary);
				}

				// Count tokens in pages
				if (fullData.pages && Array.isArray(fullData.pages)) {
					for (const page of fullData.pages) {
						// Count page summary
						if (page.summary) {
							totalTokens += estimateTokens(page.summary);
						}

						// Count page content
						if (fullData.fullText) {
							const pageMarker = `--- PAGE ${page.pageNumber} ---`;
							const nextPageMarker = `--- PAGE ${
								page.pageNumber + 1
							} ---`;

							const startIndex =
								fullData.fullText.indexOf(pageMarker);
							if (startIndex !== -1) {
								const endIndex = fullData.fullText.indexOf(
									nextPageMarker,
									startIndex
								);
								const pageContent =
									endIndex !== -1
										? fullData.fullText.substring(
												startIndex,
												endIndex
										  )
										: fullData.fullText.substring(
												startIndex
										  );
								totalTokens += estimateTokens(pageContent);
							}
						}
					}
				}
			}

			setTokenCount(totalTokens);
		} catch (error) {
			console.error('Error calculating tokens:', error);
			setTokenCount(0);
		}
	};

	// Update token count when queue changes
	useEffect(() => {
		calculateReportTokens();
	}, [queue]);

	// Function to handle metadata from report generation
	const handleReportMetadata = (metadataEvent: any) => {
		try {
			console.log('Received metadata message:', metadataEvent);

			if (metadataEvent.reportTitle) {
				// Get current report URL to use as ID
				const reportId =
					currentPlayer === 'report' && reportUrl
						? reportUrl.split('id=')[1]
						: `report-${Date.now()}`;

				// Clean up tags - remove prefix instructions that might be in the first tags
				const cleanTags = Array.isArray(metadataEvent.reportTags)
					? metadataEvent.reportTags.filter(
							(tag: string) =>
								!tag.includes(
									'Based on the dialogue provided'
								) &&
								!tag.includes(
									'here is a comma-separated list of relevant tags'
								) &&
								tag.trim().length > 0
					  )
					: [];

				const reportMetadata = {
					id: reportId,
					title: metadataEvent.reportTitle,
					showName: metadataEvent.showName || 'Investigative Report',
					tags: cleanTags,
					documentIds: queue.map((item) => item.id),
					audioUrl: '',
					timestamp: new Date().toISOString(),
				};

				console.log('Creating report metadata:', reportMetadata);

				// Only add if we have a valid audioUrl
				if (reportMetadata.audioUrl) {
					// Add to playlist state
					setPlaylist((prev) => {
						// Check if this report is already in the playlist (by audioUrl)
						const exists = prev.some(
							(item) => item.audioUrl === reportMetadata.audioUrl
						);
						if (!exists) {
							const updatedPlaylist = [...prev, reportMetadata];

							// Save to localStorage
							try {
								localStorage.setItem(
									'investigativeReportPlaylists',
									JSON.stringify(updatedPlaylist)
								);
								console.log(
									'Saved updated playlist to localStorage:',
									updatedPlaylist
								);
							} catch (storageErr) {
								console.error(
									'Error saving to localStorage:',
									storageErr
								);
							}

							// Set as current playlist item and show the playlist
							setTimeout(() => {
								setCurrentPlaylistItem(
									updatedPlaylist.length - 1
								);
								setShowPlaylist(true);

								// Prepare audio for playing in the sidebar instead of full-width player
								if (audioRef.current) {
									audioRef.current.src =
										reportMetadata.audioUrl;
									audioRef.current.load();
								}
							}, 100);

							return updatedPlaylist;
						}
						return prev;
					});

					console.log('Added report to playlist:', reportMetadata);
				} else {
					console.warn(
						'No audio URL found for report, skipping playlist addition'
					);
				}
			}
		} catch (err) {
			console.error('Error processing metadata:', err);
		}
	};

	// Function to generate podcast
	const generatePodcast = async () => {
		if (queue.length === 0) return;

		setPodcastStatus('generating');
		setPodcastProgress('Starting podcast generation...');
		setPodcastUrl(null);

		// Create an abort controller for the fetch
		const controller = new AbortController();
		const signal = controller.signal;

		try {
			// Get full data for each document in the queue
			const fullDocuments = await Promise.all(
				queue.map(async (item) => {
					const fullData = await getFullDocumentData(item.id);
					return {
						id: item.id,
						title: item.title || item.id,
						url: `/jfk-files/${item.id}`,
						type: 'document',
						content: fullData?.fullText || '', // Important: Backend expects 'content' field
						summary: fullData?.summary || '',
						fullText: fullData?.fullText || '',
						pageCount: fullData?.pageCount || 1,
					};
				})
			);

			// Filter out any documents that failed to fetch
			const articles = fullDocuments.filter(
				(doc) => doc.content && doc.content.length > 0
			);

			if (articles.length === 0) {
				throw new Error('Failed to fetch document data');
			}

			// Use named hosts that match what the backend expects - based on the browser extension
			const selectedHosts = ['hypatia', 'socrates'];

			// Prepare the request body
			const requestBody = {
				articles,
				selectedHosts,
				targetLengthSeconds: 300, // 5 minutes default
			};

			console.log(
				'Sending podcast request:',
				JSON.stringify(requestBody)
			);

			// Set up event source to process the SSE response directly from the POST request
			const eventSource = new EventSource(
				`${API_BASE_URL}/api/generate/podcast`
			);

			// Send the POST request
			fetch(`${API_BASE_URL}/api/generate/podcast`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requestBody),
				signal,
			}).catch((error) => {
				console.error('Error with podcast fetch:', error);
				setPodcastStatus('error');
				setPodcastProgress('Error starting podcast generation');
				eventSource.close();
				// No need to throw here as we're handling the error
			});

			// Handle SSE events
			eventSource.addEventListener('generatingPodcast', (event) => {
				try {
					const data =
						typeof event.data === 'string'
							? event.data.replace(/^"/, '').replace(/"$/, '')
							: event.data;
					setPodcastProgress(data);
				} catch (e) {
					setPodcastProgress('Generating podcast...');
				}
			});

			eventSource.addEventListener('progress', (event) => {
				try {
					const data =
						typeof event.data === 'string'
							? event.data.replace(/^"/, '').replace(/"$/, '')
							: event.data;
					setPodcastProgress(data);
				} catch (e) {
					setPodcastProgress('Processing...');
				}
			});

			eventSource.addEventListener('podcastComplete', (event) => {
				try {
					let data;
					if (typeof event.data === 'string') {
						// Try to parse the data, removing any extra quotes
						data = JSON.parse(
							event.data.replace(/^"/, '').replace(/"$/, '')
						);
					} else {
						data = event.data;
					}

					setPodcastStatus('ready');
					setPodcastUrl(
						`${API_BASE_URL}/api/generate/media?id=${data.podcastFile}`
					);
				} catch (e) {
					console.error('Error parsing podcast complete event:', e);
					setPodcastStatus('error');
					setPodcastProgress('Error processing podcast data');
				} finally {
					eventSource.close();
					controller.abort(); // Abort the fetch request if it's still ongoing
				}
			});

			eventSource.addEventListener('error', (event) => {
				console.error('Podcast generation error:', event);
				setPodcastStatus('error');
				setPodcastProgress('Error generating podcast');
				eventSource.close();
				controller.abort(); // Abort the fetch request if it's still ongoing
			});

			eventSource.addEventListener('ping', (event) => {
				console.log('Podcast generation connection alive:', event.data);
			});

			// Handle connection errors
			eventSource.onerror = () => {
				console.error('EventSource connection error');
				setPodcastStatus('error');
				setPodcastProgress('Connection error');
				eventSource.close();
				controller.abort(); // Abort the fetch request if it's still ongoing
			};
		} catch (error) {
			console.error('Error initiating podcast generation:', error);
			setPodcastStatus('error');
			setPodcastProgress(
				error instanceof Error ? error.message : 'Unknown error'
			);
		}
	};

	// Function to generate investigative report
	const generateInvestigativeReport = async () => {
		if (queue.length === 0) return;

		setReportStatus('generating');
		setReportProgress('Starting investigative report generation...');
		setReportUrl(null);

		// Create an abort controller for the fetch
		const controller = new AbortController();
		const signal = controller.signal;

		try {
			// Get full data for each document in the queue
			const fullDocumentsData = await Promise.all(
				queue.map(async (item) => {
					const fullData = await getFullDocumentData(item.id);
					return { item, fullData };
				})
			);

			// Format data for the investigative report API
			// First, we'll create individual document entries for each page
			let documents = [];
			let allNames = new Set<string>();
			let allDates = new Set<string>();
			let allPlaces = new Set<string>();
			let allObjects = new Set<string>();

			for (const { item, fullData } of fullDocumentsData) {
				if (!fullData) continue;

				// Add to metadata collections
				if (fullData.allNames)
					fullData.allNames.forEach((name: string) =>
						allNames.add(name)
					);
				if (fullData.allDates)
					fullData.allDates.forEach((date: string) =>
						allDates.add(date)
					);
				if (fullData.allPlaces)
					fullData.allPlaces.forEach((place: string) =>
						allPlaces.add(place)
					);
				if (fullData.allObjects)
					fullData.allObjects.forEach((object: string) =>
						allObjects.add(object)
					);

				// Create page-level entries
				if (fullData.pages && Array.isArray(fullData.pages)) {
					for (const page of fullData.pages) {
						// Extract page text from fullText if available
						let pageContent = '';
						if (fullData.fullText) {
							const pageMarker = `--- PAGE ${page.pageNumber} ---`;
							const nextPageMarker = `--- PAGE ${
								page.pageNumber + 1
							} ---`;

							const startIndex =
								fullData.fullText.indexOf(pageMarker);
							if (startIndex !== -1) {
								const endIndex = fullData.fullText.indexOf(
									nextPageMarker,
									startIndex
								);
								pageContent =
									endIndex !== -1
										? fullData.fullText.substring(
												startIndex,
												endIndex
										  )
										: fullData.fullText.substring(
												startIndex
										  );
							}
						}

						documents.push({
							documentId: `${item.id}`,
							url: `/jfk-files/${item.id}`,
							summary: fullData.summary || '',
							pageSummary: page.summary || '',
							content: pageContent || '',
							names: page.names || [],
							dates: page.dates || [],
							places: page.places || [],
							objects: page.objects || [],
							pageNumber: page.pageNumber,
							date: fullData.date || '',
						});
					}
				}
			}

			// Only proceed if we have at least one page with content
			if (documents.length === 0) {
				throw new Error(
					'Failed to fetch document data or no pages found'
				);
			}

			// Prepare the request body
			const requestBody = {
				documents,
				investigation: 'The JFK Files Investigation',
				selectedInvestigators: ['reporter', 'privateEye'],
				targetLengthSeconds: 600, // 10 minutes default
			};

			console.log(
				'Sending investigative report request:',
				JSON.stringify(requestBody)
			);

			// NEW APPROACH: Use a single fetch with streaming to handle SSE
			const response = await fetch(
				`${API_BASE_URL}/api/generate/investigative-report`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(requestBody),
					signal,
				}
			);

			if (!response.ok) {
				const errorData = await response.text();
				throw new Error(
					`Failed to start report generation: ${errorData}`
				);
			}

			// Track if we've completed successfully to prevent duplicate handlers
			let hasCompleted = false;

			// Process the stream directly
			if (!response.body) {
				throw new Error('Response body is null, cannot read stream');
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';

			// Set a timeout to prevent hanging forever
			const timeoutId = setTimeout(() => {
				try {
					console.log(
						`Report generation timeout reached, aborting fetch`
					);
					controller.abort();

					if (!hasCompleted) {
						setReportStatus('error');
						setReportProgress(
							'Report generation timed out after 5 minutes'
						);
					}
				} catch (err) {
					console.error('Error in timeout handler:', err);
				}
			}, 300000); // 5 minutes timeout

			// Improved message handling in generateInvestigativeReport function
			const processEvents = () => {
				// Split buffer into events
				const events = buffer.split('\n\n');
				// Keep the last incomplete event in the buffer
				buffer = events.pop() || '';

				for (const eventText of events) {
					if (!eventText.trim()) continue;

					// Parse the event
					let eventName = 'message';
					let eventData = '';

					const lines = eventText.split('\n');
					for (const line of lines) {
						if (line.startsWith('event:')) {
							eventName = line.substring(6).trim();
						} else if (line.startsWith('data:')) {
							eventData = line.substring(5).trim();
						}
					}

					console.log(`Received event: ${eventName}`, eventData);

					// Handle different event types
					try {
						// Try to parse JSON data if it's JSON
						let data;
						try {
							// Handle quote-wrapped JSON strings
							if (
								eventData.startsWith('"') &&
								eventData.endsWith('"')
							) {
								const unwrapped = eventData
									.substring(1, eventData.length - 1)
									.replace(/\\"/g, '"');
								data = JSON.parse(unwrapped);
							} else {
								data = JSON.parse(eventData);
							}
						} catch (e) {
							// Use as string if it's not JSON
							data = eventData;
						}

						// Handle different event types
						if (
							eventName === 'generatingReport' ||
							eventName === 'progress' ||
							eventName === 'investigationUpdate'
						) {
							setReportProgress(
								typeof data === 'string'
									? data
									: JSON.stringify(data)
							);
						} else if (
							eventName === 'reportComplete' ||
							eventName === 'complete'
						) {
							hasCompleted = true;
							setReportStatus('ready');

							let reportFileId = null;
							let audioUrl = '';

							// Create a better title based on documents in the queue
							const docCount = queue.length;
							const firstDocId =
								queue.length > 0 ? queue[0].id : '';
							const firstDocTitle =
								queue.length > 0 && queue[0].title
									? queue[0].title.length > 30
										? queue[0].title.substring(0, 30) +
										  '...'
										: queue[0].title
									: firstDocId;

							// Get current date in a readable format
							const now = new Date();
							const dateStr = now.toLocaleDateString('en-US', {
								month: 'short',
								day: 'numeric',
								hour: '2-digit',
								minute: '2-digit',
							});

							// More descriptive title based on document count
							const reportTitle =
								docCount === 1
									? `Investigation: ${firstDocTitle} (${dateStr})`
									: `Investigation: ${firstDocTitle} +${
											docCount - 1
									  } more (${dateStr})`;

							// Create the report metadata object
							const reportMetadata = {
								id: '',
								title: reportTitle,
								showName: 'JFK Files Investigation',
								tags: ['JFK Files', 'Investigative Report'],
								documentIds: queue.map((item) => item.id),
								audioUrl: '',
								timestamp: new Date().toISOString(),
							};

							if (typeof data === 'object') {
								if (data.reportFile) {
									reportFileId = data.reportFile;
									audioUrl = `${API_BASE_URL}/api/generate/media?id=${data.reportFile}`;
								} else if (data.documentDidTx) {
									reportFileId = data.documentDidTx;
									audioUrl = `${API_BASE_URL}/api/generate/media?id=${data.documentDidTx}`;
								}

								if (audioUrl) {
									// Update the reportUrl state
									setReportUrl(audioUrl);

									// Update the report metadata with the correct IDs and URLs
									reportMetadata.id = reportFileId || '';
									reportMetadata.audioUrl = audioUrl;

									// Always add the report to the playlist when complete
									console.log(
										'Adding completed report to playlist:',
										reportMetadata
									);
									setPlaylist((prev) => {
										// Check if this report is already in the playlist (by id)
										const exists = prev.some(
											(item) =>
												item.id === reportMetadata.id
										);
										if (!exists) {
											const updatedPlaylist = [
												...prev,
												reportMetadata,
											];

											// Save to localStorage
											try {
												localStorage.setItem(
													'investigativeReportPlaylists',
													JSON.stringify(
														updatedPlaylist
													)
												);
												console.log(
													'Saved updated playlist to localStorage:',
													updatedPlaylist
												);
											} catch (storageErr) {
												console.error(
													'Error saving to localStorage:',
													storageErr
												);
											}

											// Set as current playlist item and show the playlist
											setTimeout(() => {
												const newIndex =
													updatedPlaylist.length - 1;
												setCurrentPlaylistItem(
													newIndex
												);
												setShowPlaylist(true);

												// Prepare audio for playing in the sidebar instead of full-width player
												if (audioRef.current) {
													audioRef.current.src =
														audioUrl;
													audioRef.current.load();
													audioRef.current
														.play()
														.catch((e) =>
															console.error(
																'Error auto-playing audio:',
																e
															)
														);
													setIsPlaying(true);
												}
											}, 100);

											return updatedPlaylist;
										}
										return prev;
									});
								}
							}

							clearTimeout(timeoutId);
						} else if (eventName === 'error') {
							if (!hasCompleted) {
								setReportStatus('error');
								setReportProgress(
									typeof data === 'string'
										? data
										: JSON.stringify(data)
								);
							}

							clearTimeout(timeoutId);
							return; // Exit the event processing loop immediately
						} else if (eventName === 'ping') {
							console.log(
								'Report generation connection alive:',
								data
							);
						} else if (eventName === 'message') {
							// This could be the metadata message with report details
							console.log(
								'Received generic message event:',
								data
							);

							// Check if this is a metadata message
							if (
								data &&
								typeof data === 'object' &&
								data.reportTitle
							) {
								console.log(
									'Identified metadata message:',
									data
								);
								handleReportMetadata(data);
							}
						} else if (eventName === 'reportMetadata') {
							// Direct handling of the reportMetadata event type
							console.log('Received reportMetadata event:', data);
							handleReportMetadata(data);
						}
					} catch (error) {
						console.error(
							'Error processing event:',
							error,
							eventText
						);
					}
				}
			};

			// Start reading the stream
			try {
				let shouldContinue = true;
				while (shouldContinue) {
					const { done, value } = await reader.read();

					if (done || hasCompleted) {
						console.log('Stream complete or processing completed');
						shouldContinue = false;
						break;
					}

					// Add new data to buffer and process
					buffer += decoder.decode(value, { stream: true });
					processEvents();

					// Check if we've completed (set in processEvents)
					if (hasCompleted) {
						shouldContinue = false;
						controller.abort(); // Now abort after breaking out of the loop
						break;
					}
				}
			} catch (streamError) {
				// If we get an abort error after successful completion, ignore it
				if (
					hasCompleted &&
					(streamError as Error).name === 'AbortError'
				) {
					console.log(
						'Stream was aborted after successful completion'
					);
				} else {
					throw streamError; // Re-throw other errors
				}
			} finally {
				// Make sure to finish decoder
				try {
					buffer += decoder.decode();
					processEvents();
				} catch (finalError) {
					if (hasCompleted) {
						console.log(
							'Error in final decode but report was completed successfully'
						);
					} else {
						console.error('Error in final decode:', finalError);
					}
				}
			}

			// If we haven't received a completion event but the stream ended
			if (!hasCompleted) {
				setReportStatus('error');
				setReportProgress('Report generation ended unexpectedly');
			}
		} catch (error) {
			console.error(
				'Error initiating investigative report generation:',
				error
			);
			setReportStatus('error');
			setReportProgress(
				error instanceof Error ? error.message : 'Unknown error'
			);
			controller.abort(); // Abort any ongoing fetch if there's an error
		}
	};

	// Handle audio playback for either podcast or report
	const togglePlayPause = (playerType: 'podcast' | 'report') => {
		if (!audioRef.current) return;

		if (isPlaying && currentPlayer === playerType) {
			audioRef.current.pause();
		} else {
			// If switching between players, update audio source
			if (currentPlayer !== playerType) {
				setCurrentPlayer(playerType);
				if (playerType === 'podcast' && podcastUrl) {
					audioRef.current.src = podcastUrl;
				} else if (playerType === 'report' && reportUrl) {
					audioRef.current.src = reportUrl;
				}
			}
			audioRef.current.play();
		}

		setIsPlaying(currentPlayer === playerType ? !isPlaying : true);
	};

	// Update audio source when URLs change
	useEffect(() => {
		console.log('Audio URLs or player changed:', {
			podcastUrl,
			reportUrl,
			currentPlayer,
		});
		if (audioRef.current) {
			if (currentPlayer === 'podcast' && podcastUrl) {
				console.log('Setting audio source to podcast URL:', podcastUrl);
				audioRef.current.src = podcastUrl;
				audioRef.current.load(); // Explicitly load the audio
			} else if (currentPlayer === 'report' && reportUrl) {
				console.log('Setting audio source to report URL:', reportUrl);
				audioRef.current.src = reportUrl;
				audioRef.current.load(); // Explicitly load the audio
			}
		}
		setIsPlaying(false);
	}, [podcastUrl, reportUrl, currentPlayer]);

	// Clean up audio on unmount
	useEffect(() => {
		return () => {
			if (audioRef.current) {
				audioRef.current.pause();
			}
		};
	}, []);

	// Update the page change handler to fetch page content
	const handlePageChange = async (itemId: string, pageNum: number) => {
		setCurrentPage((prev) => ({ ...prev, [itemId]: pageNum }));

		// If we haven't loaded this specific page content yet, fetch it
		const pageKey = `${itemId}-p${pageNum}`;
		if (!pageContent[pageKey] && !pageContentLoading[pageKey]) {
			setPageContentLoading((prev) => ({ ...prev, [pageKey]: true }));

			try {
				const response = await fetch(
					`${API_BASE_URL}/api/jfk/media?id=${itemId}&type=analysis&getLatestPageData=true`
				);

				if (response.ok) {
					const data = await response.json();
					if (data.pages && Array.isArray(data.pages)) {
						const pageSummary = data.pages.find(
							(p: any) => p.pageNumber === pageNum
						);
						if (pageSummary) {
							setPageContent((prev) => ({
								...prev,
								[pageKey]: pageSummary,
							}));
						}
					}
				}
			} catch (error) {
				console.error(
					`Error fetching page ${pageNum} content for document ${itemId}:`,
					error
				);
			} finally {
				setPageContentLoading((prev) => ({
					...prev,
					[pageKey]: false,
				}));
			}
		}
	};

	// Store conditional UI in variables, not in conditional returns
	let minimalDock = null;
	if (queue.length === 0 && !showPlaylist && playlist.length > 0) {
		// Calculate positioning based on sidebar state
		const sidebarOffset =
			!isMobile && sidebarState === 'expanded' ? 'left-64' : 'left-0';
		const dockWidth =
			!isMobile && sidebarState === 'expanded'
				? 'w-[calc(100%-16rem)]'
				: 'w-full';

		minimalDock = (
			<>
				<div
					className={`fixed bottom-0 right-0 p-2 bg-muted border-t border-l border-border rounded-tl-lg shadow-lg z-9100 flex items-center gap-2 ${sidebarOffset}`}
				>
					<button
						onClick={() => setShowPlaylist(true)}
						className='px-3 py-1.5 bg-muted text-foreground rounded border border-border text-sm flex items-center cursor-pointer hover:bg-secondary transition-colors'
					>
						<Radio size={14} className='mr-1' />
						<span>Investigations ({playlist.length})</span>
					</button>
				</div>
				<InvestigationsPanel
					audioRef={audioRef}
					showPlaylist={showPlaylist}
					setShowPlaylist={setShowPlaylist}
					playlist={playlist}
					currentPlaylistItem={currentPlaylistItem}
					setCurrentPlaylistItem={setCurrentPlaylistItem}
					isPlaying={isPlaying}
					setIsPlaying={setIsPlaying}
					setCurrentPlayer={setCurrentPlayer}
				/>
			</>
		);
	}

	// Removed Add Test Documents button and related code

	// Listen for custom events from the visualization
	useEffect(() => {
		const handleDocumentDockUpdate = (event: CustomEvent) => {
			if (event.detail && Array.isArray(event.detail.queue)) {
				// Update our queue directly from the event data
				console.log('DocumentDock: Received documentDockUpdate event');

				try {
					// Instead of clearing and replacing, we'll just add items that aren't already in the queue
					// First get the existing IDs in the queue to check against
					const existingIds = queue.map((item) => item.id);

					// Then add each item that's not already in the queue
					const newQueue = event.detail.queue.map((item: any) => ({
						id: item.id,
						title: item.title || `Document ${item.id}`,
						url: item.url || `/jfk-files/${item.id}`,
						type: item.type || 'document',
					}));

					// Filter for items not already in the queue
					const itemsToAdd = newQueue.filter(
						(item: DocumentItem) => !existingIds.includes(item.id)
					);

					// Add them individually to the queue
					itemsToAdd.forEach((item: DocumentItem) =>
						addToQueue(item)
					);
				} catch (error) {
					console.error(
						'Error updating DocumentDock from localStorage:',
						error
					);
				}
			}
		};

		// Clean up
		return () => {
			window.removeEventListener(
				'documentDockUpdate',
				handleDocumentDockUpdate as EventListener
			);
			// @ts-ignore - Clean up window object
			window.updateDocumentDock = undefined;
		};
	}, [queue, addToQueue]);

	// Render both the main dock and the investigations panel
	return (
		<>
			{minimalDock}
			{/* Document Dock Sheet */}
			<Sheet open={isOpen} onOpenChange={setIsOpen}>
				{/* Always visible trigger/header bar */}
				<div
					className={`sticky bottom-0 left-0 ${
						showPlaylist ? 'w-[calc(100%-300px)]' : 'w-full'
					} z-9000 bg-background text-foreground border-t border-border`}
				>
					{/* Hidden audio element for playback */}
					<audio
						ref={audioRef}
						src={
							currentPlayer === 'podcast'
								? podcastUrl || undefined
								: reportUrl || undefined
						}
						onEnded={() => setIsPlaying(false)}
						onPlay={() => setIsPlaying(true)}
						onPause={() => setIsPlaying(false)}
						style={{ display: 'none' }}
					/>

					{/* Header bar with audio player and controls */}
					<SheetTrigger asChild>
						<div
							className={`px-4 py-3 bg-background cursor-pointer hover:bg-muted/50 transition-colors`}
						>
							<div className='flex justify-between items-center'>
								<div className='flex items-center gap-3'>
									<h3 className='font-semibold text-sm text-foreground m-0'>
										Document Queue ({queue.length})
									</h3>
									<AudioPlayerHeader
										isPlaying={isPlaying}
										currentPlayer={currentPlayer}
										currentPlaylistItem={
											currentPlaylistItem
										}
										playlist={playlist}
										podcastUrl={podcastUrl}
										audioRef={audioRef}
										reportUrl={reportUrl}
										setShowPlaylist={setShowPlaylist}
										setIsPlaying={setIsPlaying}
										setCurrentPlayer={setCurrentPlayer}
										togglePlayPause={togglePlayPause}
									/>
								</div>
								<div className='flex gap-2'>
									{playlist.length > 0 && (
										<button
											onClick={() =>
												setShowPlaylist(!showPlaylist)
											}
											className={`px-2 py-1 rounded cursor-pointer border-0 flex items-center gap-1 text-xs ${
												showPlaylist
													? 'bg-secondary'
													: 'bg-muted'
											} text-foreground`}
											aria-label={
												showPlaylist
													? 'Hide investigations'
													: 'Show investigations'
											}
										>
											<Radio size={14} />
											<span>{playlist.length}</span>
										</button>
									)}
									<div className='flex items-center gap-1 text-xs text-muted-foreground'>
										<ChevronUp size={16} />
										<span>Click to view</span>
									</div>
								</div>
							</div>
						</div>
					</SheetTrigger>

					{/* Sheet Content - Document Items */}
					<SheetContent side='bottom' className='h-[60vh] p-0'>
						<ScrollArea className='h-full'>
							{/* Generation Controls - moved inside sheet */}
							<div className='p-4 border-b border-border bg-muted/30'>
								<div className='flex items-center gap-4'>
									{(podcastStatus as string) ===
									'generating' ? (
										<div className='flex items-center gap-2 w-full'>
											<Loader
												size={16}
												className='animate-spin'
											/>
											<div className='flex-1 text-sm'>
												{podcastProgress ||
													'Generating podcast...'}
											</div>
										</div>
									) : (reportStatus as string) ===
									  'generating' ? (
										<div className='flex items-center gap-2 w-full'>
											<Loader
												size={16}
												className='animate-spin'
											/>
											<div className='flex-1 text-sm'>
												{reportProgress ||
													'Generating investigative report...'}
											</div>
										</div>
									) : (podcastStatus as string) === 'ready' &&
									  podcastUrl &&
									  currentPlayer === 'podcast' ? (
										<div className='flex items-center gap-2 w-full'>
											<button
												onClick={() =>
													togglePlayPause('podcast')
												}
												className='p-2 bg-primary text-primary-foreground rounded-full flex items-center justify-center border-0 cursor-pointer'
											>
												{isPlaying ? (
													<Pause size={18} />
												) : (
													<Play size={18} />
												)}
											</button>
											<div className='flex-1'>
												<div className='font-medium text-sm'>
													Generated Podcast
												</div>
												<audio
													src={podcastUrl}
													onEnded={() =>
														setIsPlaying(false)
													}
													onPlay={() =>
														setIsPlaying(true)
													}
													onPause={() =>
														setIsPlaying(false)
													}
													className='w-full mt-1'
													controls
												/>
											</div>
										</div>
									) : (reportStatus as string) === 'ready' &&
									  reportUrl &&
									  currentPlayer === 'report' &&
									  !showPlaylist ? (
										<div className='flex items-center gap-2 w-full'>
											<button
												onClick={() =>
													togglePlayPause('report')
												}
												className='p-2 bg-destructive text-white rounded-full flex items-center justify-center border-0 cursor-pointer'
											>
												{isPlaying ? (
													<Pause size={18} />
												) : (
													<Play size={18} />
												)}
											</button>
											<div className='flex-1'>
												<div className='font-medium text-sm flex items-center justify-between'>
													<span>
														Investigative Report
													</span>
													<button
														onClick={() =>
															setShowPlaylist(
																true
															)
														}
														className='px-2 py-1 text-xs bg-muted border border-border rounded flex items-center gap-1 cursor-pointer'
													>
														<Radio size={12} />
														<span>
															Investigations
														</span>
													</button>
												</div>
												<audio
													src={reportUrl}
													onEnded={() =>
														setIsPlaying(false)
													}
													onPlay={() =>
														setIsPlaying(true)
													}
													onPause={() =>
														setIsPlaying(false)
													}
													className='w-full mt-1'
													controls
												/>
											</div>
										</div>
									) : (
										<>
											<button
												onClick={generatePodcast}
												disabled={
													(podcastStatus as string) ===
														'generating' ||
													(reportStatus as string) ===
														'generating' ||
													queue.length === 0
												}
												className='px-4 py-2 bg-primary text-primary-foreground rounded text-sm border-0 flex items-center cursor-pointer gap-2 disabled:opacity-60'
											>
												<Mic
													size={14}
													className='mr-1'
												/>
												<span>Podcast</span>
											</button>
											<button
												onClick={
													generateInvestigativeReport
												}
												disabled={
													(reportStatus as string) ===
														'generating' ||
													(podcastStatus as string) ===
														'generating' ||
													queue.length === 0
												}
												className='px-4 py-2 bg-destructive text-white rounded text-sm border-0 flex items-center cursor-pointer gap-2 disabled:opacity-60'
											>
												<FileSearch
													size={14}
													className='mr-1'
												/>
												<span>
													Investigative Report
												</span>
											</button>
											<button className='px-4 py-2 bg-accent text-accent-foreground rounded text-sm border-0 flex items-center cursor-pointer gap-2'>
												<MessageSquare
													size={14}
													className='mr-1'
												/>
												<span>Dialog</span>
											</button>
											{playlist.length > 0 && (
												<button
													onClick={() =>
														setShowPlaylist(true)
													}
													className='px-4 py-2 bg-muted text-foreground border border-border rounded text-sm flex items-center cursor-pointer gap-2'
												>
													<Radio
														size={14}
														className='mr-1'
													/>
													<span>
														Investigations (
														{playlist.length})
													</span>
												</button>
											)}
											{tokenCount > 0 && (
												<div className='px-3 py-1 bg-muted rounded text-xs text-muted-foreground flex items-center gap-1'>
													<span>Tokens:</span>
													<span className='font-semibold'>
														{tokenCount.toLocaleString()}
													</span>
												</div>
											)}
										</>
									)}
								</div>
							</div>

							{/* Document queue */}
							<DndContext
								sensors={sensors}
								collisionDetection={closestCenter}
								onDragStart={handleDragStart}
								onDragEnd={handleDragEnd}
							>
								<div className='p-4 flex flex-row overflow-x-auto whitespace-nowrap bg-background'>
									<SortableContext
										items={queue.map((item) => item.id)}
										strategy={verticalListSortingStrategy}
									>
										{queue.map((item, index) => {
											const docDetails =
												documentDetails[item.id];
											const currentTab =
												activeTab[item.id] || 'summary';
											const pageNum =
												currentPage[item.id] || 1;
											const pageCount =
												docDetails?.pageCount || 1;
											const expandedSec =
												expandedSection[item.id];
											const pageKey = `${item.id}-p${pageNum}`;
											const currentPageData =
												pageContent[pageKey];
											const isLoadingPageData =
												pageContentLoading[pageKey];

											return (
												<SortableDocumentItem
													key={item.id}
													item={item}
													index={index}
													isDragging={
														activeId === item.id
													}
												>
													{(dragListeners) => (
														<>
															{/* Header with ID and controls */}
															<div className='flex justify-between items-center p-2 bg-muted border-b border-border'>
																<div className='flex items-center'>
																	<div
																		className='cursor-move mr-2'
																		{...dragListeners}
																	>
																		<GripVertical
																			size={
																				14
																			}
																		/>
																	</div>
																	<a
																		href={
																			item.url
																		}
																		className='font-medium text-primary no-underline text-sm overflow-hidden text-ellipsis whitespace-nowrap max-w-[130px] block'
																		title={
																			item.title
																		}
																	>
																		{item.title ||
																			item.id}
																	</a>
																</div>
																<div className='flex items-center gap-1'>
																	<button
																		onClick={(
																			e
																		) => {
																			e.stopPropagation();
																			removeFromQueue(
																				item.id
																			);
																		}}
																		className='p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors'
																		title='Remove from queue'
																	>
																		<X
																			size={
																				14
																			}
																		/>
																	</button>
																	{pageCount >
																		1 && (
																		<div className='flex items-center gap-0.5 mr-2'>
																			<button
																				onClick={() =>
																					handlePageChange(
																						item.id,
																						Math.max(
																							1,
																							pageNum -
																								1
																						)
																					)
																				}
																				disabled={
																					pageNum <=
																					1
																				}
																				style={{
																					border: 'none',
																					background:
																						'none',
																					cursor:
																						pageNum <=
																						1
																							? 'default'
																							: 'pointer',
																					opacity:
																						pageNum <=
																						1
																							? 0.5
																							: 1,
																					padding:
																						'2px',
																				}}
																			>
																				<ChevronLeft
																					size={
																						12
																					}
																				/>
																			</button>
																			<span
																				style={{
																					fontWeight: 500,
																					fontSize:
																						'0.7rem',
																				}}
																			>
																				{
																					pageNum
																				}

																				/
																				{
																					pageCount
																				}
																			</span>
																			<button
																				onClick={() =>
																					handlePageChange(
																						item.id,
																						Math.min(
																							pageCount,
																							pageNum +
																								1
																						)
																					)
																				}
																				disabled={
																					pageNum >=
																					pageCount
																				}
																				style={{
																					border: 'none',
																					background:
																						'none',
																					cursor:
																						pageNum >=
																						pageCount
																							? 'default'
																							: 'pointer',
																					opacity:
																						pageNum >=
																						pageCount
																							? 0.5
																							: 1,
																					padding:
																						'2px',
																				}}
																			>
																				<ChevronRight
																					size={
																						12
																					}
																				/>
																			</button>
																		</div>
																	)}
																</div>
															</div>

															{/* Tabs */}
															<div className='flex border-b border-border px-2'>
																<button
																	onClick={() =>
																		handleTabChange(
																			item.id,
																			'summary'
																		)
																	}
																	className={`px-2 py-1 text-xs border-b-2 transition-colors duration-150 focus:outline-none ${
																		currentTab ===
																		'summary'
																			? 'border-primary text-primary'
																			: 'border-transparent text-muted-foreground hover:text-primary'
																	}`}
																>
																	Doc
																</button>
																<button
																	onClick={() =>
																		handleTabChange(
																			item.id,
																			'page'
																		)
																	}
																	className={`px-2 py-1 text-xs border-b-2 transition-colors duration-150 focus:outline-none ${
																		currentTab ===
																		'page'
																			? 'border-primary text-primary'
																			: 'border-transparent text-muted-foreground hover:text-primary'
																	}`}
																>
																	Page
																</button>
																<button
																	onClick={() =>
																		handleTabChange(
																			item.id,
																			'entities'
																		)
																	}
																	className={`px-2 py-1 text-xs border-b-2 transition-colors duration-150 focus:outline-none ${
																		currentTab ===
																		'entities'
																			? 'border-primary text-primary'
																			: 'border-transparent text-muted-foreground hover:text-primary'
																	}`}
																>
																	Entities
																</button>
																<button
																	onClick={() =>
																		handleTabChange(
																			item.id,
																			'image'
																		)
																	}
																	className={`px-2 py-1 text-xs border-b-2 transition-colors duration-150 focus:outline-none ${
																		currentTab ===
																		'image'
																			? 'border-primary text-primary'
																			: 'border-transparent text-muted-foreground hover:text-primary'
																	}`}
																>
																	Image
																</button>
																<button
																	onClick={() =>
																		handleTabChange(
																			item.id,
																			'text'
																		)
																	}
																	className={`px-2 py-1 text-xs border-b-2 transition-colors duration-150 focus:outline-none ${
																		currentTab ===
																		'text'
																			? 'border-primary text-primary'
																			: 'border-transparent text-muted-foreground hover:text-primary'
																	}`}
																>
																	Text
																</button>
															</div>

															{/* Tab content */}
															<div className='h-[260px] overflow-auto p-2 bg-background'>
																{/* Document summary tab */}
																{currentTab ===
																	'summary' && (
																	<div
																		style={{
																			fontSize:
																				'0.75rem',
																			color: '#374151',
																			height: '100%',
																			overflowY:
																				'auto',
																			whiteSpace:
																				'normal',
																			wordBreak:
																				'break-word',
																		}}
																	>
																		{docDetails?.summary ||
																			'Loading summary...'}
																	</div>
																)}

																{/* Page summary tab - Now properly shows the page-specific summary */}
																{currentTab ===
																	'page' && (
																	<div
																		style={{
																			fontSize:
																				'0.75rem',
																			color: '#374151',
																			height: '100%',
																			overflowY:
																				'auto',
																			whiteSpace:
																				'normal',
																			wordBreak:
																				'break-word',
																		}}
																	>
																		<div
																			style={{
																				marginBottom:
																					'4px',
																				fontWeight: 500,
																			}}
																		>
																			Page{' '}
																			{
																				pageNum
																			}{' '}
																			Summary
																		</div>
																		{isLoadingPageData ? (
																			<div>
																				Loading
																				page
																				data...
																			</div>
																		) : currentPageData?.summary ? (
																			<div>
																				{
																					currentPageData.summary
																				}
																			</div>
																		) : docDetails &&
																		  docDetails.pages &&
																		  docDetails
																				.pages[
																				pageNum -
																					1
																		  ]
																				?.summary ? (
																			<div>
																				{
																					docDetails
																						.pages[
																						pageNum -
																							1
																					]
																						.summary
																				}
																			</div>
																		) : (
																			<div>
																				No
																				page
																				summary
																				available.
																			</div>
																		)}
																	</div>
																)}

																{/* Entities tab - Now showing complete lists with proper scrolling */}
																{currentTab ===
																	'entities' && (
																	<div
																		style={{
																			fontSize:
																				'0.75rem',
																			color: '#374151',
																			height: '100%',
																			overflowY:
																				'auto',
																		}}
																	>
																		{docDetails && (
																			<>
																				<div
																					style={{
																						marginBottom:
																							'8px',
																					}}
																				>
																					<button
																						onClick={() =>
																							toggleExpandedSection(
																								item.id,
																								'people'
																							)
																						}
																						style={{
																							display:
																								'flex',
																							alignItems:
																								'center',
																							gap: '4px',
																							fontSize:
																								'0.75rem',
																							fontWeight: 500,
																							padding:
																								'2px 4px',
																							backgroundColor:
																								'transparent',
																							border: 'none',
																							cursor: 'pointer',
																							color: '#4b5563',
																							width: '100%',
																							justifyContent:
																								'space-between',
																						}}
																					>
																						<div
																							style={{
																								display:
																									'flex',
																								alignItems:
																									'center',
																								gap: '4px',
																							}}
																						>
																							<User
																								size={
																									12
																								}
																							/>
																							<span>
																								People
																								(
																								{docDetails
																									.allNames
																									?.length ||
																									0}

																								)
																							</span>
																						</div>
																						{expandedSec ===
																						'people' ? (
																							<ChevronUp
																								size={
																									10
																								}
																							/>
																						) : (
																							<ChevronDown
																								size={
																									10
																								}
																							/>
																						)}
																					</button>
																					{expandedSec ===
																						'people' &&
																						docDetails.allNames && (
																							<div
																								style={{
																									paddingLeft:
																										'16px',
																									fontSize:
																										'0.7rem',
																									marginTop:
																										'2px',
																									maxHeight:
																										'120px',
																									overflowY:
																										'auto',
																								}}
																							>
																								{docDetails.allNames.map(
																									(
																										name: string,
																										idx: number
																									) => (
																										<div
																											key={`name-${idx}`}
																											style={{
																												marginBottom:
																													'2px',
																												whiteSpace:
																													'normal',
																												wordBreak:
																													'break-word',
																											}}
																										>
																											{
																												name
																											}
																										</div>
																									)
																								)}
																							</div>
																						)}
																				</div>
																				<div
																					style={{
																						marginBottom:
																							'8px',
																					}}
																				>
																					<button
																						onClick={() =>
																							toggleExpandedSection(
																								item.id,
																								'places'
																							)
																						}
																						style={{
																							display:
																								'flex',
																							alignItems:
																								'center',
																							gap: '4px',
																							fontSize:
																								'0.75rem',
																							fontWeight: 500,
																							padding:
																								'2px 4px',
																							backgroundColor:
																								'transparent',
																							border: 'none',
																							cursor: 'pointer',
																							color: '#4b5563',
																							width: '100%',
																							justifyContent:
																								'space-between',
																						}}
																					>
																						<div
																							style={{
																								display:
																									'flex',
																								alignItems:
																									'center',
																								gap: '4px',
																							}}
																						>
																							<MapPin
																								size={
																									12
																								}
																							/>
																							<span>
																								Places
																								(
																								{docDetails
																									.allPlaces
																									?.length ||
																									0}

																								)
																							</span>
																						</div>
																						{expandedSec ===
																						'places' ? (
																							<ChevronUp
																								size={
																									10
																								}
																							/>
																						) : (
																							<ChevronDown
																								size={
																									10
																								}
																							/>
																						)}
																					</button>
																					{expandedSec ===
																						'places' &&
																						docDetails.allPlaces && (
																							<div
																								style={{
																									paddingLeft:
																										'16px',
																									fontSize:
																										'0.7rem',
																									marginTop:
																										'2px',
																									maxHeight:
																										'120px',
																									overflowY:
																										'auto',
																								}}
																							>
																								{docDetails.allPlaces.map(
																									(
																										place: string,
																										idx: number
																									) => (
																										<div
																											key={`place-${idx}`}
																											style={{
																												marginBottom:
																													'2px',
																												whiteSpace:
																													'normal',
																												wordBreak:
																													'break-word',
																											}}
																										>
																											{
																												place
																											}
																										</div>
																									)
																								)}
																							</div>
																						)}
																				</div>
																				<div>
																					<button
																						onClick={() =>
																							toggleExpandedSection(
																								item.id,
																								'objects'
																							)
																						}
																						style={{
																							display:
																								'flex',
																							alignItems:
																								'center',
																							gap: '4px',
																							fontSize:
																								'0.75rem',
																							fontWeight: 500,
																							padding:
																								'2px 4px',
																							backgroundColor:
																								'transparent',
																							border: 'none',
																							cursor: 'pointer',
																							color: '#4b5563',
																							width: '100%',
																							justifyContent:
																								'space-between',
																						}}
																					>
																						<div
																							style={{
																								display:
																									'flex',
																								alignItems:
																									'center',
																								gap: '4px',
																							}}
																						>
																							<Package
																								size={
																									12
																								}
																							/>
																							<span>
																								Objects
																								(
																								{docDetails
																									.allObjects
																									?.length ||
																									0}

																								)
																							</span>
																						</div>
																						{expandedSec ===
																						'objects' ? (
																							<ChevronUp
																								size={
																									10
																								}
																							/>
																						) : (
																							<ChevronDown
																								size={
																									10
																								}
																							/>
																						)}
																					</button>
																					{expandedSec ===
																						'objects' &&
																						docDetails.allObjects && (
																							<div
																								style={{
																									paddingLeft:
																										'16px',
																									fontSize:
																										'0.7rem',
																									marginTop:
																										'2px',
																									maxHeight:
																										'120px',
																									overflowY:
																										'auto',
																								}}
																							>
																								{docDetails.allObjects.map(
																									(
																										object: string,
																										idx: number
																									) => (
																										<div
																											key={`object-${idx}`}
																											style={{
																												marginBottom:
																													'2px',
																												whiteSpace:
																													'normal',
																												wordBreak:
																													'break-word',
																											}}
																										>
																											{
																												object
																											}
																										</div>
																									)
																								)}
																							</div>
																						)}
																				</div>
																			</>
																		)}
																	</div>
																)}

																{/* Image tab */}
																{currentTab ===
																	'image' && (
																	<div
																		style={{
																			display:
																				'flex',
																			flexDirection:
																				'column',
																			height: '100%',
																			justifyContent:
																				'center',
																			alignItems:
																				'center',
																		}}
																	>
																		{docDetails ? (
																			<img
																				src={getPageImageUrl(
																					item.id,
																					pageNum
																				)}
																				alt={`Page ${pageNum}`}
																				style={{
																					maxWidth:
																						'100%',
																					maxHeight:
																						'100%',
																					objectFit:
																						'contain',
																					display:
																						'block',
																				}}
																			/>
																		) : (
																			<div
																				style={{
																					fontSize:
																						'0.75rem',
																					color: '#6b7280',
																				}}
																			>
																				Loading
																				image...
																			</div>
																		)}
																	</div>
																)}

																{/* Text tab */}
																{currentTab ===
																	'text' && (
																	<div
																		style={{
																			fontSize:
																				'0.75rem',
																			color: '#374151',
																			height: '100%',
																			overflowY:
																				'auto',
																			fontFamily:
																				'monospace',
																			whiteSpace:
																				'pre-wrap',
																			wordBreak:
																				'break-word',
																		}}
																	>
																		{docDetails?.fullText
																			? docDetails.fullText.substring(
																					0,
																					500
																			  ) +
																			  '...'
																			: 'Text not available.'}
																	</div>
																)}
															</div>
														</>
													)}
												</SortableDocumentItem>
											);
										})}
									</SortableContext>
								</div>

								<DragOverlay>
									{activeId ? (
										<div
											style={{
												display: 'inline-block',
												width: '240px',
												height: '320px',
												backgroundColor: 'white',
												border: '1px solid #e5e7eb',
												borderRadius: '8px',
												boxShadow:
													'0 4px 12px rgba(0, 0, 0, 0.15)',
												opacity: 0.8,
												transform: 'rotate(5deg)',
											}}
										>
											<div
												style={{
													padding: '8px',
													backgroundColor: '#f3f4f6',
													borderBottom:
														'1px solid #e5e7eb',
													fontWeight: 500,
													fontSize: '0.875rem',
												}}
											>
												{queue.find(
													(item) =>
														item.id === activeId
												)?.id || 'Document'}
											</div>
										</div>
									) : null}
								</DragOverlay>
							</DndContext>
						</ScrollArea>
					</SheetContent>
				</div>
			</Sheet>

			{/* Render Investigations panel with higher z-index */}
			<InvestigationsPanel
				audioRef={audioRef}
				showPlaylist={showPlaylist}
				setShowPlaylist={setShowPlaylist}
				playlist={playlist}
				currentPlaylistItem={currentPlaylistItem}
				setCurrentPlaylistItem={setCurrentPlaylistItem}
				isPlaying={isPlaying}
				setIsPlaying={setIsPlaying}
				setCurrentPlayer={setCurrentPlayer}
			/>
		</>
	);
}

export default DocumentDock;
