'use client';

import React from 'react';
import { X, Play, Pause, Radio, SkipBack, SkipForward } from 'lucide-react';
import { ScrollArea } from './scroll-area';

interface BriefingItem {
	id: string;
	title: string;
	showName: string;
	tags: string[];
	articleIds: string[];
	audioUrl: string;
	timestamp: string;
}

interface BriefingPanelProps {
	audioRef: React.RefObject<HTMLAudioElement | null>;
	showPlaylist: boolean;
	setShowPlaylist: (show: boolean) => void;
	playlist: BriefingItem[];
	currentPlaylistItem: number | null;
	setCurrentPlaylistItem: (index: number | null) => void;
	isPlaying: boolean;
	setIsPlaying: (playing: boolean) => void;
	setCurrentPlayer: (player: 'podcast' | 'report' | null) => void;
}

export default function BriefingPanel({
	audioRef,
	showPlaylist,
	setShowPlaylist,
	playlist,
	currentPlaylistItem,
	setCurrentPlaylistItem,
	isPlaying,
	setIsPlaying,
	setCurrentPlayer,
}: BriefingPanelProps) {
	const playPlaylistItem = (index: number) => {
		const item = playlist[index];
		if (!item || !audioRef.current) return;

		setCurrentPlaylistItem(index);
		setCurrentPlayer('report');
		audioRef.current.src = item.audioUrl;
		audioRef.current.load();
		audioRef.current.play().catch(console.error);
		setIsPlaying(true);
	};

	const playNext = () => {
		if (
			currentPlaylistItem !== null &&
			currentPlaylistItem < playlist.length - 1
		) {
			playPlaylistItem(currentPlaylistItem + 1);
		}
	};

	const playPrevious = () => {
		if (currentPlaylistItem !== null && currentPlaylistItem > 0) {
			playPlaylistItem(currentPlaylistItem - 1);
		}
	};

	if (!showPlaylist) return null;

	return (
		<div className='fixed bottom-0 right-0 w-80 h-[60vh] bg-background border-l border-t border-border shadow-lg z-9200 flex flex-col'>
			{/* Header */}
			<div className='flex items-center justify-between p-3 border-b border-border bg-muted/30'>
				<div className='flex items-center gap-2'>
					<Radio size={16} />
					<h3 className='font-semibold text-sm'>News Briefings</h3>
					<span className='text-xs text-muted-foreground'>
						({playlist.length})
					</span>
				</div>
				<button
					onClick={() => setShowPlaylist(false)}
					className='p-1 hover:bg-muted rounded'
				>
					<X size={16} />
				</button>
			</div>

			{/* Current playing controls */}
			{currentPlaylistItem !== null && playlist[currentPlaylistItem] && (
				<div className='p-3 border-b border-border bg-muted/20'>
					<div className='flex items-center justify-between mb-2'>
						<div className='flex-1 min-w-0'>
							<div className='font-medium text-sm truncate'>
								{playlist[currentPlaylistItem].title}
							</div>
							<div className='text-xs text-muted-foreground truncate'>
								{playlist[currentPlaylistItem].showName}
							</div>
						</div>
					</div>
					<div className='flex items-center justify-center gap-2'>
						<button
							onClick={playPrevious}
							disabled={currentPlaylistItem <= 0}
							className='p-2 hover:bg-muted rounded disabled:opacity-50'
						>
							<SkipBack size={16} />
						</button>
						<button
							onClick={() => {
								if (audioRef.current) {
									if (isPlaying) {
										audioRef.current.pause();
									} else {
										audioRef.current.play();
									}
								}
							}}
							className='p-2 bg-primary text-primary-foreground rounded-full'
						>
							{isPlaying ? (
								<Pause size={16} />
							) : (
								<Play size={16} />
							)}
						</button>
						<button
							onClick={playNext}
							disabled={
								currentPlaylistItem >= playlist.length - 1
							}
							className='p-2 hover:bg-muted rounded disabled:opacity-50'
						>
							<SkipForward size={16} />
						</button>
					</div>
				</div>
			)}

			{/* Playlist */}
			<ScrollArea className='flex-1'>
				<div className='p-2'>
					{playlist.length === 0 ? (
						<div className='text-center text-muted-foreground py-8'>
							<Radio
								size={32}
								className='mx-auto mb-2 opacity-50'
							/>
							<p className='text-sm'>No briefings yet</p>
							<p className='text-xs'>
								Generate reports to build your playlist
							</p>
						</div>
					) : (
						playlist.map((item: BriefingItem, index: number) => (
							<div
								key={item.id}
								className={`p-3 mb-2 rounded cursor-pointer transition-colors ${
									currentPlaylistItem === index
										? 'bg-primary/10 border border-primary/20'
										: 'bg-muted/30 hover:bg-muted/50'
								}`}
								onClick={() => playPlaylistItem(index)}
							>
								<div className='flex items-start justify-between'>
									<div className='flex-1 min-w-0'>
										<div className='font-medium text-sm truncate mb-1'>
											{item.title}
										</div>
										<div className='text-xs text-muted-foreground mb-2'>
											{item.showName} •{' '}
											{new Date(
												item.timestamp
											).toLocaleDateString()}
										</div>
										{item.tags.length > 0 && (
											<div className='flex flex-wrap gap-1 mb-2'>
												{item.tags
													.slice(0, 3)
													.map(
														(
															tag: string,
															tagIndex: number
														) => (
															<span
																key={tagIndex}
																className='px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded text-xs'
															>
																{tag}
															</span>
														)
													)}
												{item.tags.length > 3 && (
													<span className='text-xs text-muted-foreground'>
														+{item.tags.length - 3}{' '}
														more
													</span>
												)}
											</div>
										)}
										<div className='text-xs text-muted-foreground'>
											{item.articleIds.length} article
											{item.articleIds.length !== 1
												? 's'
												: ''}
										</div>
									</div>
									<div className='flex items-center gap-1 ml-2'>
										{currentPlaylistItem === index && (
											<div className='w-2 h-2 bg-primary rounded-full animate-pulse' />
										)}
									</div>
								</div>
							</div>
						))
					)}
				</div>
			</ScrollArea>
		</div>
	);
}
