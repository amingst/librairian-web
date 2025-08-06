import { Pause, Play, Radio } from 'lucide-react';
import { title } from 'process';

export type AudioPlayerHeaderProps = {
	isPlaying: boolean;
	currentPlayer: 'podcast' | 'report' | null;
	currentPlaylistItem: number | null;
	playlist: Array<{
		id: string;
		title: string;
		showName: string;
		tags: string[];
		documentIds: string[];
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
};

export default function AudioPlayerHeader({
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
}: AudioPlayerHeaderProps) {
	if (!isPlaying && currentPlayer === null && currentPlaylistItem === null)
		return null;

	const playerType = currentPlayer === 'podcast' ? 'podcast' : 'report';
	const audioUrl = playerType === 'podcast' ? podcastUrl : reportUrl;
	const bgColor = playerType === 'podcast' ? '#2563eb' : '#dc2626';
	const title =
		playerType === 'podcast'
			? 'Generated Podcast'
			: currentPlaylistItem !== null && playlist[currentPlaylistItem]
			? playlist[currentPlaylistItem].title.length > 30
				? playlist[currentPlaylistItem].title.substring(0, 30) + '...'
				: playlist[currentPlaylistItem].title
			: 'Investigative Report';

	// Get the current audio URL either from player state or playlist
	const currentAudioUrl =
		currentPlaylistItem !== null && playlist[currentPlaylistItem]
			? playlist[currentPlaylistItem].audioUrl
			: audioUrl;

	if (!currentAudioUrl) return null;

	return (
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: '8px',
				maxWidth: '300px',
				overflow: 'hidden',
			}}
		>
			<button
				onClick={() => {
					// If playing from playlist, handle directly
					if (currentPlaylistItem !== null) {
						if (audioRef.current) {
							if (isPlaying) {
								audioRef.current.pause();
							} else {
								audioRef.current
									.play()
									.catch((e) =>
										console.error('Error playing audio:', e)
									);
							}
							setIsPlaying(!isPlaying);
						}
					} else {
						togglePlayPause(playerType as 'podcast' | 'report');
					}
				}}
				style={{
					padding: '6px',
					backgroundColor: bgColor,
					color: 'white',
					borderRadius: '100%',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					border: 'none',
					cursor: 'pointer',
					flexShrink: 0,
				}}
			>
				{isPlaying ? <Pause size={14} /> : <Play size={14} />}
			</button>

			<div
				style={{
					fontSize: '12px',
					fontWeight: 500,
					whiteSpace: 'nowrap',
					overflow: 'hidden',
					textOverflow: 'ellipsis',
				}}
			>
				{title}
			</div>

			{(currentPlayer === 'report' || currentPlaylistItem !== null) && (
				<button
					onClick={() => setShowPlaylist(true)}
					style={{
						padding: '4px',
						backgroundColor: 'transparent',
						border: 'none',
						cursor: 'pointer',
						display: 'flex',
						alignItems: 'center',
						flexShrink: 0,
					}}
					title='View all investigations'
				>
					<Radio size={14} />
				</button>
			)}
		</div>
	);
}
