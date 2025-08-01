'use client';

// Add type declaration at the top of the file
declare global {
	interface Window {
		updateNewsDock?: () => void;
		newsDetailsCache?: Record<string, any>;
	}
}

import React, { useState, useEffect, useRef } from 'react';
import { useNewsDock, NewsArticleItem } from '@/lib/context/NewsDockContext';
import {
	X,
	ChevronUp,
	ChevronLeft,
	ChevronRight,
	GripVertical,
	Play,
	Pause,
	Mic,
	FileSearch,
	MessageSquare,
	Radio,
	Loader,
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
import BriefingPanel from './BriefingPanel';
import SortableNewsItem from './SortableNewsItem';
import NewsAudioPlayerHeader from './NewsAudioPlayerHeader';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.oip.onl';

export function NewsDock() {
	const {
		queue,
		removeFromQueue,
		clearQueue,
		reorderQueue,
		setQueue,
		addToQueue,
	} = useNewsDock();
	const { state: sidebarState, isMobile } = useSidebar();

	const [isOpen, setIsOpen] = useState(false);
	const [articleDetails, setArticleDetails] = useState<Record<string, any>>(
		{}
	);
	const [activeTab, setActiveTab] = useState<Record<string, string>>({});
	const [expandedSection, setExpandedSection] = useState<
		Record<string, string | null>
	>({});
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
	const [playlist, setPlaylist] = useState<
		Array<{
			id: string;
			title: string;
			showName: string;
			tags: string[];
			articleIds: string[];
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
				localStorage.getItem('newsBriefingPlaylists') || '[]'
			);
			setPlaylist(savedPlaylists);
		} catch (err) {
			console.error('Error loading saved news playlists:', err);
		}
	}, []);

	// Helper functions for article display
	const handleTabChange = (itemId: string, tab: string) => {
		setActiveTab((prev) => ({ ...prev, [itemId]: tab }));
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

	// Fetch article details for items in queue
	useEffect(() => {
		const fetchArticleDetails = async () => {
			const details: Record<string, any> = {};

			for (const item of queue) {
				if (!articleDetails[item.id]) {
					try {
						// Check if there's cached data available from window.newsDetailsCache
						if (
							typeof window !== 'undefined' &&
							window.newsDetailsCache &&
							window.newsDetailsCache[item.id]
						) {
							console.log(
								`Using cached article details for ${item.id}`
							);
							details[item.id] = window.newsDetailsCache[item.id];
						} else {
							// No cached data, fetch from API
							console.log(
								`Fetching article details for ${item.id}`
							);

							// Try to fetch from the news API
							const response = await fetch(
								`/api/news/articles/${item.id}`
							);

							if (response.ok) {
								const data = await response.json();
								details[item.id] = data;
							} else {
								console.error(
									`Failed to fetch details for article ${item.id}`
								);
								// Set basic details from the item itself
								details[item.id] = {
									id: item.id,
									title: item.title,
									url: item.url,
									summary: item.summary || item.excerpt,
									source: item.source,
									media: item.media,
									publishedAt: item.publishedAt,
								};
							}
						}

						// Initialize tabs if not set
						if (!activeTab[item.id]) {
							setActiveTab((prev) => ({
								...prev,
								[item.id]: 'summary',
							}));
						}
					} catch (error) {
						console.error(
							`Error fetching details for article ${item.id}:`,
							error
						);
					}
				}
			}

			if (Object.keys(details).length > 0) {
				setArticleDetails((prev) => ({ ...prev, ...details }));
			}
		};

		fetchArticleDetails();
	}, [queue, articleDetails, activeTab]);

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
			let totalTokens = 0;

			for (const item of queue) {
				const details = articleDetails[item.id];
				if (!details) continue;

				// Count tokens in title
				if (details.title) {
					totalTokens += estimateTokens(details.title);
				}

				// Count tokens in summary/excerpt
				if (details.summary) {
					totalTokens += estimateTokens(details.summary);
				}

				// Count tokens in full text if available
				if (details.fullText) {
					totalTokens += estimateTokens(details.fullText);
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
	}, [queue, articleDetails]);

	// Function to generate podcast
	const generatePodcast = async () => {
		if (queue.length === 0) return;

		setPodcastStatus('generating');
		setPodcastProgress('Starting news podcast generation...');
		setPodcastUrl(null);

		const controller = new AbortController();
		const signal = controller.signal;

		try {
			// Prepare articles for podcast generation
			const articles = queue
				.map((item) => {
					const details = articleDetails[item.id];
					return {
						id: item.id,
						title: item.title,
						url: item.url,
						type: 'article',
						content:
							details?.fullText ||
							details?.summary ||
							item.excerpt ||
							'',
						summary: details?.summary || item.excerpt || '',
						source: item.source,
						publishedAt: item.publishedAt,
					};
				})
				.filter(
					(article) => article.content && article.content.length > 0
				);

			if (articles.length === 0) {
				throw new Error(
					'No article content available for podcast generation'
				);
			}

			const selectedHosts = ['hypatia', 'socrates'];

			const requestBody = {
				articles,
				selectedHosts,
				targetLengthSeconds: 300, // 5 minutes default
			};

			console.log(
				'Sending news podcast request:',
				JSON.stringify(requestBody)
			);

			const eventSource = new EventSource(
				`${API_BASE_URL}/api/generate/podcast`
			);

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
			});

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
					controller.abort();
				}
			});

			eventSource.addEventListener('error', (event) => {
				console.error('Podcast generation error:', event);
				setPodcastStatus('error');
				setPodcastProgress('Error generating podcast');
				eventSource.close();
				controller.abort();
			});

			eventSource.onerror = () => {
				console.error('EventSource connection error');
				setPodcastStatus('error');
				setPodcastProgress('Connection error');
				eventSource.close();
				controller.abort();
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
		setReportProgress('Starting news investigative report generation...');
		setReportUrl(null);

		const controller = new AbortController();
		const signal = controller.signal;

		try {
			// Prepare articles for report generation
			const articles = queue
				.map((item, index) => {
					const details = articleDetails[item.id];
					return {
						articleId: item.id,
						url: item.url,
						title: item.title,
						summary: details?.summary || item.excerpt || '',
						content:
							details?.fullText ||
							details?.summary ||
							item.excerpt ||
							'',
						source: item.source,
						publishedAt: item.publishedAt,
						articleNumber: index + 1,
					};
				})
				.filter(
					(article) => article.content && article.content.length > 0
				);

			if (articles.length === 0) {
				throw new Error(
					'No article content available for report generation'
				);
			}

			const requestBody = {
				articles,
				investigation: 'News Briefing Report',
				selectedInvestigators: ['reporter', 'privateEye'],
				targetLengthSeconds: 600, // 10 minutes default
			};

			console.log(
				'Sending news investigative report request:',
				JSON.stringify(requestBody)
			);

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

			let hasCompleted = false;

			if (!response.body) {
				throw new Error('Response body is null, cannot read stream');
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';

			const timeoutId = setTimeout(() => {
				try {
					console.log(
						'Report generation timeout reached, aborting fetch'
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

			const processEvents = () => {
				const events = buffer.split('\n\n');
				buffer = events.pop() || '';

				for (const eventText of events) {
					if (!eventText.trim()) continue;

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

					try {
						let data;
						try {
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
							data = eventData;
						}

						if (
							eventName === 'generatingReport' ||
							eventName === 'progress' ||
							eventName === 'briefingUpdate'
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

							const articleCount = queue.length;
							const firstArticleTitle =
								queue.length > 0 && queue[0].title
									? queue[0].title.length > 30
										? queue[0].title.substring(0, 30) +
										  '...'
										: queue[0].title
									: 'News Article';

							const now = new Date();
							const dateStr = now.toLocaleDateString('en-US', {
								month: 'short',
								day: 'numeric',
								hour: '2-digit',
								minute: '2-digit',
							});

							const reportTitle =
								articleCount === 1
									? `News Briefing: ${firstArticleTitle} (${dateStr})`
									: `News Briefing: ${firstArticleTitle} +${
											articleCount - 1
									  } more (${dateStr})`;

							const reportMetadata = {
								id: '',
								title: reportTitle,
								showName: 'News Briefing',
								tags: ['News', 'Briefing', 'Analysis'],
								articleIds: queue.map((item) => item.id),
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
									setReportUrl(audioUrl);

									reportMetadata.id = reportFileId || '';
									reportMetadata.audioUrl = audioUrl;

									console.log(
										'Adding completed news report to playlist:',
										reportMetadata
									);
									setPlaylist((prev) => {
										const exists = prev.some(
											(item) =>
												item.id === reportMetadata.id
										);
										if (!exists) {
											const updatedPlaylist = [
												...prev,
												reportMetadata,
											];

											try {
												localStorage.setItem(
													'newsBriefingPlaylists',
													JSON.stringify(
														updatedPlaylist
													)
												);
												console.log(
													'Saved updated news playlist to localStorage:',
													updatedPlaylist
												);
											} catch (storageErr) {
												console.error(
													'Error saving to localStorage:',
													storageErr
												);
											}

											setTimeout(() => {
												const newIndex =
													updatedPlaylist.length - 1;
												setCurrentPlaylistItem(
													newIndex
												);
												setShowPlaylist(true);

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
							return;
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

			try {
				let shouldContinue = true;
				while (shouldContinue) {
					const { done, value } = await reader.read();

					if (done || hasCompleted) {
						console.log('Stream complete or processing completed');
						shouldContinue = false;
						break;
					}

					buffer += decoder.decode(value, { stream: true });
					processEvents();

					if (hasCompleted) {
						shouldContinue = false;
						controller.abort();
						break;
					}
				}
			} catch (streamError) {
				if (
					hasCompleted &&
					(streamError as Error).name === 'AbortError'
				) {
					console.log(
						'Stream was aborted after successful completion'
					);
				} else {
					throw streamError;
				}
			} finally {
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
			controller.abort();
		}
	};

	// Handle audio playback for either podcast or report
	const togglePlayPause = (playerType: 'podcast' | 'report') => {
		if (!audioRef.current) return;

		if (isPlaying && currentPlayer === playerType) {
			audioRef.current.pause();
		} else {
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
				audioRef.current.load();
			} else if (currentPlayer === 'report' && reportUrl) {
				console.log('Setting audio source to report URL:', reportUrl);
				audioRef.current.src = reportUrl;
				audioRef.current.load();
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

	// Store conditional UI in variables
	let minimalDock = null;
	if (queue.length === 0 && !showPlaylist && playlist.length > 0) {
		// NewsDock should be on the right side like DocumentDock
		minimalDock = (
			<>
				<div className='fixed bottom-0 right-0 p-2 bg-muted border-t border-l border-border rounded-tl-lg shadow-lg z-9100 flex items-center gap-2'>
					<button
						onClick={() => setShowPlaylist(true)}
						className='px-3 py-1.5 bg-muted text-foreground rounded border border-border text-sm flex items-center cursor-pointer hover:bg-secondary transition-colors'
					>
						<Radio size={14} className='mr-1' />
						<span>News Briefings ({playlist.length})</span>
					</button>
				</div>
				<BriefingPanel
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

	// Listen for custom events from the news components
	useEffect(() => {
		const handleNewsDockUpdate = (event: CustomEvent) => {
			if (event.detail && Array.isArray(event.detail.queue)) {
				console.log('NewsDock: Received newsDockUpdate event');

				try {
					const existingIds = queue.map((item) => item.id);
					const newQueue = event.detail.queue.map((item: any) => ({
						id: item.id,
						title: item.title || `Article ${item.id}`,
						url: item.url || item.link,
						type: item.type || 'article',
						source: item.source,
						publishedAt: item.publishedAt,
						excerpt: item.excerpt || item.summary,
						summary: item.summary,
						media: item.media,
					}));

					const itemsToAdd = newQueue.filter(
						(item: NewsArticleItem) =>
							!existingIds.includes(item.id)
					);

					itemsToAdd.forEach((item: NewsArticleItem) =>
						addToQueue(item)
					);
				} catch (error) {
					console.error(
						'Error updating NewsDock from localStorage:',
						error
					);
				}
			}
		};

		window.addEventListener(
			'newsDockUpdate',
			handleNewsDockUpdate as EventListener
		);

		return () => {
			window.removeEventListener(
				'newsDockUpdate',
				handleNewsDockUpdate as EventListener
			);
			// @ts-ignore
			window.updateNewsDock = undefined;
		};
	}, [queue, addToQueue]);

	// Render both the main dock and the briefings panel
	return (
		<>
			{minimalDock}
			{/* News Dock Sheet */}
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
						<div className='px-4 py-3 bg-background cursor-pointer hover:bg-muted/50 transition-colors'>
							<div className='flex justify-between items-center'>
								<div className='flex items-center gap-3'>
									<h3 className='font-semibold text-sm text-foreground m-0'>
										News Queue ({queue.length})
									</h3>
									<NewsAudioPlayerHeader
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
													? 'Hide briefings'
													: 'Show briefings'
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

					{/* Sheet Content - Article Items */}
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
														<span>Briefings</span>
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
												<span>News Briefing</span>
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
														Briefings (
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

							{/* Article queue */}
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
											const articleDetail =
												articleDetails[item.id];
											const currentTab =
												activeTab[item.id] || 'summary';
											const expandedSec =
												expandedSection[item.id];

											return (
												<SortableNewsItem
													key={item.id}
													item={item}
													index={index}
													isDragging={
														activeId === item.id
													}
												>
													{(dragListeners) => (
														<>
															{/* Header with title and controls */}
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
																		{
																			item.title
																		}
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
																	Summary
																</button>
																<button
																	onClick={() =>
																		handleTabChange(
																			item.id,
																			'content'
																		)
																	}
																	className={`px-2 py-1 text-xs border-b-2 transition-colors duration-150 focus:outline-none ${
																		currentTab ===
																		'content'
																			? 'border-primary text-primary'
																			: 'border-transparent text-muted-foreground hover:text-primary'
																	}`}
																>
																	Content
																</button>
																<button
																	onClick={() =>
																		handleTabChange(
																			item.id,
																			'source'
																		)
																	}
																	className={`px-2 py-1 text-xs border-b-2 transition-colors duration-150 focus:outline-none ${
																		currentTab ===
																		'source'
																			? 'border-primary text-primary'
																			: 'border-transparent text-muted-foreground hover:text-primary'
																	}`}
																>
																	Source
																</button>
																{item.media &&
																	item.media
																		.length >
																		0 && (
																		<button
																			onClick={() =>
																				handleTabChange(
																					item.id,
																					'media'
																				)
																			}
																			className={`px-2 py-1 text-xs border-b-2 transition-colors duration-150 focus:outline-none ${
																				currentTab ===
																				'media'
																					? 'border-primary text-primary'
																					: 'border-transparent text-muted-foreground hover:text-primary'
																			}`}
																		>
																			Media
																		</button>
																	)}
															</div>

															{/* Tab content */}
															<div className='h-[260px] overflow-auto p-2 bg-background'>
																{/* Summary tab */}
																{currentTab ===
																	'summary' && (
																	<div className='text-xs text-gray-600 h-full overflow-y-auto whitespace-normal break-words'>
																		{articleDetail?.summary ||
																			item.summary ||
																			item.excerpt ||
																			'Loading summary...'}
																	</div>
																)}

																{/* Content tab */}
																{currentTab ===
																	'content' && (
																	<div className='text-xs text-gray-600 h-full overflow-y-auto whitespace-normal break-words'>
																		{articleDetail?.fullText ||
																			articleDetail?.content ||
																			'Full content not available...'}
																	</div>
																)}

																{/* Source tab */}
																{currentTab ===
																	'source' && (
																	<div className='text-xs text-gray-600 h-full overflow-y-auto whitespace-normal break-words'>
																		<div className='mb-2'>
																			<strong>
																				Source:
																			</strong>{' '}
																			{item
																				.source
																				?.name ||
																				item
																					.source
																					?.site ||
																				'Unknown'}
																		</div>
																		{item
																			.source
																			?.domain && (
																			<div className='mb-2'>
																				<strong>
																					Domain:
																				</strong>{' '}
																				{
																					item
																						.source
																						.domain
																				}
																			</div>
																		)}
																		{item.publishedAt && (
																			<div className='mb-2'>
																				<strong>
																					Published:
																				</strong>{' '}
																				{new Date(
																					item.publishedAt
																				).toLocaleString()}
																			</div>
																		)}
																		<div className='mb-2'>
																			<strong>
																				URL:
																			</strong>{' '}
																			<a
																				href={
																					item.url
																				}
																				className='text-primary'
																				target='_blank'
																				rel='noopener noreferrer'
																			>
																				{
																					item.url
																				}
																			</a>
																		</div>
																	</div>
																)}

																{/* Media tab */}
																{currentTab ===
																	'media' &&
																	item.media &&
																	item.media
																		.length >
																		0 && (
																		<div className='text-xs text-gray-600 h-full overflow-y-auto whitespace-normal break-words'>
																			{item.media.map(
																				(
																					mediaItem,
																					mediaIndex
																				) => (
																					<div
																						key={
																							mediaIndex
																						}
																						className='mb-4'
																					>
																						{mediaItem.type ===
																							'image' && (
																							<img
																								src={
																									mediaItem.url
																								}
																								alt={
																									mediaItem.title ||
																									'Article image'
																								}
																								className='w-full max-w-xs rounded mb-2'
																							/>
																						)}
																						{mediaItem.title && (
																							<div className='font-medium mb-1'>
																								{
																									mediaItem.title
																								}
																							</div>
																						)}
																						{mediaItem.caption && (
																							<div className='text-gray-500 mb-1'>
																								{
																									mediaItem.caption
																								}
																							</div>
																						)}
																						<div className='text-gray-400 text-xs'>
																							{
																								mediaItem.url
																							}
																						</div>
																					</div>
																				)
																			)}
																		</div>
																	)}
															</div>
														</>
													)}
												</SortableNewsItem>
											);
										})}
									</SortableContext>
								</div>

								<DragOverlay>
									{activeId ? (
										<div className='inline-block w-80 h-96 bg-background border border-border rounded-lg shadow-sm opacity-50'>
											<div className='p-2 bg-muted'>
												{
													queue.find(
														(item) =>
															item.id === activeId
													)?.title
												}
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
			<BriefingPanel
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

export default NewsDock;
