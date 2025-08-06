'use client';

import React from 'react';
import { Play, Pause, Radio, SkipBack, SkipForward } from 'lucide-react';

interface NewsAudioPlayerHeaderProps {
	isPlaying: boolean;
	currentPlayer: 'podcast' | 'report' | null;
	currentPlaylistItem: number | null;
	playlist: Array<{
		id: string;
		title: string;
		showName: string;
		tags: string[];
		articleIds: string[];
		audioUrl: string;
		timestamp: string;
	}>;
	podcastUrl: string | null;
	audioRef: React.RefObject<HTMLAudioElement | null>;
	reportUrl: string | null;
	setShowPlaylist: (show: boolean) => void;
	setIsPlaying: (playing: boolean) => void;
	setCurrentPlayer: (player: 'podcast' | 'report' | null) => void;
	togglePlayPause: (playerType: 'podcast' | 'report') => void;
}

export default function NewsAudioPlayerHeader({
	isPlaying,
	currentPlayer,
	currentPlaylistItem,
	playlist,
	podcastUrl,
	audioRef,
	reportUrl,
	setShowPlaylist,
	setIsPlaying,
	setCurrentPlayer,
	togglePlayPause,
}: NewsAudioPlayerHeaderProps) {
	// If we have a current playlist item playing
	if (currentPlaylistItem !== null && playlist[currentPlaylistItem]) {
		const currentItem = playlist[currentPlaylistItem];
		return (
			<div className='flex items-center gap-2'>
				<button
					onClick={() => togglePlayPause('report')}
					className='p-1.5 bg-primary text-primary-foreground rounded-full flex items-center justify-center'
				>
					{isPlaying ? <Pause size={14} /> : <Play size={14} />}
				</button>
				<div className='flex flex-col min-w-0'>
					<div className='text-xs font-medium truncate max-w-32'>
						{currentItem.title}
					</div>
					<div className='text-xs text-muted-foreground truncate max-w-32'>
						{currentItem.showName}
					</div>
				</div>
				<button
					onClick={() => setShowPlaylist(true)}
					className='p-1 text-muted-foreground hover:text-foreground'
				>
					<Radio size={14} />
				</button>
			</div>
		);
	}

	// If we have a podcast ready
	if (podcastUrl && currentPlayer === 'podcast') {
		return (
			<div className='flex items-center gap-2'>
				<button
					onClick={() => togglePlayPause('podcast')}
					className='p-1.5 bg-primary text-primary-foreground rounded-full flex items-center justify-center'
				>
					{isPlaying ? <Pause size={14} /> : <Play size={14} />}
				</button>
				<div className='flex flex-col'>
					<div className='text-xs font-medium'>Generated Podcast</div>
					<div className='text-xs text-muted-foreground'>
						News Analysis
					</div>
				</div>
			</div>
		);
	}

	// If we have a report ready (but not in playlist mode)
	if (reportUrl && currentPlayer === 'report') {
		return (
			<div className='flex items-center gap-2'>
				<button
					onClick={() => togglePlayPause('report')}
					className='p-1.5 bg-destructive text-white rounded-full flex items-center justify-center'
				>
					{isPlaying ? <Pause size={14} /> : <Play size={14} />}
				</button>
				<div className='flex flex-col'>
					<div className='text-xs font-medium'>
						Investigative Report
					</div>
					<div className='text-xs text-muted-foreground'>
						News Investigation
					</div>
				</div>
				<button
					onClick={() => setShowPlaylist(true)}
					className='p-1 text-muted-foreground hover:text-foreground'
				>
					<Radio size={14} />
				</button>
			</div>
		);
	}

	// No audio content available
	return null;
}
